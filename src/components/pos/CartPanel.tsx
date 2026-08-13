import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Trash2, Plus, Minus, Tag } from 'lucide-react';
import { Product } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calculateOrderTotals, DEFAULT_VAT_RATE } from '@/config/tax.config';

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  notes?: string;
}

export interface CartPanelProps {
  cart: CartItem[];
  orderDiscount: number;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onUpdateDiscount: (discount: number) => void;
}

export const CartPanel = React.memo(function CartPanel({
  cart,
  orderDiscount,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onUpdateDiscount,
}: CartPanelProps) {
  const { t } = useTranslation();

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity) - item.discount, 0);
  const totals = calculateOrderTotals(subtotal, orderDiscount, DEFAULT_VAT_RATE);

  return (
    <div className="flex flex-col h-full bg-card border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-subtle">
      {/* Header */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-resto-terracotta-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-resto-charcoal-900 dark:text-slate-100">
            {t('pos.cartTitle')} ({cart.reduce((sum, i) => sum + i.quantity, 0)})
          </h4>
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            {t('pos.clearCart')}
          </button>
        )}
      </div>

      {/* Cart Line Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
            <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('pos.emptyCart')}</span>
            <p className="text-[11px] max-w-xs">{t('pos.emptyCartDesc')}</p>
          </div>
        ) : (
          cart.map(({ product, quantity, discount }) => {
            const lineTotal = (product.price * quantity) - discount;
            const isStockMax = quantity >= product.stock_quantity;

            return (
              <div
                key={product.id}
                className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                    {product.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {formatCurrency(product.price)} &times; {quantity}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => onUpdateQuantity(product.id, -1)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold">{quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(product.id, 1)}
                    disabled={isStockMax}
                    className={`p-1 rounded transition-colors ${
                      isStockMax
                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Line Total & Delete */}
                <div className="text-right flex items-center gap-2">
                  <span className="text-xs font-extrabold text-resto-terracotta-600 font-display">
                    {formatCurrency(lineTotal)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(product.id)}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Totals Summary */}
      {cart.length > 0 && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          {/* Order Discount Input */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-resto-terracotta-600" />
              {t('pos.discount')} (SAR):
            </span>
            <div className="w-24">
              <Input
                type="number"
                min="0"
                step="1"
                value={orderDiscount}
                onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-right bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>{t('pos.subtotal')}:</span>
            <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>

          {totals.discount > 0 && (
            <div className="flex justify-between text-red-600 font-semibold">
              <span>{t('pos.discount')}:</span>
              <span>-{formatCurrency(totals.discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-500">
            <span>{t('pos.vat')}:</span>
            <span className="font-semibold">{formatCurrency(totals.vatAmount)}</span>
          </div>

          <div className="flex justify-between text-sm font-extrabold text-resto-terracotta-600 pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span>{t('pos.total')}:</span>
            <span className="font-display text-base">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
});
