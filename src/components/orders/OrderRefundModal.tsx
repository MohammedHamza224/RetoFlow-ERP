import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, Receipt } from 'lucide-react';
import { Order } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface OrderRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirmRefund: () => Promise<void>;
  isSubmitting: boolean;
}

export function OrderRefundModal({
  isOpen,
  onClose,
  order,
  onConfirmRefund,
  isSubmitting,
}: OrderRefundModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [error, setError] = useState('');

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await onConfirmRefund();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to refund payment.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `استرداد المبلغ النهائي (${order.order_number})` : `Full Payment Refund (${order.order_number})`}
      description={isRtl ? 'استرداد كامل المبلغ مدعوم فقط للطلبات المكتملة المدفوعة.' : 'Full refund updates payment status to REFUNDED while preserving original order audit history.'}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 select-none">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span>{isRtl ? 'رقم الطلب:' : 'Order Number:'}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{order.order_number}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>{isRtl ? 'المبلغ المسترد (كامل):' : 'Full Refund Amount:'}</span>
            <span className="font-display font-extrabold text-resto-terracotta-600 text-sm">
              {formatCurrency(order.total)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>{isRtl ? 'نوع العملية:' : 'Refund Scope:'}</span>
            <span className="font-bold text-amber-600">FULL REFUND ONLY</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{isRtl ? 'تنبيه الحفظ المالي:' : 'Audit Preservation Policy:'}</span>
          </div>
          <p className="text-[11px] text-blue-800 dark:text-blue-300">
            {isRtl
              ? 'سيتم تغيير حالة الدفع إلى "مسترد". سيظل سجل الطلب الأصلي والتكلفة التاريخية كما هما لأغراض المراجعة.'
              : 'Payment status will change to REFUNDED. Order details and historical snapshot costs will remain preserved for audit.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="md" type="button" onClick={onClose}>
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="font-bold bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-white"
          >
            {isSubmitting ? (isRtl ? 'جاري الاسترداد...' : 'Refunding...') : (isRtl ? 'تأكيد الاسترداد المالي' : 'Confirm Full Refund')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
