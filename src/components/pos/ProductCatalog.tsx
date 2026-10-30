import React, { useState, useMemo, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Utensils, AlertTriangle, PackageX, Plus } from 'lucide-react';
import { Product, Category } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface ProductCatalogProps {
  products: Product[];
  categories: Category[];
  onAddToCart: (product: Product) => void;
}

export const ProductCatalog = React.memo(function ProductCatalog({ products, categories, onAddToCart }: ProductCatalogProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const activeCategories = useMemo(() => categories.filter(c => c.is_active), [categories]);

  const filteredProducts = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return products.filter(p => {
      // Must be active
      if (!p.is_active) return false;

      const matchesSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term);

      const matchesCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, deferredSearchTerm, selectedCategory]);

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Search & Category Filter */}
      <div className="space-y-3 shrink-0">
        <Input
          placeholder={t('pos.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="h-10 text-xs bg-card"
        />

        {/* Category Horizontal Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 min-h-[38px] shrink-0 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === 'ALL'
                ? 'bg-resto-terracotta-600 text-white border-resto-terracotta-500 shadow-sm'
                : 'bg-card text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            {t('pos.allCategories')}
          </button>
          {activeCategories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 min-h-[38px] shrink-0 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === c.id
                  ? 'bg-resto-terracotta-600 text-white border-resto-terracotta-500 shadow-sm'
                  : 'bg-card text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Items Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 my-auto space-y-2">
            <Utensils className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-xs font-medium text-slate-500">No items match your catalog search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-3">
            {filteredProducts.map(product => {
              const isOutOfStock = product.stock_quantity === 0;
              const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;

              return (
                <Card
                  key={product.id}
                  onClick={() => !isOutOfStock && onAddToCart(product)}
                  className={`p-3 border transition-all flex flex-col justify-between select-none ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200'
                      : 'cursor-pointer bg-card hover:border-resto-terracotta-500 hover:shadow-card active:scale-95'
                  }`}
                >
                  {product.image_url && (
                    <div className="w-full h-24 mb-2 -mt-3 -mx-3 bg-slate-100 dark:bg-slate-900 rounded-t-xl overflow-hidden shrink-0">
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target as HTMLElement).style.display = 'none'}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                        {product.name}
                      </span>
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                          {t('pos.outOfStock')}
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning" className="text-[9px] px-1 py-0 shrink-0">
                          {product.stock_quantity} Left
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 block">{product.sku}</span>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <span className="text-xs font-extrabold text-resto-terracotta-600 font-display">
                      {formatCurrency(product.price)}
                    </span>
                    {!isOutOfStock && (
                      <div className="w-6 h-6 rounded-lg bg-resto-terracotta-500/10 text-resto-terracotta-600 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
