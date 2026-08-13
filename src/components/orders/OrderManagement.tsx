import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Utensils,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Order, OrderStatus, OrderType, PaymentStatus, CancellationReason } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderDetailsModal } from './OrderDetailsModal';
import { OrderCard } from './OrderCard';

export function OrderManagement() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const currentUserRole = user?.role_name || 'STAFF';

  // Instant Synchronous Cache Initialization for 0ms Mount
  const cachedOrders = DatabaseService.getCachedOrdersSync();
  const [orders, setOrders] = useState<Order[]>(cachedOrders || []);
  const [isLoading, setIsLoading] = useState(!cachedOrders || cachedOrders.length === 0);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentStatus>('ALL');

  const loadOrders = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const data = await DatabaseService.getOrders();
      setOrders(data);
      return data;
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If no cached orders exist, display skeleton loader, otherwise fetch silently in background
    loadOrders(!cachedOrders || cachedOrders.length === 0);
  }, [cachedOrders, loadOrders]);

  const handleOpenDetails = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
    try {
      const fullDetails = await DatabaseService.getOrderDetails(order.id);
      setSelectedOrder(fullDetails);
    } catch (err) {
      console.error('Failed to fetch full order details:', err);
    }
  }, []);

  const handleAdvanceStatus = useCallback(async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await DatabaseService.advanceOrderStatus(orderId, nextStatus, user?.id);
      const updatedList = await loadOrders(false);
      if (updatedList) {
        const updatedOrder = updatedList.find(o => o.id === orderId);
        if (updatedOrder) setSelectedOrder(updatedOrder);
      }
    } catch (err: any) {
      alert(err.message || 'Status transition failed.');
    }
  }, [user, loadOrders]);

  const handleCancelOrder = useCallback(async (orderId: string, reason: CancellationReason) => {
    try {
      await DatabaseService.cancelOrder(orderId, user?.id, reason);
      const updatedList = await loadOrders(false);
      if (updatedList) {
        const updatedOrder = updatedList.find(o => o.id === orderId);
        if (updatedOrder) setSelectedOrder(updatedOrder);
      }
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    }
  }, [user, loadOrders]);

  const handleRefundPayment = useCallback(async (orderId: string) => {
    try {
      await DatabaseService.refundCompletedPayment(orderId, user?.id);
      const updatedList = await loadOrders(false);
      if (updatedList) {
        const updatedOrder = updatedList.find(o => o.id === orderId);
        if (updatedOrder) setSelectedOrder(updatedOrder);
      }
    } catch (err: any) {
      alert(err.message || 'Refund failed.');
    }
  }, [user, loadOrders]);

  const filteredOrders = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return orders.filter(o => {
      const matchesSearch = !term ||
        o.order_number.toLowerCase().includes(term) ||
        (o.customer && o.customer.name.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || o.order_type === typeFilter;
      
      let matchesPayment = true;
      if (paymentFilter !== 'ALL') {
        const orderPaymentStatus = o.payments?.some(p => p.status === 'REFUNDED') ? 'REFUNDED' : 'PAID';
        matchesPayment = orderPaymentStatus === paymentFilter;
      }

      return matchesSearch && matchesStatus && matchesType && matchesPayment;
    });
  }, [orders, deferredSearchTerm, statusFilter, typeFilter, paymentFilter]);

  // Statistics Counters
  const pendingCount = useMemo(() => orders.filter(o => o.status === 'PENDING').length, [orders]);
  const inProgressCount = useMemo(() => orders.filter(o => ['CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length, [orders]);
  const completedCount = useMemo(() => orders.filter(o => o.status === 'COMPLETED').length, [orders]);
  const cancelledCount = useMemo(() => orders.filter(o => o.status === 'CANCELLED').length, [orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-resto-terracotta-600" />
            Order Lifecycle Management
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track order status progression, process cancellations with stock restoration, and execute refunds ({orders.length} Total Orders)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadOrders(true)}
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-resto-terracotta-600" />}
          className="text-xs font-semibold"
        >
          {isRtl ? 'تحديث السجل' : 'Refresh Orders'}
        </Button>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending Orders</span>
            <span className="text-xl font-extrabold font-display text-slate-800 dark:text-slate-100">{pendingCount}</span>
          </div>
          <Clock className="w-6 h-6 text-slate-400" />
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">In Progress</span>
            <span className="text-xl font-extrabold font-display text-amber-800 dark:text-amber-200">{inProgressCount}</span>
          </div>
          <Utensils className="w-6 h-6 text-amber-600" />
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">Completed</span>
            <span className="text-xl font-extrabold font-display text-emerald-800 dark:text-emerald-200">{completedCount}</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>

        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300 block">Cancelled</span>
            <span className="text-xl font-extrabold font-display text-red-800 dark:text-red-200">{cancelledCount}</span>
          </div>
          <XCircle className="w-6 h-6 text-red-600" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Search order number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PREPARING">PREPARING</option>
            <option value="READY">READY</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Order Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">All Order Types</option>
            <option value="TAKEAWAY">Takeaway</option>
            <option value="DINE_IN">Dine-In</option>
            <option value="DELIVERY">Delivery</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PAID">PAID</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredOrders.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            No Orders Found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No restaurant orders match your current filter parameters.
          </p>
        </div>
      )}

      {/* Orders Grid */}
      {!isLoading && filteredOrders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isRtl={isRtl}
              onOpenDetails={handleOpenDetails}
              onAdvanceStatus={handleAdvanceStatus}
            />
          ))}
        </div>
      )}

      {/* Order Details & Audit Modal */}
      <OrderDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        order={selectedOrder}
        currentUserRole={currentUserRole}
        onAdvanceStatus={handleAdvanceStatus}
        onCancelOrder={handleCancelOrder}
        onRefundPayment={handleRefundPayment}
      />
    </div>
  );
}
