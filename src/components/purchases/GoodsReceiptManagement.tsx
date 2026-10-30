import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PackageCheck,
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  User as UserIcon,
  Calendar,
  Layers,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { GoodsReceipt, Purchase, Supplier, Product } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { PrintableGoodsReceipt } from '@/components/print/PrintableGoodsReceipt';

interface GoodsReceiptManagementProps {
  initialPurchaseId?: string;
  onReceiptCreated?: () => void;
}

export function GoodsReceiptManagement({ initialPurchaseId, onReceiptCreated }: GoodsReceiptManagementProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [receipts, setReceipts] = useState<GoodsReceipt[]>(() => DatabaseService.getCachedGoodsReceiptsSync() || []);
  const [purchases, setPurchases] = useState<Purchase[]>(() => DatabaseService.getCachedPurchasesSync() || []);
  const [isLoading, setIsLoading] = useState(() => !receipts || receipts.length === 0);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string>(initialPurchaseId || '');
  const [receivingItems, setReceivingItems] = useState<
    Array<{
      purchase_item_id: string;
      product_id: string;
      product_name: string;
      sku: string;
      ordered_qty: number;
      previously_received: number;
      remaining_qty: number;
      quantity_received: number;
      unit_cost: number;
    }>
  >([]);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Details Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);

  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [receiptData, purchaseData] = await Promise.all([
        DatabaseService.getGoodsReceipts(),
        DatabaseService.getPurchases(),
      ]);
      setReceipts(receiptData);
      setPurchases(purchaseData);
    } catch (err: any) {
      console.error('Failed to load goods receipts:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(receipts.length === 0);
  }, [loadData]);

  // Open modal automatically if initialPurchaseId passed
  useEffect(() => {
    if (initialPurchaseId && purchases.length > 0) {
      handleSelectPO(initialPurchaseId);
      setIsModalOpen(true);
    }
  }, [initialPurchaseId, purchases]);

  // Eligible POs for receiving (only PENDING_RECEIPT or PARTIALLY_RECEIVED)
  const receivablePurchases = useMemo(() => {
    return purchases.filter(p => p.status === 'PENDING_RECEIPT' || p.status === 'PARTIALLY_RECEIVED' || p.status === 'DRAFT');
  }, [purchases]);

  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    setFormError('');

    const po = purchases.find(p => p.id === poId);
    if (!po || !po.items) {
      setReceivingItems([]);
      return;
    }

    const items = po.items.map(item => {
      const previouslyReceived = item.received_quantity || 0;
      const remaining = Math.max(0, item.quantity - previouslyReceived);
      return {
        purchase_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product?.name || `Product #${item.product_id.slice(-6)}`,
        sku: item.product?.sku || '-',
        ordered_qty: item.quantity,
        previously_received: previouslyReceived,
        remaining_qty: remaining,
        quantity_received: remaining, // default to receive full remaining
        unit_cost: item.unit_cost,
      };
    });

    setReceivingItems(items);
  };

  const handleItemQtyChange = (index: number, value: number) => {
    const updated = [...receivingItems];
    const val = isNaN(value) ? 0 : Math.max(0, value);
    updated[index].quantity_received = Math.min(val, updated[index].remaining_qty);
    setReceivingItems(updated);
  };

  const openCreateModal = () => {
    setFormError('');
    setReceiptNotes('');
    if (receivablePurchases.length > 0) {
      handleSelectPO(receivablePurchases[0].id);
    } else {
      setSelectedPoId('');
      setReceivingItems([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPoId) {
      setFormError(t('goodsReceipts.selectPoRequired'));
      return;
    }

    const itemsToReceive = receivingItems.filter(i => i.quantity_received > 0);
    if (itemsToReceive.length === 0) {
      setFormError(t('goodsReceipts.atLeastOneQtyRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await DatabaseService.recordGoodsReceipt({
        purchase_id: selectedPoId,
        received_by: user?.id,
        items: itemsToReceive.map(i => ({
          purchase_item_id: i.purchase_item_id,
          product_id: i.product_id,
          quantity_received: i.quantity_received,
          unit_cost: i.unit_cost,
        })),
        notes: receiptNotes.trim() || undefined,
      });

      setIsModalOpen(false);
      await loadData(false);
      if (onReceiptCreated) onReceiptCreated();
    } catch (err: any) {
      setFormError(err.message || t('goodsReceipts.receiveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReceipts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return receipts.filter(r => {
      return (
        !term ||
        r.receipt_number.toLowerCase().includes(term) ||
        (r.supplier && r.supplier.name.toLowerCase().includes(term)) ||
        (r.purchase && r.purchase.invoice_number.toLowerCase().includes(term))
      );
    });
  }, [receipts, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            {t('goodsReceipts.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('goodsReceipts.subtitle')} ({receipts.length} {t('goodsReceipts.receiptCount')})
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white"
          >
            {t('goodsReceipts.recordReceipt')}
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('goodsReceipts.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredReceipts.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('goodsReceipts.noReceipts')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('goodsReceipts.noReceiptsDesc')}
          </p>
        </div>
      )}

      {/* Goods Receipts Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReceipts.map(rcpt => (
            <Card
              key={rcpt.id}
              className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedReceipt(rcpt)}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400 truncate">
                    {rcpt.receipt_number}
                  </CardTitle>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block truncate">
                    {rcpt.supplier?.name || t('suppliers.name')}
                  </span>
                </div>
                <Badge variant="success" className="text-[10px] shrink-0">
                  {t('goodsReceipts.receivedBadge')}
                </Badge>
              </CardHeader>

              <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{t('goodsReceipts.poReference')}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {rcpt.purchase?.invoice_number || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{t('goodsReceipts.itemsCount')}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {rcpt.items?.length || 0} {t('goodsReceipts.items')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{t('goodsReceipts.receivedDate')}</span>
                  <span className="font-mono">{new Date(rcpt.received_at).toLocaleDateString()}</span>
                </div>
                {rcpt.notes && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    "{rcpt.notes}"
                  </p>
                )}
              </CardContent>

              <CardFooter className="pt-2.5 pb-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 text-[11px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <UserIcon className="w-3 h-3 text-slate-400" />
                  {rcpt.receiver?.name || t('goodsReceipts.authorizedStaff')}
                </span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5" />
                  {t('goodsReceipts.viewDetails')} / {t('common.print')}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Record Goods Receipt Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('goodsReceipts.modalTitle')}
        description={t('goodsReceipts.modalDesc')}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitReceipt} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Select Purchase Order */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('goodsReceipts.selectPoLabel')}
            </label>
            {receivablePurchases.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 text-xs">
                {t('goodsReceipts.noReceivablePOs')}
              </div>
            ) : (
              <select
                value={selectedPoId}
                onChange={(e) => handleSelectPO(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                required
              >
                <option value="">{t('goodsReceipts.selectPoPlaceholder')}</option>
                {receivablePurchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.invoice_number} — {p.supplier?.name} ({t(`purchases.status.${p.status}`)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Items Receiving Table */}
          {receivingItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('goodsReceipts.itemsReceivingList')}
              </span>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full min-w-[500px] text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2.5 text-left">{t('purchases.product')}</th>
                      <th className="p-2.5 text-center font-mono w-16">{t('goodsReceipts.ordered')}</th>
                      <th className="p-2.5 text-center font-mono w-16">{t('goodsReceipts.receivedPrev')}</th>
                      <th className="p-2.5 text-center font-mono w-16">{t('goodsReceipts.remaining')}</th>
                      <th className="p-2.5 text-center font-mono w-28 text-emerald-700 dark:text-emerald-400 font-bold">
                        {t('goodsReceipts.receivingNow')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {receivingItems.map((item, index) => (
                      <tr key={item.purchase_item_id} className={item.remaining_qty === 0 ? 'opacity-50' : ''}>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                            {item.product_name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">{item.sku}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold">{item.ordered_qty}</td>
                        <td className="p-2.5 text-center font-mono text-slate-500">{item.previously_received}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-amber-600">{item.remaining_qty}</td>
                        <td className="p-2.5 text-center">
                          {item.remaining_qty > 0 ? (
                            <Input
                              type="number"
                              min="0"
                              max={item.remaining_qty}
                              step="1"
                              value={item.quantity_received}
                              onChange={(e) => handleItemQtyChange(index, parseInt(e.target.value, 10))}
                              className="h-8 text-xs text-center font-bold text-emerald-700 dark:text-emerald-400"
                            />
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {t('goodsReceipts.fullyReceived')}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('goodsReceipts.notesLabel')}
            </label>
            <Input
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              placeholder={t('goodsReceipts.notesPlaceholder')}
              className="text-xs"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              disabled={receivingItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white"
            >
              {t('goodsReceipts.confirmReceipt')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View & Print Receipt Details Modal */}
      {selectedReceipt && (
        <Modal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          title=""
          maxWidth="2xl"
        >
          <PrintableGoodsReceipt
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        </Modal>
      )}
    </div>
  );
}
