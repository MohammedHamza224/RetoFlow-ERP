import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Utensils, Grid, CreditCard, Plus, Trash2, ShieldAlert, ArrowRight } from 'lucide-react';
import { Customer, RestaurantTable } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

export interface PaymentSplitRow {
  payment_method: 'CASH' | 'CARD' | 'MADA' | 'APPLE_PAY' | 'OTHER';
  amount: number;
}

export interface CheckoutPanelProps {
  orderTotal: number;
  customers: Customer[];
  tables: RestaurantTable[];
  onCompleteCheckout: (checkoutPayload: {
    customer_id?: string;
    table_id?: string;
    order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    payments: PaymentSplitRow[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export const CheckoutPanel = React.memo(function CheckoutPanel({
  orderTotal,
  customers,
  tables,
  onCompleteCheckout,
  isSubmitting,
}: CheckoutPanelProps) {
  const { t } = useTranslation();

  // Selection States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c0000000-0000-0000-0000-000000000001');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('TAKEAWAY');
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Payment Modes
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [singleMethod, setSingleMethod] = useState<'CASH' | 'CARD' | 'MADA' | 'APPLE_PAY' | 'OTHER'>('MADA');
  const [splitRows, setSplitRows] = useState<PaymentSplitRow[]>([
    { payment_method: 'CASH', amount: 0 },
    { payment_method: 'MADA', amount: 0 },
  ]);

  const [checkoutError, setCheckoutError] = useState<string>('');

  // Available tables filtering
  const availableTables = tables.filter(t => t.status === 'AVAILABLE');

  useEffect(() => {
    if (orderType === 'DINE_IN' && availableTables.length > 0 && !selectedTableId) {
      setSelectedTableId(availableTables[0].id);
    }
  }, [orderType, availableTables, selectedTableId]);

  // Recalculate split rows when orderTotal changes
  useEffect(() => {
    if (!isSplitPayment) {
      setSplitRows([{ payment_method: singleMethod, amount: orderTotal }]);
    }
  }, [orderTotal, singleMethod, isSplitPayment]);

  const totalPaid = isSplitPayment
    ? splitRows.reduce((sum, r) => sum + r.amount, 0)
    : orderTotal;

  const isPaymentMismatch = Math.abs(totalPaid - orderTotal) > 0.01;

  const handleAddSplitRow = () => {
    setSplitRows([...splitRows, { payment_method: 'CASH', amount: 0 }]);
  };

  const handleRemoveSplitRow = (index: number) => {
    if (splitRows.length <= 1) return;
    setSplitRows(splitRows.filter((_, i) => i !== index));
  };

  const handleUpdateSplitRow = (index: number, key: 'payment_method' | 'amount', value: any) => {
    const nextRows = [...splitRows];
    nextRows[index] = { ...nextRows[index], [key]: value };
    setSplitRows(nextRows);
  };

  const handleCheckout = async () => {
    setCheckoutError('');

    if (orderTotal <= 0) {
      setCheckoutError('Cart total must be greater than 0.');
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTableId) {
      setCheckoutError('Please select an available dining table for Dine-In orders.');
      return;
    }

    if (isPaymentMismatch) {
      setCheckoutError(`Payment mismatch: Total paid (${totalPaid.toFixed(2)}) must equal order total (${orderTotal.toFixed(2)}).`);
      return;
    }

    const paymentsPayload: PaymentSplitRow[] = isSplitPayment
      ? splitRows.filter(r => r.amount > 0)
      : [{ payment_method: singleMethod, amount: orderTotal }];

    try {
      await onCompleteCheckout({
        customer_id: selectedCustomerId,
        table_id: orderType === 'DINE_IN' ? selectedTableId : undefined,
        order_type: orderType,
        payments: paymentsPayload,
      });
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-subtle p-4 space-y-4">
      {checkoutError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {/* 1. Customer Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-resto-terracotta-600" />
          {t('pos.selectCustomer')}
        </label>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
        >
          {customers.filter(c => c.is_active !== false).map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.customer_type}) {c.phone ? `- ${c.phone}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Order Type Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Utensils className="w-3.5 h-3.5 text-resto-terracotta-600" />
          {t('pos.orderType')}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['TAKEAWAY', 'DINE_IN', 'DELIVERY'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setOrderType(type);
                setCheckoutError('');
              }}
              className={`py-2 px-2 min-h-[40px] flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${
                orderType === type
                  ? 'bg-resto-terracotta-600 text-white border-resto-terracotta-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {type === 'DINE_IN' ? t('pos.dineIn') : type === 'TAKEAWAY' ? t('pos.takeaway') : t('pos.delivery')}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Table Selection (For DINE_IN Only) */}
      {orderType === 'DINE_IN' && (
        <div className="space-y-1.5 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-amber-600" />
            {t('pos.selectTable')} *
          </label>
          {availableTables.length === 0 ? (
            <p className="text-[11px] text-red-600 font-semibold">{t('pos.noAvailableTables')}</p>
          ) : (
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full rounded-lg border border-amber-300 dark:border-amber-800 bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {availableTables.map(tbl => (
                <option key={tbl.id} value={tbl.id}>
                  {tbl.table_number} ({tbl.capacity} Seats - {tbl.location})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 4. Payment Selection */}
      <div className="space-y-2 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-resto-terracotta-600" />
              {t('pos.paymentMethod')}
            </label>
            <button
              type="button"
              onClick={() => setIsSplitPayment(!isSplitPayment)}
              className="text-[11px] font-bold text-resto-terracotta-600 hover:underline"
            >
              {isSplitPayment ? t('pos.singlePayment') : t('pos.splitPayment')}
            </button>
          </div>

          {!isSplitPayment ? (
            <div className="grid grid-cols-3 gap-1.5">
              {(['MADA', 'CASH', 'CARD', 'APPLE_PAY', 'OTHER'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSingleMethod(method)}
                  className={`py-2 px-1 min-h-[40px] flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${
                    singleMethod === method
                      ? 'bg-resto-charcoal-800 text-white border-resto-charcoal-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {splitRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.payment_method}
                    onChange={(e) => handleUpdateSplitRow(idx, 'payment_method', e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-2 py-1 text-xs"
                  >
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                    <option value="MADA">MADA</option>
                    <option value="APPLE_PAY">APPLE_PAY</option>
                    <option value="OTHER">OTHER</option>
                  </select>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => handleUpdateSplitRow(idx, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-1/2 h-7 text-xs text-right"
                  />

                  {splitRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplitRow(idx)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddSplitRow}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="w-full text-xs text-resto-terracotta-600"
              >
                {t('pos.addPaymentRow')}
              </Button>
            </div>
          )}
        </div>

        {/* Total & Complete Checkout CTA */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Total Payable:</span>
            <span className="text-base font-extrabold text-resto-terracotta-600 font-display">
              {formatCurrency(orderTotal)}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleCheckout}
            isLoading={isSubmitting}
            disabled={orderTotal <= 0 || isSubmitting}
            rightIcon={<ArrowRight className="w-5 h-5" />}
            className="w-full bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
          >
            {isSubmitting ? t('pos.processing') : t('pos.completeOrder')}
          </Button>
        </div>
      </div>
    </div>
  );
});
