import React from 'react';
import { useTranslation } from 'react-i18next';
import { PurchaseInvoice } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import {
  getCompanySettings,
  PrintPortal,
  PrintPreviewToolbar,
  ZatcaQrCode,
} from '@/components/print/PrintPortal';

interface PrintablePurchaseInvoiceProps {
  invoice: PurchaseInvoice;
  onClose?: () => void;
}

function PurchaseInvoiceDocumentBody({
  invoice,
  isRtl,
  t,
}: {
  invoice: PurchaseInvoice;
  isRtl: boolean;
  t: any;
}) {
  const company = getCompanySettings();

  const statusColor =
    {
      DRAFT: 'text-amber-700 bg-amber-50 border-amber-300',
      POSTED: 'text-emerald-800 bg-emerald-50 border-emerald-300',
      CANCELLED: 'text-rose-700 bg-rose-50 border-rose-300',
    }[invoice.status] || 'text-slate-700 bg-slate-50 border-slate-300';

  const paymentColor =
    {
      PAID: 'text-emerald-800 bg-emerald-50 border-emerald-300',
      PARTIALLY_PAID: 'text-amber-700 bg-amber-50 border-amber-300',
      UNPAID: 'text-rose-700 bg-rose-50 border-rose-300',
    }[invoice.payment_status] || 'text-slate-700 bg-slate-50 border-slate-300';

  const items = invoice.items || [];
  const balanceDue = Math.max(0, (invoice.total || 0) - (invoice.paid_amount || 0));

  return (
    <div
      className="p-4 sm:p-6 md:p-8 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:m-0 print:w-full"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Invoice Header */}
      <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start pb-5 border-b-2 border-slate-900 gap-4 print-avoid-break">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-display">
              {company.restaurantName}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold">
              ERP
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {isRtl
              ? 'نظام إدارة المطاعم والمشتريات المتكامل'
              : company.tagline || 'Integrated Restaurant & Procurement Management'}
          </p>
          <div className="mt-2 text-[11px] text-slate-700 space-y-0.5">
            <p className="font-mono font-semibold">
              {isRtl ? `الرقم الضريبي للمنشأة: ${company.vatNumber}` : `Tax / VAT Number: ${company.vatNumber}`}
            </p>
            <p>{company.address}</p>
            {company.phone && <p className="font-mono">{isRtl ? `الهاتف: ${company.phone}` : `Phone: ${company.phone}`}</p>}
          </div>
        </div>

        <div className="flex items-start gap-4 w-full sm:w-auto justify-between sm:justify-end print:justify-end">
          <div className="text-start sm:text-end print:text-end">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              {isRtl ? 'فاتورة مشتريات ضريبية' : 'Tax Purchase Invoice'}
            </h1>
            <p className="font-mono text-base font-bold text-resto-terracotta-600 mt-0.5">
              {invoice.invoice_number}
            </p>
            {invoice.supplier_invoice_number && (
              <p className="text-xs text-slate-600 mt-0.5 font-mono">
                {isRtl ? 'فاتورة المورد: ' : 'Supplier Ref: '}
                <span className="font-bold text-slate-900">{invoice.supplier_invoice_number}</span>
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 justify-start sm:justify-end print:justify-end flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${statusColor}`}>
                {t(`purchaseInvoices.status.${invoice.status}`)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${paymentColor}`}>
                {t(`purchaseInvoices.paymentStatus.${invoice.payment_status}`)}
              </span>
            </div>
          </div>

          <ZatcaQrCode
            sellerName={invoice.supplier?.name || company.restaurantName}
            vatNumber={invoice.supplier?.tax_number || company.vatNumber}
            timestamp={invoice.issue_date || invoice.created_at}
            totalWithVat={invoice.total || 0}
            vatAmount={invoice.tax || 0}
            size={74}
          />
        </div>
      </div>

      {/* Invoice Info & Supplier Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 py-4 border-b border-slate-200 text-xs print-avoid-break">
        {/* Supplier Details */}
        <div className="space-y-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات المورد' : 'Supplier Details'}
          </h4>
          <p className="text-sm font-black text-slate-900">
            {invoice.supplier?.name || t('suppliers.name')}
          </p>
          {invoice.supplier?.tax_number && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الرقم الضريبي: ' : 'VAT / Tax No: '}</span>
              {invoice.supplier.tax_number}
            </p>
          )}
          {invoice.supplier?.phone && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الهاتف: ' : 'Phone: '}</span>
              {invoice.supplier.phone}
            </p>
          )}
          {invoice.supplier?.email && (
            <p className="text-slate-700 break-all">
              <span className="font-semibold">{isRtl ? 'البريد: ' : 'Email: '}</span>
              {invoice.supplier.email}
            </p>
          )}
          {invoice.supplier?.address && (
            <p className="text-slate-700">
              <span className="font-semibold">{isRtl ? 'العنوان: ' : 'Address: '}</span>
              {invoice.supplier.address}
            </p>
          )}
        </div>

        {/* Invoice Dates & Cross References */}
        <div className="space-y-1 text-start sm:text-end print:text-end">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات الفاتورة والمرجع' : 'Invoice & References'}
          </h4>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'تاريخ الإصدار:' : 'Issue Date:'}</span>
              <span className="font-bold">{invoice.issue_date}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isRtl ? 'تاريخ الاستحقاق:' : 'Due Date:'}</span>
                <span className="font-bold">{invoice.due_date}</span>
              </div>
            )}
            {invoice.purchase?.invoice_number && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isRtl ? 'أمر الشراء المرتبط:' : 'Purchase Order Ref:'}</span>
                <span className="font-bold text-resto-terracotta-600">{invoice.purchase.invoice_number}</span>
              </div>
            )}
            {invoice.receipt?.receipt_number && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isRtl ? 'محضر الاستلام:' : 'Goods Receipt Ref:'}</span>
                <span className="font-bold text-emerald-700">{invoice.receipt.receipt_number}</span>
              </div>
            )}
            {invoice.creator?.name && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isRtl ? 'أنشئت بواسطة:' : 'Created By:'}</span>
                <span className="font-bold">{invoice.creator.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-4 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[540px] print:min-w-0 text-xs text-start border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-2 text-start">{isRtl ? 'الصنف / الوصف' : 'Item / Description'}</th>
              <th className="py-2 px-2 text-center font-mono w-20">{isRtl ? 'الرمز' : 'SKU'}</th>
              <th className="py-2 px-2 text-center w-14">{isRtl ? 'الكمية' : 'Qty'}</th>
              <th className="py-2 px-2 text-end w-24">{isRtl ? 'سعر الوحدة' : 'Unit Cost'}</th>
              <th className="py-2 px-2 text-end w-20">{isRtl ? 'الخصم' : 'Discount'}</th>
              <th className="py-2 px-2 text-end w-24">{isRtl ? 'الضريبة (15%)' : 'Tax (15%)'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              const productName = item.product?.name || `Product #${item.product_id.slice(-6)}`;
              const sku = item.product?.sku || '-';
              return (
                <tr key={item.id || idx} className="print-avoid-break">
                  <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-2 font-semibold text-slate-900 text-start">{productName}</td>
                  <td className="py-2 px-2 text-center font-mono text-slate-600 text-[11px]">{sku}</td>
                  <td className="py-2 px-2 text-center font-bold font-mono">{item.quantity}</td>
                  <td className="py-2 px-2 text-end font-mono">{formatCurrency(item.unit_cost)}</td>
                  <td className="py-2 px-2 text-end font-mono text-slate-600">{formatCurrency(item.discount || 0)}</td>
                  <td className="py-2 px-2 text-end font-mono text-slate-600">{formatCurrency(item.tax || 0)}</td>
                  <td className="py-2 px-2 text-end font-mono font-bold text-slate-900">{formatCurrency(item.total_cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 pt-4 border-t-2 border-slate-900 print-avoid-break">
        {/* Notes and Terms */}
        <div className="space-y-3">
          {invoice.notes && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block mb-1">
                {isRtl ? 'الملاحظات والتعليمات:' : 'Notes & Instructions:'}
              </span>
              <p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          <div className="text-[11px] text-slate-600 space-y-0.5">
            <p>• {isRtl ? 'هذه الفاتورة تم إصدارها إلكترونياً وتعتبر مستنداً نظامياً معتمداً.' : 'This invoice is generated electronically and is an official record.'}</p>
            <p>• {isRtl ? 'نسبة ضريبة القيمة المضافة القياسية 15% بموجب نظام هيئة الزكاة والضريبة والجمارك.' : 'Standard VAT rate is 15% according to ZATCA regulations.'}</p>
          </div>
        </div>

        {/* Totals Breakdown */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{isRtl ? 'المجموع قبل الضريبة (Subtotal):' : 'Subtotal:'}</span>
            <span className="font-mono font-bold">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700 font-semibold">
              <span>{isRtl ? 'إجمالي الخصم (Discount):' : 'Discount:'}</span>
              <span className="font-mono">-{formatCurrency(invoice.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{isRtl ? 'ضريبة القيمة المضافة (15% VAT):' : 'VAT (15%):'}</span>
            <span className="font-mono font-bold">{formatCurrency(invoice.tax)}</span>
          </div>
          <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-900">
            <span>{isRtl ? 'الإجمالي النهائي (Grand Total):' : 'Grand Total:'}</span>
            <span className="font-mono text-resto-terracotta-600">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-800 font-semibold">
            <span>{isRtl ? 'المبلغ المدفوع (Paid Amount):' : 'Paid Amount:'}</span>
            <span className="font-mono">{formatCurrency(invoice.paid_amount || 0)}</span>
          </div>
          <div className="flex justify-between py-1 font-bold text-xs">
            <span className={balanceDue > 0 ? 'text-rose-700' : 'text-slate-600'}>
              {isRtl ? 'المبلغ المتبقي (Balance Due):' : 'Balance Due:'}
            </span>
            <span className={`font-mono ${balanceDue > 0 ? 'text-rose-700 font-black' : 'text-slate-600'}`}>
              {formatCurrency(balanceDue)}
            </span>
          </div>
        </div>
      </div>

      {/* Signatures & Authorizations */}
      <div className="grid grid-cols-2 gap-6 sm:gap-12 pt-8 text-xs text-center border-t border-slate-200 mt-6 print-avoid-break">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'توقيع أمين المستودع / مستلم البضاعة' : 'Warehouse Keeper / Received By'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتاريخ والتوقيع' : 'Name, Date & Signature'}
          </span>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'اعتماد الإدارة المالية / المحاسب' : 'Finance Approval / Accountant'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتاريخ والختم' : 'Name, Date & Stamp'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PrintablePurchaseInvoice({ invoice, onClose }: PrintablePurchaseInvoiceProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="space-y-4">
      <PrintPreviewToolbar
        title={`${t('purchaseInvoices.printPreview')} — ${invoice.invoice_number}`}
        pageSize="a4"
        onClose={onClose}
        isRtl={isRtl}
      />

      {/* Screen Preview */}
      <PurchaseInvoiceDocumentBody invoice={invoice} isRtl={isRtl} t={t} />

      {/* Isolated Print Portal for A4 Output */}
      <PrintPortal pageSize="a4" dir={isRtl ? 'rtl' : 'ltr'}>
        <PurchaseInvoiceDocumentBody invoice={invoice} isRtl={isRtl} t={t} />
      </PrintPortal>
    </div>
  );
}

