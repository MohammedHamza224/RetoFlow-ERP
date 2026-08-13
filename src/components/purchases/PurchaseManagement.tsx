import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Purchase, Supplier, Product } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export function PurchaseManagement() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const cachedPurchases = DatabaseService.getCachedPurchasesSync();
  const [purchases, setPurchases] = useState<Purchase[]>(cachedPurchases || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(!cachedPurchases || cachedPurchases.length === 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Purchase Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<Array<{ product_id: string; quantity: number; unit_cost: number }>>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (supData.length > 0) setSelectedSupplierId(supData[0].id);
    } catch (err: any) {
      console.error('Failed to load purchase data:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(!cachedPurchases || cachedPurchases.length === 0);
  }, [cachedPurchases, loadData]);

  const openCreateModal = () => {
    if (suppliers.length > 0) setSelectedSupplierId(suppliers[0].id);
    setPurchaseItems(products.length > 0 ? [{ product_id: products[0].id, quantity: 10, unit_cost: products[0].cost }] : []);
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

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedSupplierId) {
      setFormError('Please select a supplier.');
      return;
    }

    if (purchaseItems.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    setIsSubmitting(true);
    try {
      await DatabaseService.createPurchase(user?.id, {
        supplier_id: selectedSupplierId,
        items: purchaseItems,
      });
      setIsModalOpen(false);
      await loadData(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create purchase order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceivePurchase = async (purchaseId: string) => {
    try {
      await DatabaseService.receivePurchase(purchaseId, user?.id);
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to receive purchase order.');
    }
  };

  const filteredPurchases = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return purchases.filter(p =>
      !term ||
      p.invoice_number.toLowerCase().includes(term) ||
      (p.supplier && p.supplier.name.toLowerCase().includes(term))
    );
  }, [purchases, searchTerm]);

  return (
    <div className="space-y-6 select-none">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-resto-terracotta-600" />
            Purchase Orders & Stock Receiving
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create procurement purchase orders and execute atomic inventory stock increments ({purchases.length} Purchase Orders)
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
            Create Purchase Order
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search invoice number or supplier name..."
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

      {/* Purchases Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPurchases.map(pur => (
            <Card key={pur.id} className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold truncate font-mono">{pur.invoice_number}</CardTitle>
                  <span className="text-xs font-semibold text-slate-500 block truncate">
                    {pur.supplier?.name || 'Supplier'}
                  </span>
                </div>
                <Badge variant={pur.status === 'RECEIVED' ? 'success' : 'outline'} className="text-[10px]">
                  {pur.status}
                </Badge>
              </CardHeader>

              <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between items-center text-xs">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(pur.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>VAT (15%):</span>
                  <span className="font-semibold">{formatCurrency(pur.tax)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-extrabold text-resto-terracotta-600 font-display">
                  <span>Total Cost:</span>
                  <span>{formatCurrency(pur.total)}</span>
                </div>
              </CardContent>

              {canEdit && pur.status === 'DRAFT' && (
                <CardFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/20">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleReceivePurchase(pur.id)}
                    leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    Receive & Increment Stock
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Purchase Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Procurement Purchase Order"
        description="Draft purchase orders can be received to increment stock quantities atomically."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4 py-2 select-none">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Supplier *</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm"
              required
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.tax_number || 'No VAT'})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Purchase Line Items</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Item
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {purchaseItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <select
                    value={item.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-background px-2 py-1 text-xs"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>

                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                    className="w-20 h-8 text-xs"
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                    placeholder="Cost"
                    className="w-24 h-8 text-xs"
                  />

                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)} className="h-8 w-8 text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="bg-resto-terracotta-600">
              Create Purchase Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
