import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Search,
  PackageCheck,
  Receipt,
  Trash2,
  ShieldAlert,
  Printer,
  Ban,
  Clock,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Purchase, Supplier, Product, PurchaseStatus } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

interface PurchaseManagementProps {
  onNavigateToReceipts?: (purchaseId: string) => void;
  onNavigateToInvoices?: (purchaseId: string) => void;
}

export function PurchaseManagement({ onNavigateToReceipts, onNavigateToInvoices }: PurchaseManagementProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [purchases, setPurchases] = useState<Purchase[]>(() => DatabaseService.getCachedPurchasesSync() || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DatabaseService.getCachedSuppliersSync() || []);
  const [products, setProducts] = useState<Product[]>(() => DatabaseService.getCachedProductsSync() || []);
  const [isLoading, setIsLoading] = useState(() => !purchases || purchases.length === 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseStatus>('ALL');

  // New PO Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<Array<{ product_id: string; quantity: number; unit_cost: number }>>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View PO Details Modal
  const [selectedPO, setSelectedPO] = useState<Purchase | null>(null);

  // Cancel PO Confirmation
  const [cancellingPO, setCancellingPO] = useState<Purchase | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [purData, supData, prodData] = await Promise.all([
        DatabaseService.getPurchases(),
        DatabaseService.getSuppliers(),
        DatabaseService.getProducts(),
      ]);
      setPurchases(purData);
      setSuppliers(supData);
      setProducts(prodData);
    } catch (err: any) {
      console.error('Failed to load purchase data:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(purchases.length === 0);
  }, [loadData]);

  const openCreateModal = () => {
    if (suppliers.length > 0) setSelectedSupplierId(suppliers[0].id);
    setPurchaseItems(products.length > 0 ? [{ product_id: products[0].id, quantity: 10, unit_cost: products[0].cost }] : []);
    setDiscount(0);
    setNotes('');
    setExpectedDate('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setPurchaseItems([...purchaseItems, { product_id: defaultProd.id, quantity: 10, unit_cost: defaultProd.cost }]);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'product_id' | 'quantity' | 'unit_cost', value: any) => {
    const updated = [...purchaseItems];
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value,
        unit_cost: prod ? prod.cost : updated[index].unit_cost,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPurchaseItems(updated);
  };

  const calculatedSubtotal = useMemo(() => {
    return purchaseItems.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0);
  }, [purchaseItems]);

  const calculatedTax = useMemo(() => {
    const taxable = Math.max(0, calculatedSubtotal - discount);
    return Math.round((taxable * 0.15) * 100) / 100;
  }, [calculatedSubtotal, discount]);

  const calculatedTotal = useMemo(() => {
    const taxable = Math.max(0, calculatedSubtotal - discount);
    return Math.round((taxable + calculatedTax) * 100) / 100;
  }, [calculatedSubtotal, discount, calculatedTax]);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedSupplierId) {
      setFormError(t('purchases.selectSupplierRequired'));
      return;
    }

    if (purchaseItems.length === 0) {
      setFormError(t('purchases.itemRequired'));
      return;
    }

    for (const item of purchaseItems) {
      if (item.quantity <= 0) {
        setFormError(t('purchases.qtyPositive'));
        return;
      }
      if (item.unit_cost < 0) {
        setFormError(t('purchases.costPositive'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const invoiceNumber = `PO-${Date.now().toString().slice(-6)}`;
      // Crucial Rule: Creating a PO NEVER touches inventory!
      await DatabaseService.createPurchaseOrder(
        user?.id,
        selectedSupplierId,
        invoiceNumber,
        purchaseItems,
        {
          notes: notes.trim() || undefined,
          discount: discount > 0 ? discount : undefined,
          expected_delivery_date: expectedDate || undefined,
          status: 'PENDING_RECEIPT',
        }
      );

      setIsModalOpen(false);
      await loadData(false);
    } catch (err: any) {
      setFormError(err.message || t('purchases.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPO = async () => {
    if (!cancellingPO) return;
    setIsSubmitting(true);
    try {
      await DatabaseService.cancelPurchaseOrder(user?.id, cancellingPO.id, cancelReason);
      setCancellingPO(null);
      setCancelReason('');
      await loadData(false);
    } catch (err: any) {
      alert(err.message || t('purchases.cancelFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return purchases.filter(p => {
      const matchesSearch =
        !term ||
        p.invoice_number.toLowerCase().includes(term) ||
        (p.supplier && p.supplier.name.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchases, searchTerm, statusFilter]);

  const getStatusBadge = (status: PurchaseStatus) => {
    switch (status) {
      case 'RECEIVED':
        return <Badge variant="success" className="text-[10px]">{t('purchases.status.RECEIVED')}</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="warning" className="text-[10px]">{t('purchases.status.PARTIALLY_RECEIVED')}</Badge>;
      case 'PENDING_RECEIPT':
        return <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30">{t('purchases.status.PENDING_RECEIPT')}</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">{t('purchases.status.APPROVED')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive" className="text-[10px]">{t('purchases.status.CANCELLED')}</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="outline" className="text-[10px]">{t('purchases.status.DRAFT')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-resto-terracotta-600" />
            {t('purchases.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('purchases.subtitle')} ({purchases.length} {t('purchases.purchaseCount')})
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
          >
            {t('purchases.createPurchase')}
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('purchases.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">{t('common.allStatuses')}</option>
            <option value="PENDING_RECEIPT">{t('purchases.status.PENDING_RECEIPT')}</option>
            <option value="PARTIALLY_RECEIVED">{t('purchases.status.PARTIALLY_RECEIVED')}</option>
            <option value="RECEIVED">{t('purchases.status.RECEIVED')}</option>
            <option value="CANCELLED">{t('purchases.status.CANCELLED')}</option>
            <option value="DRAFT">{t('purchases.status.DRAFT')}</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPurchases.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('purchases.noPurchases')}
          </h4>
        </div>
      )}

      {/* Purchases Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPurchases.map(pur => (
            <Card
              key={pur.id}
              className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between"
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold truncate font-mono text-slate-900 dark:text-slate-100">
                    {pur.invoice_number}
                  </CardTitle>
                  <span className="text-xs font-semibold text-slate-500 block truncate">
                    {pur.supplier?.name || t('suppliers.name')}
                  </span>
                </div>
                {getStatusBadge(pur.status)}
              </CardHeader>

              <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between items-center text-xs">
                  <span>{t('purchases.orderDate')}</span>
                  <span className="font-mono">{pur.purchase_date}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>{t('purchases.subtotal')}</span>
                  <span className="font-semibold font-mono">{formatCurrency(pur.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>{t('purchases.tax')} (15%)</span>
                  <span className="font-semibold font-mono">{formatCurrency(pur.tax)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-extrabold text-resto-terracotta-600 font-display">
                  <span>{t('purchases.totalCost')}</span>
                  <span className="font-mono">{formatCurrency(pur.total)}</span>
                </div>
                {pur.notes && (
                  <p className="text-[11px] text-slate-400 italic line-clamp-1 pt-1">
                    "{pur.notes}"
                  </p>
                )}
              </CardContent>

              <CardFooter className="pt-2.5 pb-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPO(pur)}
                  className="h-7 text-xs font-semibold px-2"
                >
                  {t('purchases.viewDetails')}
                </Button>

                <div className="flex items-center gap-1">
                  {/* Receive Action */}
                  {canEdit && (pur.status === 'PENDING_RECEIPT' || pur.status === 'PARTIALLY_RECEIVED') && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigateToReceipts ? onNavigateToReceipts(pur.id) : null}
                      leftIcon={<PackageCheck className="w-3 h-3" />}
                      className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2"
                    >
                      {t('purchases.receiveGoodsButton')}
                    </Button>
                  )}

                  {/* Create Invoice Action */}
                  {canEdit && pur.status !== 'CANCELLED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateToInvoices ? onNavigateToInvoices(pur.id) : null}
                      leftIcon={<Receipt className="w-3 h-3 text-resto-terracotta-600" />}
                      className="h-7 text-[11px] font-bold px-2"
                    >
                      {t('purchases.createInvoiceButton')}
                    </Button>
                  )}

                  {/* Cancel Action */}
                  {canEdit && pur.status === 'PENDING_RECEIPT' && (
                    <button
                      type="button"
                      onClick={() => setCancellingPO(pur)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title={t('purchases.cancelPO')}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Purchase Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('purchases.modalTitle')}
        description={t('purchases.modalDesc')}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Supplier Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('purchases.selectSupplier')}
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              required
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || t('purchases.noPhone')})
                </option>
              ))}
            </select>
          </div>

          {/* Items Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('purchases.purchaseItems')}
              </span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleAddItem}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                {t('purchases.addItem')}
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {purchaseItems.map((item, index) => (
                <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div className="w-full sm:flex-1 min-w-0">
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-background px-2 py-1.5 text-xs h-9"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-16 sm:w-20">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                      placeholder={t('purchases.qty')}
                      className="h-9 text-xs text-center font-mono"
                    />
                  </div>

                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => handleItemChange(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                      placeholder={t('purchases.unitCost')}
                      className="h-9 text-xs text-end font-mono"
                    />
                  </div>

                  <div className="flex-1 sm:w-24 sm:flex-none text-end font-bold text-xs font-mono text-resto-terracotta-600">
                    {formatCurrency(item.quantity * item.unit_cost)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded"
                    aria-label="Remove line item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Expected Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('purchases.discount')}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('purchases.expectedDelivery')}
              </label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('common.notes')}
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('purchases.notesPlaceholder')}
              className="text-xs"
            />
          </div>

          {/* Totals Summary */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>{t('purchases.subtotal')}:</span>
              <span className="font-mono">{formatCurrency(calculatedSubtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t('purchases.discount')}:</span>
                <span className="font-mono">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('purchases.tax')} (15%):</span>
              <span className="font-mono">{formatCurrency(calculatedTax)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-resto-terracotta-600 pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>{t('purchases.totalCost')}:</span>
              <span className="font-mono">{formatCurrency(calculatedTotal)}</span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {t('purchases.submitPurchase')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View PO Details Modal */}
      {selectedPO && (
        <Modal
          isOpen={!!selectedPO}
          onClose={() => setSelectedPO(null)}
          title={`${t('purchases.poDetailsTitle')} — ${selectedPO.invoice_number}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-500 block">{t('suppliers.name')}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {selectedPO.supplier?.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">{t('common.status')}:</span>
                {getStatusBadge(selectedPO.status)}
              </div>
              <div>
                <span className="text-slate-500 block">{t('purchases.orderDate')}:</span>
                <span className="font-mono">{selectedPO.purchase_date}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">{t('purchases.totalCost')}:</span>
                <span className="font-mono font-bold text-resto-terracotta-600 text-sm">
                  {formatCurrency(selectedPO.total)}
                </span>
              </div>
            </div>

            {/* Line items table with ordered vs received */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2 text-left">{t('purchases.product')}</th>
                    <th className="p-2 text-center font-mono w-16">{t('purchases.qty')}</th>
                    <th className="p-2 text-center font-mono w-20">{t('goodsReceipts.qtyReceived')}</th>
                    <th className="p-2 text-right font-mono w-24">{t('purchases.unitCost')}</th>
                    <th className="p-2 text-right font-mono w-24">{t('purchases.totalCost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedPO.items || []).map(item => (
                    <tr key={item.id}>
                      <td className="p-2 font-medium">{item.product?.name || item.product_id}</td>
                      <td className="p-2 text-center font-mono font-bold">{item.quantity}</td>
                      <td className="p-2 text-center font-mono text-emerald-600 font-bold">
                        {item.received_quantity || 0}
                      </td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.unit_cost)}</td>
                      <td className="p-2 text-right font-mono font-bold">{formatCurrency(item.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPO(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel PO Confirmation Modal */}
      {cancellingPO && (
        <Modal
          isOpen={!!cancellingPO}
          onClose={() => setCancellingPO(null)}
          title={t('purchases.cancelPOTitle')}
          description={t('purchases.cancelPODesc')}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {cancellingPO.invoice_number} ({cancellingPO.supplier?.name})
            </p>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t('purchases.cancelReasonLabel')}
              </label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('purchases.cancelReasonPlaceholder')}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setCancellingPO(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCancelPO}
                isLoading={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {t('purchases.confirmCancelPO')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
