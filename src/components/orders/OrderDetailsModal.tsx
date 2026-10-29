import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  User,
  Utensils,
  Grid,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Ban,
  ShieldAlert,
} from 'lucide-react';
import { Order, OrderStatus, CancellationReason } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderCancelModal } from './OrderCancelModal';
import { OrderRefundModal } from './OrderRefundModal';

export interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  currentUserRole: string;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onCancelOrder: (orderId: string, reason: CancellationReason) => Promise<void>;
  onRefundPayment: (orderId: string) => Promise<void>;
}

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  currentUserRole,
  onAdvanceStatus,
  onCancelOrder,
  onRefundPayment,
}: OrderDetailsModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!order) return null;

  const canRefund = (currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER');
  const isCompleted = order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';

  // Lifecycle progression sequence
  const lifecycleSteps: Array<{ key: OrderStatus; label: string }> = [
    { key: 'PENDING', label: t('status.PENDING') },
    { key: 'CONFIRMED', label: t('status.CONFIRMED') },
    { key: 'PREPARING', label: t('status.PREPARING') },
    { key: 'READY', label: t('status.READY') },
    { key: 'COMPLETED', label: t('status.COMPLETED') },
  ];

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    switch (status) {
      case 'PENDING':
        return 'CONFIRMED';
      case 'CONFIRMED':
        return 'PREPARING';
      case 'PREPARING':
        return 'READY';
      case 'READY':
        return 'COMPLETED';
      default:
        return null;
    }
  };

  const getNextStatusLabel = (nextStatus: OrderStatus) => {
    switch (nextStatus) {
      case 'CONFIRMED':
        return t('orders.nextStatusConfirm');
      case 'PREPARING':
        return t('orders.nextStatusPrepare');
      case 'READY':
        return t('orders.nextStatusReady');
      case 'COMPLETED':
        return t('orders.nextStatusComplete');
      default:
        return '';
    }
  };

  const translateOrderType = (type: string) => {
    switch (type) {
      case 'DINE_IN': return t('orderType.DINE_IN');
      case 'TAKEAWAY': return t('orderType.TAKEAWAY');
      case 'DELIVERY': return t('orderType.DELIVERY');
      default: return type;
    }
  };

  const translatePaymentMethod = (method: string) => {
    const key = `paymentMethod.${method}`;
    const translated = t(key);
    return translated !== key ? translated : method;
  };

  const translateCancellationReason = (reason?: string | null) => {
    if (!reason) return t('orders.reasonOther');
    switch (reason) {
      case 'CUSTOMER_REQUEST': return t('orders.reasonCustomer');
      case 'OUT_OF_STOCK': return t('orders.reasonOutOfStock');
      case 'DUPLICATE_ORDER': return t('orders.reasonDuplicate');
      case 'WRONG_ORDER': return t('orders.reasonWrong');
      default: return t('orders.reasonOther');
    }
  };

  const handleAdvance = async () => {
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;

    setActionError('');
    setIsSubmitting(true);
    try {
      await onAdvanceStatus(order.id, nextStatus);
    } catch (err: any) {
      setActionError(err.message || 'Status transition failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = lifecycleSteps.findIndex(s => s.key === order.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('orders.orderDetailsTitle')} — ${order.order_number}`}
      description={t('orders.orderDetailsDesc')}
      maxWidth="lg"
    >
      <div className="space-y-6 py-2 select-none">
        {actionError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 1. Visual Lifecycle Timeline */}
        {!isCancelled && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('orders.lifecycleProgression')}
            </h5>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {lifecycleSteps.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div key={step.key} className="space-y-1.5">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-resto-terracotta-600 ring-2 ring-resto-terracotta-500/30'
                          : isPassed
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold block leading-tight ${
                        isCurrent
                          ? 'text-resto-terracotta-600 font-extrabold'
                          : isPassed
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <span className="font-bold block">{t('orders.orderCancelled')}</span>
                <span className="text-[11px] text-red-700 dark:text-red-300">
                  {t('orders.reason')}: {translateCancellationReason(order.cancellation_reason)}
                </span>
              </div>
            </div>
            {order.cancelled_at && (
              <span className="text-[10px] font-mono text-slate-500">
                {new Date(order.cancelled_at).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
              </span>
            )}
          </div>
        )}

        {/* 2. Order Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-card border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('orders.customer')}</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
              {order.customer?.name || t('pos.walkInGuest')}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('orders.orderType')}</span>
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {translateOrderType(order.order_type)}
            </Badge>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('orders.table')}</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 block">
              {order.table?.table_number || (isRtl ? 'غير محدد' : 'N/A')}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('orders.createdDate')}</span>
            <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] block">
              {new Date(order.created_at).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
            </span>
          </div>
        </div>

        {/* 3. Items Snapshot Table */}
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('orders.lineItems')} ({order.items?.length || 0})
          </h5>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
            <table className="w-full text-start">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 text-start">{t('orders.itemName')}</th>
                  <th className="p-2.5 text-start">{t('orders.sku')}</th>
                  <th className="p-2.5 text-center">{t('orders.qty')}</th>
                  <th className="p-2.5 text-end">{t('orders.unitPrice')}</th>
                  {currentUserRole === 'ADMIN' && <th className="p-2.5 text-end text-slate-400">{t('orders.unitCost')}</th>}
                  <th className="p-2.5 text-end">{t('orders.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                      {item.product?.name || t('inventory.product')}
                    </td>
                    <td className="p-2.5 font-mono text-slate-400 text-[10px]">
                      {item.product?.sku || 'SKU'}
                    </td>
                    <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                    <td className="p-2.5 text-end font-semibold">{formatCurrency(item.unit_price)}</td>
                    {currentUserRole === 'ADMIN' && (
                      <td className="p-2.5 text-end font-mono text-slate-400 text-[11px]">
                        {formatCurrency(item.unit_cost)}
                      </td>
                    )}
                    <td className="p-2.5 text-end font-extrabold text-resto-terracotta-600 font-display">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Financial Totals & Payments Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Payment Method Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <h5 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              {t('orders.paymentBreakdown')}
            </h5>
            {order.payments?.map(p => (
              <div key={p.id} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="font-bold">{translatePaymentMethod(p.payment_method)}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={p.status === 'REFUNDED' ? 'destructive' : 'success'}
                    className="text-[9px] px-1.5 py-0"
                  >
                    {p.status === 'REFUNDED' ? t('status.REFUNDED') : t('status.PAID')}
                  </Badge>
                  <span className="font-extrabold font-display">{formatCurrency(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          <div className="p-3.5 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{t('orders.subtotal')}:</span>
              <span className="font-semibold">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>{t('orders.discount')}:</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>{t('orders.vat')}:</span>
              <span className="font-semibold">{formatCurrency(order.tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-resto-terracotta-600 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>{t('orders.totalAmount')}:</span>
              <span className="font-display text-base">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* 5. Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {/* Cancellation Action (Uncompleted Orders) */}
            {!isCompleted && !isCancelled && (
              <Button
                variant="destructive"
                size="md"
                onClick={() => setIsCancelModalOpen(true)}
                leftIcon={<Ban className="w-4 h-4" />}
                className="font-bold bg-red-600 hover:bg-red-700"
              >
                {t('orders.cancelOrder')}
              </Button>
            )}

            {/* Refund Action (Completed Orders with Role Restrict) */}
            {isCompleted && canRefund && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsRefundModalOpen(true)}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="font-bold border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                {t('orders.refundPayment')}
              </Button>
            )}
          </div>

          {/* Advance Status Button */}
          {!isCompleted && !isCancelled && (
            <Button
              variant="primary"
              size="md"
              onClick={handleAdvance}
              disabled={isSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {isSubmitting ? t('common.loading') : getNextStatusLabel(getNextStatus(order.status) || 'COMPLETED')}
            </Button>
          )}
        </div>
      </div>

      {/* Sub-Modals for Cancellation and Refund */}
      <OrderCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        order={order}
        onConfirmCancel={(reason) => onCancelOrder(order.id, reason)}
        isSubmitting={isSubmitting}
      />

      <OrderRefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        order={order}
        onConfirmRefund={() => onRefundPayment(order.id)}
        isSubmitting={isSubmitting}
      />
    </Modal>
  );
}
