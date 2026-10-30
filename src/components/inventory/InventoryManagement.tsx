import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Search,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Layers,
  Edit,
  ShieldAlert,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Product } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';

export function InventoryManagement() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const cachedProds = DatabaseService.getCachedProductsSync();
  const [products, setProducts] = useState<Product[]>(cachedProds || []);
  const [isLoading, setIsLoading] = useState(!cachedProds || cachedProds.length === 0);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'NORMAL'>('ALL');

  // Stock Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [newMinStock, setNewMinStock] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const data = await DatabaseService.getProducts();
      setProducts(data);
    } catch (err: any) {
      console.error('Failed to load inventory products:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = DatabaseService.getCachedProductsSync();
    loadProducts(!cached || cached.length === 0);
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term);

      let matchesStock = true;
      if (stockFilter === 'OUT') matchesStock = p.stock_quantity <= 0;
      else if (stockFilter === 'LOW') matchesStock = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;
      else if (stockFilter === 'NORMAL') matchesStock = p.stock_quantity > p.minimum_stock;

      return matchesSearch && matchesStock;
    });
  }, [products, deferredSearch, stockFilter]);

  // Inventory Summary Metrics
  const lowStockCount = useMemo(() => products.filter(p => p.is_active && p.stock_quantity <= p.minimum_stock && p.stock_quantity > 0).length, [products]);
  const outOfStockCount = useMemo(() => products.filter(p => p.is_active && p.stock_quantity <= 0).length, [products]);
  const totalValuation = useMemo(() => products.reduce((sum, p) => sum + (p.stock_quantity * p.cost), 0), [products]);

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSubmitting(true);
    try {
      await DatabaseService.modifyProduct(user?.id, editingProduct.id, {
        stock_quantity: newStock,
        minimum_stock: newMinStock,
      });
      setEditingProduct(null);
      await loadProducts(false);
    } catch (err: any) {
      alert(err.message || (isRtl ? 'فشل تحديث المخزون.' : 'Failed to update stock.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-resto-terracotta-600" />
            {t('inventory.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('inventory.subtitle')} ({products.length} {t('inventory.productsTracked')})
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadProducts(true)}
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-resto-terracotta-600" />}
          className="text-xs font-semibold"
        >
          {t('inventory.refresh')}
        </Button>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('inventory.totalValue')}</span>
            <span className="text-xl font-extrabold font-display text-resto-terracotta-600">{formatCurrency(totalValuation)}</span>
          </div>
          <Layers className="w-7 h-7 text-resto-terracotta-600/30" />
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">{t('inventory.lowStockAlert')}</span>
            <span className="text-xl font-extrabold font-display text-amber-800 dark:text-amber-200">{lowStockCount} {t('menu.productsCount')}</span>
          </div>
          <AlertTriangle className="w-7 h-7 text-amber-600" />
        </div>

        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300 block">{t('inventory.outOfStock')}</span>
            <span className="text-xl font-extrabold font-display text-red-800 dark:text-red-200">{outOfStockCount} {t('menu.productsCount')}</span>
          </div>
          <TrendingDown className="w-7 h-7 text-red-600" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500">{t('inventory.stockStatus')}</span>
          {(['ALL', 'NORMAL', 'LOW', 'OUT'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStockFilter(s)}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                stockFilter === s
                  ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? t('inventory.all') : s === 'NORMAL' ? t('inventory.normal') : s === 'LOW' ? t('inventory.low') : t('inventory.out')}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Inventory Table */}
      {!isLoading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden text-xs shadow-subtle">
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[750px] ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">{t('inventory.product')}</th>
                  <th className="p-3">{t('inventory.sku')}</th>
                  <th className="p-3 text-right">{t('inventory.costPrice')}</th>
                  <th className="p-3 text-right">{t('inventory.sellPrice')}</th>
                  <th className="p-3 text-center">{t('inventory.stockQuantity')}</th>
                  <th className="p-3 text-center">{t('inventory.minThreshold')}</th>
                  <th className="p-3 text-center">{t('inventory.status')}</th>
                  <th className="p-3 text-right">{t('inventory.totalItemValue')}</th>
                  {canEdit && <th className="p-3 text-center">{t('inventory.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map(p => {
                  const isOut = p.stock_quantity <= 0;
                  const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                      <td className="p-3 font-mono text-slate-400 text-[11px]">{p.sku}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{formatCurrency(p.cost)}</td>
                      <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(p.price)}</td>
                      <td className="p-3 text-center font-extrabold text-sm">{p.stock_quantity}</td>
                      <td className="p-3 text-center text-slate-400 font-mono">{p.minimum_stock}</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={isOut ? 'destructive' : isLow ? 'warning' : 'success'}
                          className="text-[9px] px-2 py-0.5"
                        >
                          {isOut ? t('menu.outOfStock') : isLow ? t('menu.lowStock') : t('inventory.normal')}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-extrabold font-display text-resto-terracotta-600">
                        {formatCurrency(p.stock_quantity * p.cost)}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(p);
                              setNewStock(p.stock_quantity);
                              setNewMinStock(p.minimum_stock);
                            }}
                            leftIcon={<Edit className="w-3.5 h-3.5" />}
                          >
                            {t('inventory.adjustStock')}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`${t('inventory.adjustModalTitle')} — ${editingProduct?.name}`}
        description={t('inventory.adjustModalDesc')}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateStock} className="space-y-4 py-2 select-none">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('inventory.physicalStockQty')}</label>
            <Input
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('inventory.minThresholdAlert')}</label>
            <Input
              type="number"
              min="0"
              value={newMinStock}
              onChange={(e) => setNewMinStock(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setEditingProduct(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="bg-resto-terracotta-600">
              {t('inventory.saveAdjustments')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
