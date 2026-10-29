import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { CancellationReason, Order } from '@/types/database.types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface OrderCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirmCancel: (reason: CancellationReason) => Promise<void>;
  isSubmitting: boolean;
}

export function OrderCancelModal({
  isOpen,
  onClose,
  order,
  onConfirmCancel,
  isSubmitting,
}: OrderCancelModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [selectedReason, setSelectedReason] = useState<CancellationReason>('CUSTOMER_REQUEST');
  const [error, setError] = useState('');

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedReason) {
      setError(isRtl ? 'يرجى اختيار سبب الإلغاء.' : 'Please select a cancellation reason.');
      return;
    }

    try {
      await onConfirmCancel(selectedReason);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order.');
    }
  };

  const reasons: Array<{ value: CancellationReason; label: string }> = [
    { value: 'CUSTOMER_REQUEST', label: t('orders.reasonCustomer') },
    { value: 'OUT_OF_STOCK', label: t('orders.reasonOutOfStock') },
    { value: 'DUPLICATE_ORDER', label: t('orders.reasonDuplicate') },
    { value: 'WRONG_ORDER', label: t('orders.reasonWrong') },
    { value: 'OTHER', label: t('orders.reasonOther') },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('orders.cancelModalTitle')} (${order.order_number})`}
      description={t('orders.cancelModalDesc')}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 select-none">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t('orders.cancellationWarning')}</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            {t('orders.cancellationWarningMsg')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t('orders.cancellationReason')}
          </label>
          <div className="space-y-1.5">
            {reasons.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedReason === r.value
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 font-bold text-red-900 dark:text-red-200'
                    : 'bg-card border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="cancellationReason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="text-red-600 focus:ring-red-500"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="md" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>

          <Button
            variant="destructive"
            size="md"
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="font-bold bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? t('common.loading') : t('orders.confirmCancelBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
