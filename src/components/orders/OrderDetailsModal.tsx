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
  const lifecycleSteps: Array<{ key: OrderStatus; labelEn: string; labelAr: string }> = [
    { key: 'PENDING', labelEn: 'Pending', labelAr: 'قيد الانتظار' },
    { key: 'CONFIRMED', labelEn: 'Confirmed', labelAr: 'مؤكد' },
    { key: 'PREPARING', labelEn: 'Preparing', labelAr: 'جاري التحضير' },
    { key: 'READY', labelEn: 'Ready', labelAr: 'جاهز' },
    { key: 'COMPLETED', labelEn: 'Completed', labelAr: 'مكتمل' },
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
        return isRtl ? 'تأكيد الطلب' : 'Confirm Order';
      case 'PREPARING':
        return isRtl ? 'بدء التحضير' : 'Start Preparing';
      case 'READY':
        return isRtl ? 'جاهز للتقديم' : 'Mark Ready';
      case 'COMPLETED':
        return isRtl ? 'إكمال الطلب النهائي' : 'Complete Order';
      default:
        return '';
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
      title={isRtl ? `تفاصيل الطلب ${order.order_number}` : `Order Details — ${order.order_number}`}
      description={isRtl ? 'سجل تتبع الطلب والأصناف والمدفوعات' : 'Complete audit breakdown, item snapshot prices, and lifecycle state'}
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
              {isRtl ? 'تتبع دورة حياة الطلب' : 'Order Lifecycle Progression'}
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
                      {isRtl ? step.labelAr : step.labelEn}
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
                <span className="font-bold block">{isRtl ? 'طلب ملغى' : 'Order Cancelled'}</span>
                <span className="text-[11px] text-red-700 dark:text-red-300">
                  {isRtl ? 'السبب:' : 'Reason:'} {order.cancellation_reason || 'OTHER'}
                </span>
              </div>
            </div>
            {order.cancelled_at && (
              <span className="text-[10px] font-mono text-slate-500">
                {new Date(order.cancelled_at).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* 2. Order Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-card border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{isRtl ? 'العميل' : 'Customer'}</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
              {order.customer?.name || 'Walk-in Guest'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{isRtl ? 'نوع الطلب' : 'Order Type'}</span>
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {order.order_type}
            </Badge>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{isRtl ? 'الطاولة' : 'Table'}</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 block">
              {order.table?.table_number || 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">{isRtl ? 'تاريخ الإنشاء' : 'Created Date'}</span>
            <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] block">
              {new Date(order.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3. Items Snapshot Table */}
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isRtl ? 'أصناف الطلب' : 'Order Line Items'} ({order.items?.length || 0})
          </h5>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  {currentUserRole === 'ADMIN' && <th className="p-2.5 text-right text-slate-400">Unit Cost</th>}
                  <th className="p-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                      {item.product?.name || 'Product'}
                    </td>
                    <td className="p-2.5 font-mono text-slate-400 text-[10px]">
                      {item.product?.sku || 'SKU'}
                    </td>
                    <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                    <td className="p-2.5 text-right font-semibold">{formatCurrency(item.unit_price)}</td>
                    {currentUserRole === 'ADMIN' && (
                      <td className="p-2.5 text-right font-mono text-slate-400 text-[11px]">
                        {formatCurrency(item.unit_cost)}
                      </td>
                    )}
                    <td className="p-2.5 text-right font-extrabold text-resto-terracotta-600 font-display">
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
              {isRtl ? 'تفاصيل الدفع' : 'Payment Breakdown'}
            </h5>
            {order.payments?.map(p => (
              <div key={p.id} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="font-bold">{p.payment_method}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={p.status === 'REFUNDED' ? 'destructive' : 'success'}
                    className="text-[9px] px-1.5 py-0"
                  >
                    {p.status}
                  </Badge>
                  <span className="font-extrabold font-display">{formatCurrency(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          <div className="p-3.5 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Discount:</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>VAT Tax (15%):</span>
              <span className="font-semibold">{formatCurrency(order.tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-resto-terracotta-600 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>Total Amount:</span>
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
                {isRtl ? 'إلغاء الطلب' : 'Cancel Order'}
              </Button>
            )}

            {/* Refund Action (Completed Orders - ADMIN/MANAGER Only) */}
            {isCompleted && canRefund && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsRefundModalOpen(true)}
                leftIcon={<RefreshCw className="w-4 h-4 text-resto-terracotta-600" />}
                disabled={order.payments?.every(p => p.status === 'REFUNDED')}
                className="font-bold border-resto-terracotta-500 text-resto-terracotta-600 hover:bg-resto-terracotta-50 dark:hover:bg-slate-800"
              >
                {order.payments?.every(p => p.status === 'REFUNDED')
                  ? (isRtl ? 'تم استرداد المبلغ' : 'Already Refunded')
                  : (isRtl ? 'استرداد المبلغ' : 'Refund Payment')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Advance Status Button */}
            {!isCompleted && !isCancelled && getNextStatus(order.status) && (
              <Button
                variant="primary"
                size="md"
                onClick={handleAdvance}
                isLoading={isSubmitting}
                disabled={isSubmitting}
                rightIcon={<ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />}
                className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
              >
                {getNextStatusLabel(getNextStatus(order.status)!)}
              </Button>
            )}

            <Button variant="ghost" size="md" onClick={onClose}>
              {isRtl ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      </div>

      {/* Cancellation Dialog */}
      <OrderCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        order={order}
        onConfirmCancel={(reason) => onCancelOrder(order.id, reason)}
        isSubmitting={isSubmitting}
      />

      {/* Refund Dialog */}
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
