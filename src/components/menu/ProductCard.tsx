import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Power, AlertTriangle, PackageX, CheckCircle2, Utensils } from 'lucide-react';
import { Product } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface ProductCardProps {
  product: Product;
  isManagerOrAdmin: boolean;
  onEdit: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
}

export const ProductCard = React.memo(function ProductCard({
  product,
  isManagerOrAdmin,
  onEdit,
  onToggleStatus,
}: ProductCardProps) {
  const { t } = useTranslation();
  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;

  const getStockBadge = () => {
    if (!product.is_active) {
      return <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500">{t('common.inactive')}</Badge>;
    }
    if (isOutOfStock) {
      return <Badge variant="destructive" className="flex items-center gap-1"><PackageX className="w-3 h-3" /> {t('menu.outOfStock')}</Badge>;
    }
    if (isLowStock) {
      return <Badge variant="warning" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t('menu.lowStock')} ({product.stock_quantity})</Badge>;
    }
    return <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('menu.inStock')} ({product.stock_quantity})</Badge>;
  };

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-200 border flex flex-col justify-between ${
        !product.is_active
          ? 'opacity-70 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
          : 'bg-card hover:border-resto-terracotta-500/40 shadow-subtle hover:shadow-card'
      }`}
    >
      {/* Product Image Header */}
      <div className="relative h-40 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-800 select-none">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Utensils className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            <span className="text-[10px] font-medium text-slate-400">{t('menu.noImage')}</span>
          </div>
        )}

        {/* Floating Stock Badge */}
        <div className="absolute top-3 right-3 z-10">
          {getStockBadge()}
        </div>

        {/* Category Pill */}
        {product.category?.name && (
          <div className="absolute bottom-3 left-3 z-10 bg-resto-charcoal-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">
            {product.category.name}
          </div>
        )}
      </div>

      {/* Product Details */}
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-resto-terracotta-600 transition-colors">
            {product.name}
          </CardTitle>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
            {product.sku}
          </span>
        </div>
        {product.description && (
          <CardDescription className="line-clamp-2 text-xs mt-1">
            {product.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {/* Pricing & Margin Summary */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">{t('menu.sellingPrice')}</span>
            <span className="text-base font-extrabold text-resto-terracotta-600 font-display">
              {formatCurrency(product.price)}
            </span>
          </div>
          {isManagerOrAdmin && (
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">{t('menu.costPrice')}</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {formatCurrency(product.cost)}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Role-Based Actions */}
      {isManagerOrAdmin && (
        <CardFooter className="p-3 pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(product)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            {t('common.edit')}
          </Button>

          <Button
            variant={product.is_active ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => onToggleStatus(product)}
            leftIcon={<Power className="w-3.5 h-3.5" />}
            className={product.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600'}
          >
            {product.is_active ? t('menu.deactivate') : t('menu.reactivate')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
});
