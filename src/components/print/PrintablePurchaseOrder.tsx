import React from 'react';
import { useTranslation } from 'react-i18next';
import { Purchase } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import {
  getCompanySettings,
  PrintPortal,
  PrintPreviewToolbar,
} from './PrintPortal';

export interface PrintablePurchaseOrderProps {
  purchase: Purchase;
  onClose?: () => void;
}

function PurchaseOrderDocumentBody({
  purchase,
  isRtl,
  t,
}: {
  purchase: Purchase;
  isRtl: boolean;
  t: any;
}) {
  const company = getCompanySettings();
  const items = purchase.items || [];

  const statusColor =
    {
      RECEIVED: 'text-emerald-800 bg-emerald-50 border-emerald-300',
      PARTIALLY_RECEIVED: 'text-amber-700 bg-amber-50 border-amber-300',
      PENDING_RECEIPT: 'text-blue-800 bg-blue-50 border-blue-300',
      APPROVED: 'text-emerald-800 bg-emerald-50 border-emerald-300',
      CANCELLED: 'text-rose-700 bg-rose-50 border-rose-300',
      DRAFT: 'text-slate-700 bg-slate-50 border-slate-300',
    }[purchase.status] || 'text-slate-700 bg-slate-50 border-slate-300';

  return (
    <div
      className="p-4 sm:p-6 md:p-8 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:m-0 print:w-full"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Document Header */}
      <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start pb-5 border-b-2 border-slate-900 gap-4 print-avoid-break">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-display">
              {company.restaurantName}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold">
              PROCUREMENT
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {isRtl
              ? 'إدارة المشتريات وسلسلة الإمداد'
              : company.tagline || 'Procurement & Supply Chain Management'}
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

        <div className="text-start sm:text-end print:text-end w-full sm:w-auto">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
            {isRtl ? 'أمر شراء رسمي (Purchase Order)' : 'Official Purchase Order'}
          </h1>
          <p className="font-mono text-base font-bold text-resto-terracotta-600 mt-0.5">
            {purchase.invoice_number}
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-start sm:justify-end print:justify-end flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${statusColor}`}>
              {t(`purchases.status.${purchase.status}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Supplier & Order Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 py-4 border-b border-slate-200 text-xs print-avoid-break">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'موجه إلى المورد (Vendor / Supplier)' : 'To Supplier / Vendor'}
          </h4>
          <p className="text-sm font-black text-slate-900">
            {purchase.supplier?.name || t('suppliers.name')}
          </p>
          {purchase.supplier?.tax_number && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الرقم الضريبي: ' : 'VAT / Tax No: '}</span>
              {purchase.supplier.tax_number}
            </p>
          )}
          {purchase.supplier?.phone && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الهاتف: ' : 'Phone: '}</span>
              {purchase.supplier.phone}
            </p>
          )}
          {purchase.supplier?.email && (
            <p className="text-slate-700 break-all">
              <span className="font-semibold">{isRtl ? 'البريد: ' : 'Email: '}</span>
              {purchase.supplier.email}
            </p>
          )}
          {purchase.supplier?.address && (
            <p className="text-slate-700">
              <span className="font-semibold">{isRtl ? 'العنوان: ' : 'Address: '}</span>
              {purchase.supplier.address}
            </p>
          )}
        </div>

        <div className="space-y-1 text-start sm:text-end print:text-end">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'تفاصيل أمر الشراء والتوريد' : 'Order & Delivery Schedule'}
          </h4>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'تاريخ أمر الشراء:' : 'Order Date:'}</span>
              <span className="font-bold">{purchase.purchase_date}</span>
            </div>
            {purchase.expected_delivery_date && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isRtl ? 'تاريخ التوريد المتوقع:' : 'Expected Delivery:'}</span>
                <span className="font-bold">{purchase.expected_delivery_date}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'عدد الأصناف:' : 'Line Items:'}</span>
              <span className="font-bold">{items.length}</span>
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
              <th className="py-2 px-2 text-center w-20">{isRtl ? 'الكمية المطلوبة' : 'Ordered Qty'}</th>
              <th className="py-2 px-2 text-center w-20">{isRtl ? 'الكمية المستلمة' : 'Received Qty'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'سعر الوحدة' : 'Unit Cost'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'الإجمالي' : 'Total Cost'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="print-avoid-break">
                <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                <td className="py-2 px-2 font-semibold text-slate-900 text-start">
                  {item.product?.name || `Product #${item.product_id.slice(-6)}`}
                </td>
                <td className="py-2 px-2 text-center font-mono text-slate-600 text-[11px]">
                  {item.product?.sku || '-'}
                </td>
                <td className="py-2 px-2 text-center font-bold font-mono">{item.quantity}</td>
                <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700">
                  {item.received_quantity || 0}
                </td>
                <td className="py-2 px-2 text-end font-mono">{formatCurrency(item.unit_cost)}</td>
                <td className="py-2 px-2 text-end font-mono font-bold text-slate-900">
                  {formatCurrency(item.total_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 pt-4 border-t-2 border-slate-900 print-avoid-break">
        <div className="space-y-3">
          {purchase.notes && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block mb-1">
                {isRtl ? 'شروط وملاحظات التوريد:' : 'Terms & Delivery Notes:'}
              </span>
              <p className="text-slate-700 whitespace-pre-wrap">{purchase.notes}</p>
            </div>
          )}
          <div className="text-[11px] text-slate-600 space-y-0.5">
            <p>
              •{' '}
              {isRtl
                ? 'يرجى إرفاق أصل الفاتورة الضريبية ومحضر التسليم عند توريد البضاعة للمستودع.'
                : 'Please attach the original Tax Invoice and Delivery Note upon delivery.'}
            </p>
            <p>
              •{' '}
              {isRtl
                ? 'تخضع كافة الأصناف لفحص الجودة وسلامة الأغذية قبل اعتماد محضر الاستلام.'
                : 'All goods are subject to quality and food safety inspection upon receipt.'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{t('purchases.subtotal')}</span>
            <span className="font-mono font-bold">{formatCurrency(purchase.subtotal)}</span>
          </div>
          {(purchase.discount || 0) > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700 font-semibold">
              <span>{t('purchases.discount')}</span>
              <span className="font-mono">-{formatCurrency(purchase.discount || 0)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{t('purchases.tax')}</span>
            <span className="font-mono font-bold">{formatCurrency(purchase.tax)}</span>
          </div>
          <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-900">
            <span>{t('purchases.totalCost')}</span>
            <span className="font-mono text-resto-terracotta-600">{formatCurrency(purchase.total)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 sm:gap-12 pt-8 text-xs text-center border-t border-slate-200 mt-6 print-avoid-break">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'إعداد قسم المشتريات' : 'Prepared By Procurement'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتاريخ والتوقيع' : 'Name, Date & Signature'}
          </span>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'اعتماد مدير المطعم / الإدارة العامة' : 'Authorized By General Manager'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتاريخ والختم' : 'Name, Date & Stamp'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PrintablePurchaseOrder({ purchase, onClose }: PrintablePurchaseOrderProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="space-y-4">
      <PrintPreviewToolbar
        title={`${t('purchases.poDetailsTitle')} — ${purchase.invoice_number}`}
        pageSize="a4"
        onClose={onClose}
        isRtl={isRtl}
      />

      {/* Screen Preview */}
      <PurchaseOrderDocumentBody purchase={purchase} isRtl={isRtl} t={t} />

      {/* Isolated Top-Level Print Portal */}
      <PrintPortal pageSize="a4" dir={isRtl ? 'rtl' : 'ltr'}>
        <PurchaseOrderDocumentBody purchase={purchase} isRtl={isRtl} t={t} />
      </PrintPortal>
    </div>
  );
}
