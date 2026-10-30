import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingCart, CreditCard, ArrowRight } from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Product, Category, Customer, RestaurantTable } from '@/types/database.types';
import { calculateOrderTotals, DEFAULT_VAT_RATE } from '@/config/tax.config';
import { formatCurrency, cn } from '@/lib/utils';
import { ProductCatalog } from './ProductCatalog';
import { CartPanel, CartItem } from './CartPanel';
import { CheckoutPanel, PaymentSplitRow } from './CheckoutPanel';
import { OrderSuccessModal } from './OrderSuccessModal';
import { Skeleton } from '@/components/ui/Skeleton';

export function PosWorkspace() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Mobile / Tablet Panel Switcher State ('catalog' | 'cart' | 'checkout')
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'cart' | 'checkout'>('catalog');

  // Instant Synchronous Cache Initialization for 0ms Instant Render
  const cachedProds = DatabaseService.getCachedProductsSync();
  const cachedCats = DatabaseService.getCachedCategoriesSync();
  const cachedCusts = DatabaseService.getCachedCustomersSync();
  const cachedTbls = DatabaseService.getCachedTablesSync();

  const [products, setProducts] = useState<Product[]>(cachedProds || []);
  const [categories, setCategories] = useState<Category[]>(cachedCats || []);
  const [customers, setCustomers] = useState<Customer[]>(cachedCusts || []);
  const [tables, setTables] = useState<RestaurantTable[]>(cachedTbls || []);

  // Only show skeleton if NO cached data is available on initial mount
  const [isLoading, setIsLoading] = useState(!cachedProds || cachedProds.length === 0);

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Modal State
  const [successModalData, setSuccessModalData] = useState<any>(null);

  const loadPosData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [prods, cats, custs, tbls] = await Promise.all([
        DatabaseService.getProducts(),
        DatabaseService.getCategories(),
        DatabaseService.getCustomers(),
        DatabaseService.getTables(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setCustomers(custs);
      setTables(tbls);
    } catch (err) {
      console.error('Failed to initialize POS data:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If we had no cache, load with skeleton, otherwise fetch silently in background
    const cached = DatabaseService.getCachedProductsSync();
    loadPosData(!cached || cached.length === 0);
  }, [loadPosData]);

  const handleAddToCart = useCallback((product: Product) => {
    if (!product.is_active || product.stock_quantity <= 0) return;

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty >= product.stock_quantity) {
          alert(t('pos.quantityExceedsStock'));
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + 1,
        };
        return updated;
      } else {
        return [...prevCart, { product, quantity: 1, discount: 0 }];
      }
    });
  }, [t]);

  const handleUpdateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart
        .map(item => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > item.product.stock_quantity) {
              alert(t('pos.quantityExceedsStock'));
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  }, [t]);

  const handleRemoveItem = useCallback((productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCart([]);
    setOrderDiscount(0);
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity) - item.discount, 0);
  const totals = calculateOrderTotals(subtotal, orderDiscount, DEFAULT_VAT_RATE);

  const handleCompleteCheckout = useCallback(async (payload: {
    customer_id?: string;
    table_id?: string;
    order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    payments: PaymentSplitRow[];
  }) => {
    if (cart.length === 0) return;

    setIsSubmitting(true);

    try {
      const itemsPayload = cart.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        discount: i.discount,
      }));

      const res = await DatabaseService.executeCheckout({
        user_id: user?.id,
        customer_id: payload.customer_id,
        table_id: payload.table_id,
        order_type: payload.order_type,
        items: itemsPayload,
        payments: payload.payments,
        discount: orderDiscount,
      });

      if (res && res.success) {
        const customerObj = customers.find(c => c.id === payload.customer_id);
        const tableObj = tables.find(t => t.id === payload.table_id);

        // 1. Immediately display order success modal & receipt from RPC response
        setSuccessModalData({
          order_number: res.order_number,
          customer_name: customerObj?.name || 'Walk-in Guest',
          order_type: payload.order_type,
          table_name: tableObj?.table_number,
          total: totals.total,
          subtotal: totals.subtotal,
          discount: totals.discount,
          vat_amount: totals.vatAmount,
          cashier_name: user?.name || 'Cashier',
          items: cart.map(i => ({
            name: i.product.name,
            quantity: i.quantity,
            unit_price: i.product.price,
            total: (i.product.price * i.quantity) - i.discount,
          })),
          payments: payload.payments,
          created_at: new Date().toISOString(),
        });

        // 2. Clear cart & remove loading state immediately
        handleClearCart();
        setIsSubmitting(false);

        // 3. Trigger background catalog & table state refresh asynchronously (non-blocking)
        loadPosData(false).catch(err => console.warn('Background POS data refresh warning:', err));
        return;
      }
    } catch (err: any) {
      alert(err.message || 'Checkout execution failed.');
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, orderDiscount, user, customers, tables, totals, handleClearCart, loadPosData]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6rem)]">
        <Skeleton className="h-full rounded-xl" />
        <Skeleton className="h-full rounded-xl" />
        <Skeleton className="h-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] h-[calc(100dvh-6rem)] min-h-[500px] select-none">
      {/* Mobile / Tablet View Switcher Tab Bar (< lg) */}
      <div className="lg:hidden flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 text-xs font-bold shrink-0 border border-slate-200 dark:border-slate-700">
        {/* Catalog button: only needed on mobile (< md), since Tablet (md..lg) always shows Catalog on the left */}
        <button
          type="button"
          onClick={() => setActiveMobileTab('catalog')}
          className={cn(
            'md:hidden flex-1 py-2 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 min-h-[42px]',
            activeMobileTab === 'catalog'
              ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          )}
        >
          <Utensils className="w-3.5 h-3.5 shrink-0" />
          <span>{t('pos.catalog') || 'Catalog'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('cart')}
          className={cn(
            'flex-1 py-2 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 min-h-[42px] relative',
            activeMobileTab === 'cart' || (activeMobileTab === 'catalog' && 'md:bg-resto-charcoal-800 md:text-white md:dark:bg-slate-700 md:shadow-sm')
              ? activeMobileTab === 'cart'
                ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 md:bg-resto-charcoal-800 md:text-white md:dark:bg-slate-700 md:shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          )}
        >
          <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
          <span>{t('pos.cartTitle') || 'Cart'}</span>
          {cartItemCount > 0 && (
            <span className="bg-resto-terracotta-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {cartItemCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('checkout')}
          className={cn(
            'flex-1 py-2 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 min-h-[42px]',
            activeMobileTab === 'checkout'
              ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          )}
        >
          <CreditCard className="w-3.5 h-3.5 shrink-0" />
          <span>{t('pos.checkout') || 'Checkout'}</span>
          {totals.total > 0 && (
            <span className="text-[10px] font-mono opacity-80 hidden sm:inline">
              ({formatCurrency(totals.total)})
            </span>
          )}
        </button>
      </div>

      {/* POS Panels Grid (Mobile: 1 Active Tab | Tablet md..lg: 2-Col Split [Catalog + Cart/Checkout] | Desktop lg+: 3-Col Split) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-3 lg:gap-4">
        {/* LEFT: Product Catalog (Always visible on Tablet md:col-span-7 and Desktop lg:col-span-5) */}
        <div
          className={cn(
            'h-full overflow-hidden md:col-span-7 lg:col-span-5',
            activeMobileTab === 'catalog' ? 'flex flex-col' : 'hidden md:flex md:flex-col'
          )}
        >
          <ProductCatalog
            products={products}
            categories={categories}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* CENTER: Shopping Cart (Visible on Tablet md:col-span-5 when not on checkout, and always on Desktop lg:col-span-4) */}
        <div
          className={cn(
            'h-full overflow-hidden md:col-span-5 lg:col-span-4',
            activeMobileTab === 'cart'
              ? 'flex flex-col'
              : activeMobileTab === 'catalog'
              ? 'hidden md:flex md:flex-col lg:flex lg:flex-col'
              : 'hidden lg:flex lg:flex-col'
          )}
        >
          <CartPanel
            cart={cart}
            orderDiscount={orderDiscount}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onUpdateDiscount={setOrderDiscount}
            onProceedToCheckout={() => setActiveMobileTab('checkout')}
          />
        </div>

        {/* RIGHT: Customer & Checkout Panel (Visible on Tablet md:col-span-5 when checkout tab active, and always on Desktop lg:col-span-3) */}
        <div
          className={cn(
            'h-full overflow-hidden md:col-span-5 lg:col-span-3',
            activeMobileTab === 'checkout' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          )}
        >
          <CheckoutPanel
            orderTotal={totals.total}
            customers={customers}
            tables={tables}
            onCompleteCheckout={handleCompleteCheckout}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Mobile Floating Quick Bar (Appears on phones < md when Catalog tab is active and Cart has items) */}
      {activeMobileTab === 'catalog' && cartItemCount > 0 && (
        <div className="md:hidden sticky bottom-2 z-20 pt-2 pb-safe">
          <button
            type="button"
            onClick={() => setActiveMobileTab('cart')}
            className="w-full bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-white p-3.5 rounded-xl shadow-elevated flex items-center justify-between font-bold text-xs sm:text-sm animate-in slide-in-from-bottom-2 duration-200 min-h-[48px]"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {cartItemCount} {t('pos.itemsInCart') || 'items'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">{formatCurrency(totals.total)}</span>
              <span className="text-[11px] font-semibold underline underline-offset-2 flex items-center gap-1">
                {t('pos.viewCart') || 'View Cart'}
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Success Modal & Thermal Receipt */}
      <OrderSuccessModal
        isOpen={Boolean(successModalData)}
        onClose={() => setSuccessModalData(null)}
        orderData={successModalData}
      />
    </div>
  );
}
