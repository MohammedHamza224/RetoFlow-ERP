import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getCompanySettings, ZatcaQrCode } from '@/components/print/PrintPortal';

export interface ReceiptItem {
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ReceiptPayment {
  payment_method: string;
  amount: number;
  status?: string;
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
  thermalSize?: 'thermal-80mm' | 'thermal-58mm';
  orderStatus?: string;
  cancellationReason?: string | null;
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
      thermalSize = 'thermal-80mm',
      orderStatus,
      cancellationReason,
    },
    ref
  ) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const company = getCompanySettings();
    const is58mm = thermalSize === 'thermal-58mm';
    const isRefunded = payments.some((p) => p.status === 'REFUNDED');
    const isCancelled = orderStatus === 'CANCELLED';

    const translateOrderType = (type: string) => {
      const key = `orderType.${type}`;
      const tr = t(key);
      return tr !== key ? tr : type;
    };

    const translatePaymentMethod = (method: string) => {
      const key = `paymentMethod.${method}`;
      const tr = t(key);
      return tr !== key ? tr : method;
    };

    return (
      <div
        ref={ref}
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`${
          is58mm ? 'w-[58mm] text-[10px] p-2.5' : 'w-[80mm] text-xs p-3.5 sm:p-4'
        } max-w-full min-h-[95mm] bg-white text-black font-mono leading-snug shadow-md border border-slate-200 mx-auto select-none print:shadow-none print:border-none print:mx-0 print:w-full print:max-w-none print:p-1`}
        style={{ fontFamily: isRtl ? "'Cairo', 'Courier New', monospace" : "'Courier New', Courier, monospace" }}
      >
        {/* Company & Tax Header */}
        <div className="text-center space-y-1 pb-2.5 border-b border-dashed border-black">
          <div className="flex items-center justify-center gap-1.5">
            <ChefHat className="w-4 h-4 text-black shrink-0" />
            <span className={`${is58mm ? 'text-sm' : 'text-base'} font-extrabold tracking-wide uppercase`}>
              {company.restaurantName}
            </span>
          </div>
          <p className="text-[10px] font-bold">
            {isRefunded
              ? isRtl
                ? 'إشعار دائن / إيصال استرداد ضريبي مبسط'
                : 'Simplified Tax Credit / Refund Receipt'
              : isRtl
              ? 'فاتورة ضريبية مبسطة (Simplified Tax Invoice)'
              : t('receipt.title', 'Simplified Tax Invoice')}
          </p>
          <p className="text-[9.5px]">
            {isRtl ? `الرقم الضريبي: ${company.vatNumber}` : `VAT Reg No: ${company.vatNumber}`}
          </p>
          {company.address && <p className="text-[9px] text-slate-700">{company.address}</p>}
          {company.phone && <p className="text-[9px] text-slate-700">Tel: {company.phone}</p>}
        </div>

        {/* Status Banner if Cancelled or Refunded */}
        {(isCancelled || isRefunded) && (
          <div className="my-1.5 py-1 px-2 border border-black text-center font-bold text-[10px] uppercase">
            {isCancelled
              ? isRtl
                ? `طلب ملغى (${cancellationReason || ''})`
                : `CANCELLED ORDER (${cancellationReason || ''})`
              : isRtl
              ? 'تم استرداد المبلغ (REFUNDED)'
              : 'PAYMENT REFUNDED'}
          </div>
        )}

        {/* Order Metadata */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[10.5px]">
          <div className="flex justify-between font-bold text-xs">
            <span>{t('receipt.orderNo', isRtl ? 'رقم الطلب:' : 'Order No:')}</span>
            <span className="font-mono">{orderNumber}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('receipt.date', isRtl ? 'التاريخ:' : 'Date:')}</span>
            <span className="font-mono text-[10px]">
              {new Date(createdAt).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('receipt.cashier', isRtl ? 'الكاشير:' : 'Cashier:')}</span>
            <span className="truncate">{cashierName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('receipt.customer', isRtl ? 'العميل:' : 'Customer:')}</span>
            <span className="truncate">{customerName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('receipt.type', isRtl ? 'نوع الطلب:' : 'Type:')}</span>
            <span className="font-semibold">
              {translateOrderType(orderType)} {tableName ? `(${tableName})` : ''}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-2 border-b border-dashed border-black">
          <div className="flex justify-between font-bold border-b border-black pb-1 mb-1 text-[10px]">
            <span className="w-1/2 text-start">{t('receipt.item', isRtl ? 'الصنف' : 'Item')}</span>
            <span className="w-1/6 text-center">{t('receipt.qty', isRtl ? 'الكمية' : 'Qty')}</span>
            <span className="w-1/3 text-end">{t('receipt.total', isRtl ? 'الإجمالي' : 'Total')}</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="py-0.5 text-[10.5px] print-avoid-break">
              <div className="flex justify-between items-start gap-1">
                <span className="w-1/2 font-semibold break-words leading-tight text-start">{item.name}</span>
                <span className="w-1/6 text-center font-mono">{item.quantity}</span>
                <span className="w-1/3 text-end font-mono font-semibold">{formatCurrency(item.total)}</span>
              </div>
              <div className="text-[9px] text-slate-600 font-mono">
                @ {formatCurrency(item.unit_price)} {item.sku ? `• ${item.sku}` : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Totals Breakdown */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[10.5px] print-avoid-break">
          <div className="flex justify-between">
            <span>{t('receipt.subtotal', isRtl ? 'المجموع الفرعي:' : 'Subtotal:')}</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between font-semibold">
              <span>{t('receipt.discount', isRtl ? 'الخصم:' : 'Discount:')}</span>
              <span className="font-mono">-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t('receipt.vat', isRtl ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):')}</span>
            <span className="font-mono">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-black">
            <span>{t('receipt.grandTotal', isRtl ? 'الإجمالي شامل الضريبة:' : 'Grand Total:')}</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[10.5px] print-avoid-break">
          <span className="font-bold block">
            {t('receipt.paymentMethods', isRtl ? 'طرق الدفع:' : 'Payment Methods:')}
          </span>
          {payments.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>
                {translatePaymentMethod(p.payment_method)}
                {p.status === 'REFUNDED' ? (isRtl ? ' (مسترد)' : ' (REFUNDED)') : ''}:
              </span>
              <span className="font-mono font-semibold">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>

        {/* ZATCA QR Code & Footer */}
        <div className="text-center pt-3 space-y-2 print-avoid-break">
          <ZatcaQrCode
            sellerName={company.restaurantName}
            vatNumber={company.vatNumber}
            timestamp={createdAt}
            totalWithVat={total}
            vatAmount={vatAmount}
            size={is58mm ? 68 : 80}
          />
          <div className="space-y-0.5">
            <p className="text-[9.5px] font-bold">Thank you for dining with us!</p>
            <p className="text-[9.5px] font-bold">شكراً لزيارتكم ونتمنى لكم يوماً سعيداً</p>
          </div>
        </div>
      </div>
    );
  }
);

PrintableReceipt.displayName = 'PrintableReceipt';
