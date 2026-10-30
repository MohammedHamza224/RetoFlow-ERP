import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Order } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import {
  getCompanySettings,
  PrintPageSize,
  PrintPortal,
  PrintPreviewToolbar,
  ZatcaQrCode,
} from './PrintPortal';
import { PrintableReceipt } from '@/components/pos/PrintableReceipt';

export interface PrintableSalesInvoiceProps {
  order: Order;
  onClose?: () => void;
  defaultSize?: PrintPageSize;
}

function SalesA4InvoiceBody({
  order,
  isRtl,
  t,
}: {
  order: Order;
  isRtl: boolean;
  t: any;
}) {
  const company = getCompanySettings();
  const isRefunded = order.payments?.some((p) => p.status === 'REFUNDED') || false;
  const isCancelled = order.status === 'CANCELLED';

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

  const translateCancellationReason = (reason?: string | null) => {
    if (!reason) return t('orders.reasonOther');
    switch (reason) {
      case 'CUSTOMER_REQUEST':
        return t('orders.reasonCustomer');
      case 'OUT_OF_STOCK':
        return t('orders.reasonOutOfStock');
      case 'DUPLICATE_ORDER':
        return t('orders.reasonDuplicate');
      case 'WRONG_ORDER':
        return t('orders.reasonWrong');
      default:
        return t('orders.reasonOther');
    }
  };

  const items = order.items || [];
  const payments = order.payments || [];

  return (
    <div
      className="p-4 sm:p-6 md:p-8 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:m-0 print:w-full"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start pb-5 border-b-2 border-slate-900 gap-4 print-avoid-break">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-display">
              {company.restaurantName}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold">
              POS & ERP
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {isRtl
              ? 'فاتورة مبيعات ضريبية وإيصال مالي رسمي'
              : company.tagline || 'Official Tax Sales Invoice & Financial Statement'}
          </p>
          <div className="mt-2 text-[11px] text-slate-700 space-y-0.5">
            <p className="font-mono font-semibold">
              {isRtl ? `الرقم الضريبي للمنشأة: ${company.vatNumber}` : `Tax / VAT Number: ${company.vatNumber}`}
            </p>
            <p>{company.address}</p>
            {company.phone && (
              <p className="font-mono">{isRtl ? `الهاتف: ${company.phone}` : `Phone: ${company.phone}`}</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-4 w-full sm:w-auto justify-between sm:justify-end print:justify-end">
          <div className="text-start sm:text-end print:text-end">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              {isRefunded
                ? isRtl
                  ? 'إشعار دائن ضريبي / إيصال استرداد'
                  : 'Tax Credit Note / Refund Invoice'
                : isCancelled
                ? isRtl
                  ? 'بيان طلب ملغى'
                  : 'Cancelled Order Statement'
                : isRtl
                ? 'فاتورة مبيعات ضريبية'
                : 'Tax Sales Invoice'}
            </h1>
            <p className="font-mono text-base font-bold text-resto-terracotta-600 mt-0.5">
              {order.order_number}
            </p>
            <div className="flex items-center gap-1.5 mt-2 justify-start sm:justify-end print:justify-end flex-wrap">
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  isCancelled
                    ? 'text-rose-700 bg-rose-50 border-rose-300'
                    : order.status === 'COMPLETED'
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                    : 'text-amber-700 bg-amber-50 border-amber-300'
                }`}
              >
                {t(`status.${order.status}`)}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  isRefunded
                    ? 'text-rose-700 bg-rose-50 border-rose-300'
                    : 'text-emerald-800 bg-emerald-50 border-emerald-300'
                }`}
              >
                {isRefunded ? t('status.REFUNDED') : t('status.PAID')}
              </span>
            </div>
          </div>

          <ZatcaQrCode
            sellerName={company.restaurantName}
            vatNumber={company.vatNumber}
            timestamp={order.created_at}
            totalWithVat={order.total || 0}
            vatAmount={order.tax || 0}
            size={74}
          />
        </div>
      </div>

      {/* Cancelled or Refunded Banner */}
      {(isCancelled || isRefunded) && (
        <div className="my-4 p-3 rounded-lg border-2 border-rose-600 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-2 print-avoid-break">
          <div>
            <span className="font-black uppercase block">
              {isCancelled
                ? isRtl
                  ? 'هذا الطلب ملغى رسمياً'
                  : 'THIS ORDER IS OFFICIALLY CANCELLED'
                : isRtl
                ? 'تم استرداد قيمة هذه الفاتورة للعميل'
                : 'PAYMENT FOR THIS INVOICE HAS BEEN REFUNDED'}
            </span>
            {isCancelled && order.cancellation_reason && (
              <span className="text-[11px] font-semibold">
                {t('orders.reason')}: {translateCancellationReason(order.cancellation_reason)}
              </span>
            )}
          </div>
          {order.cancelled_at && (
            <span className="font-mono text-[11px]">
              {new Date(order.cancelled_at).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
            </span>
          )}
        </div>
      )}

      {/* Customer & Order Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 py-4 border-b border-slate-200 text-xs print-avoid-break">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات العميل والطلب' : 'Customer & Service Details'}
          </h4>
          <p className="text-sm font-black text-slate-900">
            {order.customer?.name || t('pos.walkInGuest')}
          </p>
          {order.customer?.phone && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الهاتف: ' : 'Phone: '}</span>
              {order.customer.phone}
            </p>
          )}
          <p className="text-slate-700">
            <span className="font-semibold">{isRtl ? 'نوع الخدمة: ' : 'Service Type: '}</span>
            {translateOrderType(order.order_type)}
            {order.table?.table_number ? ` — ${isRtl ? 'طاولة' : 'Table'} ${order.table.table_number}` : ''}
          </p>
        </div>

        <div className="space-y-1 text-start sm:text-end print:text-end">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات الإصدار والمرجع' : 'Invoice Metadata'}
          </h4>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'تاريخ ووقت الفاتورة:' : 'Invoice Date & Time:'}</span>
              <span className="font-bold">
                {new Date(order.created_at).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'الكاشير / الموظف:' : 'Cashier / Staff:'}</span>
              <span className="font-bold">{order.user?.name || 'POS Cashier'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'العملة:' : 'Currency:'}</span>
              <span className="font-bold">{company.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-4 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[520px] print:min-w-0 text-xs text-start border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-2 text-start">{isRtl ? 'الصنف / الوصف' : 'Item / Description'}</th>
              <th className="py-2 px-2 text-center font-mono w-24">{isRtl ? 'الرمز (SKU)' : 'SKU'}</th>
              <th className="py-2 px-2 text-center w-16">{isRtl ? 'الكمية' : 'Qty'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th className="py-2 px-2 text-end w-24">{isRtl ? 'الخصم' : 'Discount'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'الإجمالي' : 'Line Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="print-avoid-break">
                <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                <td className="py-2 px-2 font-semibold text-slate-900 text-start">
                  {item.product?.name || t('inventory.product')}
                </td>
                <td className="py-2 px-2 text-center font-mono text-slate-600 text-[11px]">
                  {item.product?.sku || '-'}
                </td>
                <td className="py-2 px-2 text-center font-bold font-mono">{item.quantity}</td>
                <td className="py-2 px-2 text-end font-mono">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 px-2 text-end font-mono text-slate-600">
                  {formatCurrency(item.discount || 0)}
                </td>
                <td className="py-2 px-2 text-end font-mono font-bold text-slate-900">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Payment Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 pt-4 border-t-2 border-slate-900 print-avoid-break">
        {/* Payment Methods & ZATCA Notice */}
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
            <span className="font-bold text-slate-800 block uppercase text-[11px]">
              {t('orders.paymentBreakdown')}
            </span>
            {payments.length === 0 ? (
              <p className="text-slate-500">{isRtl ? 'لا توجد دفعات مسجلة' : 'No payments recorded'}</p>
            ) : (
              payments.map((p, idx) => (
                <div key={p.id || idx} className="flex justify-between items-center font-mono">
                  <span className="font-sans font-semibold text-slate-700">
                    {translatePaymentMethod(p.payment_method)}
                    {p.status === 'REFUNDED' ? (isRtl ? ' (مسترد)' : ' (REFUNDED)') : ''}
                  </span>
                  <span className="font-bold text-slate-900">{formatCurrency(p.amount)}</span>
                </div>
              ))
            )}
          </div>

          <div className="text-[11px] text-slate-600 space-y-0.5">
            <p>
              •{' '}
              {isRtl
                ? 'فاتورة ضريبية معتمدة صادرة وفق متطلبات الفوترة الإلكترونية (فاتورة - ZATCA).'
                : 'Official e-Invoice compliant with ZATCA Phase-1 regulations.'}
            </p>
            <p>
              •{' '}
              {isRtl
                ? 'جميع الأسعار الموضحة تخضع لضريبة القيمة المضافة بنسبة 15%.'
                : 'Standard 15% Value Added Tax (VAT) is applied.'}
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{t('orders.subtotal')}:</span>
            <span className="font-mono font-bold">{formatCurrency(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-200 text-rose-700 font-semibold">
              <span>{t('orders.discount')}:</span>
              <span className="font-mono">-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{t('orders.vat')}:</span>
            <span className="font-mono font-bold">{formatCurrency(order.tax)}</span>
          </div>
          <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-900">
            <span>{t('orders.totalAmount')}:</span>
            <span className="font-mono text-resto-terracotta-600">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 mt-6 border-t border-slate-200 text-center text-[11px] text-slate-600 print-avoid-break">
        <p className="font-bold text-slate-800">
          {isRtl ? 'شكراً لاختياركم ' : 'Thank you for choosing '}
          {company.restaurantName}
        </p>
      </div>
    </div>
  );
}

export function PrintableSalesInvoice({
  order,
  onClose,
  defaultSize = 'a4',
}: PrintableSalesInvoiceProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [pageSize, setPageSize] = useState<PrintPageSize>(defaultSize);

  const receiptItems = (order.items || []).map((item) => ({
    name: item.product?.name || t('inventory.product'),
    sku: item.product?.sku,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
  }));

  const receiptPayments = (order.payments || []).map((p) => ({
    payment_method: p.payment_method,
    amount: p.amount,
    status: p.status,
  }));

  const isThermal = pageSize === 'thermal-80mm' || pageSize === 'thermal-58mm';

  return (
    <div className="space-y-4">
      <PrintPreviewToolbar
        title={
          isRtl
            ? `طباعة الفاتورة / الإيصال — ${order.order_number}`
            : `Print Invoice / Receipt — ${order.order_number}`
        }
        pageSize={pageSize}
        onChangePageSize={setPageSize}
        allowedSizes={[
          { size: 'a4', label: isRtl ? 'فاتورة ضريبية A4' : 'A4 Tax Invoice' },
          { size: 'thermal-80mm', label: isRtl ? 'إيصال حراري 80mm' : '80mm Thermal' },
          { size: 'thermal-58mm', label: isRtl ? 'إيصال حراري 58mm' : '58mm Thermal' },
        ]}
        onClose={onClose}
        isRtl={isRtl}
      />

      {/* Screen Preview */}
      {isThermal ? (
        <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <PrintableReceipt
            orderNumber={order.order_number}
            createdAt={order.created_at}
            cashierName={order.user?.name || 'POS Cashier'}
            customerName={order.customer?.name || t('pos.walkInGuest')}
            orderType={order.order_type}
            tableName={order.table?.table_number}
            items={receiptItems}
            subtotal={order.subtotal}
            discount={order.discount}
            vatAmount={order.tax}
            total={order.total}
            payments={receiptPayments}
            thermalSize={pageSize as 'thermal-80mm' | 'thermal-58mm'}
            orderStatus={order.status}
            cancellationReason={order.cancellation_reason}
          />
        </div>
      ) : (
        <SalesA4InvoiceBody order={order} isRtl={isRtl} t={t} />
      )}

      {/* Isolated Top-Level Print Portal */}
      <PrintPortal pageSize={pageSize} dir={isRtl ? 'rtl' : 'ltr'}>
        {isThermal ? (
          <PrintableReceipt
            orderNumber={order.order_number}
            createdAt={order.created_at}
            cashierName={order.user?.name || 'POS Cashier'}
            customerName={order.customer?.name || t('pos.walkInGuest')}
            orderType={order.order_type}
            tableName={order.table?.table_number}
            items={receiptItems}
            subtotal={order.subtotal}
            discount={order.discount}
            vatAmount={order.tax}
            total={order.total}
            payments={receiptPayments}
            thermalSize={pageSize as 'thermal-80mm' | 'thermal-58mm'}
            orderStatus={order.status}
            cancellationReason={order.cancellation_reason}
          />
        ) : (
          <SalesA4InvoiceBody order={order} isRtl={isRtl} t={t} />
        )}
      </PrintPortal>
    </div>
  );
}
