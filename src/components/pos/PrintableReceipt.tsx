import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ReceiptPayment {
  payment_method: string;
  amount: number;
}

export interface PrintableReceiptProps {
  orderNumber: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  orderType: string;
  tableName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  vatAmount: number;
  total: number;
  payments: ReceiptPayment[];
}

export const PrintableReceipt = React.forwardRef<HTMLDivElement, PrintableReceiptProps>(
  (
    {
      orderNumber,
      createdAt,
      cashierName,
      customerName,
      orderType,
      tableName,
      items,
      subtotal,
      discount,
      vatAmount,
      total,
      payments,
    },
    ref
  ) => {
    const { t } = useTranslation();

    return (
      <div
        ref={ref}
        className="w-[80mm] min-h-[100mm] bg-white text-black p-4 font-mono text-xs leading-tight shadow-lg border border-slate-200 mx-auto select-none print:shadow-none print:border-none print:w-full print:p-0"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Header */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-black">
          <div className="flex items-center justify-center gap-1">
            <ChefHat className="w-5 h-5 text-black" />
            <span className="text-base font-bold tracking-wider">RESTOFLOW</span>
          </div>
          <p className="text-[10px]">{t('receipt.title')}</p>
          <p className="text-[10px]">{t('receipt.vatReg')}</p>
        </div>

        {/* Order Details */}
        <div className="py-2.5 border-b border-dashed border-black space-y-1 text-[11px]">
          <div className="flex justify-between font-bold text-sm">
            <span>{t('receipt.orderNo')}</span>
            <span>{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('receipt.date')}</span>
            <span>{new Date(createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('receipt.cashier')}</span>
            <span>{cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('receipt.customer')}</span>
            <span>{customerName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('receipt.type')}</span>
            <span>{orderType} {tableName ? `(${tableName})` : ''}</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-2 border-b border-dashed border-black">
          <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
            <span className="w-1/2">{t('receipt.item')}</span>
            <span className="w-1/6 text-center">{t('receipt.qty')}</span>
            <span className="w-1/3 text-right">{t('receipt.total')}</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between py-0.5">
              <span className="w-1/2 truncate">{item.name}</span>
              <span className="w-1/6 text-center">{item.quantity}</span>
              <span className="w-1/3 text-right">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>{t('receipt.subtotal')}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between font-semibold text-red-600">
              <span>{t('receipt.discount')}</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t('receipt.vat')}</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
            <span>{t('receipt.grandTotal')}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
          <span className="font-bold block">{t('receipt.paymentMethods')}</span>
          {payments.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{p.payment_method}:</span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-3 space-y-1">
          <p className="text-[10px] font-bold">Thank you for dining with us!</p>
          <p className="text-[9px] text-slate-600">شكراً لزيارتكم ونتمنى لكم يومًا سعيداً</p>
        </div>
      </div>
    );
  }
);

PrintableReceipt.displayName = 'PrintableReceipt';
