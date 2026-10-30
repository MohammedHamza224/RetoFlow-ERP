import React from 'react';
import { useTranslation } from 'react-i18next';
import { GoodsReceipt } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import {
  getCompanySettings,
  PrintPortal,
  PrintPreviewToolbar,
} from './PrintPortal';

export interface PrintableGoodsReceiptProps {
  receipt: GoodsReceipt;
  onClose?: () => void;
}

function GoodsReceiptDocumentBody({
  receipt,
  isRtl,
  t,
}: {
  receipt: GoodsReceipt;
  isRtl: boolean;
  t: any;
}) {
  const company = getCompanySettings();
  const items = receipt.items || [];

  const totalUnitsReceived = items.reduce((acc, i) => acc + (i.quantity_received || 0), 0);
  const totalReceivedValue = items.reduce(
    (acc, i) => acc + (i.quantity_received || 0) * (i.unit_cost || 0),
    0
  );

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
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-800 text-white font-mono font-bold">
              WAREHOUSE / GRN
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {isRtl
              ? 'إدارة المستودعات ومراقبة المخزون والاستلام'
              : 'Warehouse Receiving & Inventory Control Department'}
          </p>
          <div className="mt-2 text-[11px] text-slate-700 space-y-0.5">
            <p className="font-mono font-semibold">
              {isRtl ? `الرقم الضريبي للمنشأة: ${company.vatNumber}` : `Tax / VAT Number: ${company.vatNumber}`}
            </p>
            <p>{company.address}</p>
          </div>
        </div>

        <div className="text-start sm:text-end print:text-end w-full sm:w-auto">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
            {isRtl ? 'محضر استلام بضاعة (GRN)' : 'Official Goods Receipt Note'}
          </h1>
          <p className="font-mono text-base font-bold text-emerald-700 mt-0.5">
            {receipt.receipt_number}
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-start sm:justify-end print:justify-end flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded font-bold border text-emerald-800 bg-emerald-50 border-emerald-300">
              {t('goodsReceipts.receivedBadge')}
            </span>
          </div>
        </div>
      </div>

      {/* Supplier & Receipt Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 py-4 border-b border-slate-200 text-xs print-avoid-break">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات المورد المسلّم' : 'Delivered By Supplier'}
          </h4>
          <p className="text-sm font-black text-slate-900">
            {receipt.supplier?.name || t('suppliers.name')}
          </p>
          {receipt.supplier?.tax_number && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الرقم الضريبي: ' : 'VAT / Tax No: '}</span>
              {receipt.supplier.tax_number}
            </p>
          )}
          {receipt.supplier?.phone && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الهاتف: ' : 'Phone: '}</span>
              {receipt.supplier.phone}
            </p>
          )}
          {receipt.supplier?.address && (
            <p className="text-slate-700">
              <span className="font-semibold">{isRtl ? 'العنوان: ' : 'Address: '}</span>
              {receipt.supplier.address}
            </p>
          )}
        </div>

        <div className="space-y-1 text-start sm:text-end print:text-end">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات الاستلام والمرجع' : 'Receiving Metadata'}
          </h4>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'مرجع أمر الشراء (PO):' : 'Purchase Order Ref:'}</span>
              <span className="font-bold text-resto-terracotta-600">
                {receipt.purchase?.invoice_number || '-'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'تاريخ ووقت الاستلام:' : 'Received Date & Time:'}</span>
              <span className="font-bold">
                {new Date(receipt.received_at).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">{isRtl ? 'تم الاستلام بواسطة:' : 'Received By:'}</span>
              <span className="font-bold">
                {receipt.receiver?.name || t('goodsReceipts.authorizedStaff')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Received Items Table */}
      <div className="py-4 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[500px] print:min-w-0 text-xs text-start border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-2 text-start">{isRtl ? 'الصنف المستلم' : 'Product / Item Description'}</th>
              <th className="py-2 px-2 text-center font-mono w-24">{isRtl ? 'الرمز (SKU)' : 'SKU'}</th>
              <th className="py-2 px-2 text-center w-24">{isRtl ? 'الكمية المستلمة' : 'Qty Received'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
              <th className="py-2 px-2 text-end w-28">{isRtl ? 'إجمالي القيمة' : 'Total Value'}</th>
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
                <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700">
                  {item.quantity_received}
                </td>
                <td className="py-2 px-2 text-end font-mono">{formatCurrency(item.unit_cost)}</td>
                <td className="py-2 px-2 text-end font-mono font-bold text-slate-900">
                  {formatCurrency((item.quantity_received || 0) * (item.unit_cost || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary & Inspection Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 pt-4 border-t-2 border-slate-900 print-avoid-break">
        <div className="space-y-3">
          {receipt.notes && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block mb-1">
                {isRtl ? 'ملاحظات الفحص والاستلام:' : 'Inspection & Receiving Notes:'}
              </span>
              <p className="text-slate-700 whitespace-pre-wrap">{receipt.notes}</p>
            </div>
          )}
          <div className="text-[11px] text-slate-600 space-y-0.5">
            <p>
              •{' '}
              {isRtl
                ? 'تم فحص الأصناف المذكورة أعلاه والتأكد من مطابقتها للمواصفات ودرجة الحرارة السليمة.'
                : 'Items listed above have been inspected for quality, quantity, and temperature compliance.'}
            </p>
            <p>
              •{' '}
              {isRtl
                ? 'تمت إضافة الكميات المستلمة فعلياً إلى رصيد المخزون في النظام.'
                : 'Received quantities have been atomically added to physical inventory stock.'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{isRtl ? 'عدد الأصناف المستلمة:' : 'Total Line Items:'}</span>
            <span className="font-mono font-bold">{items.length}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="text-slate-700">{isRtl ? 'إجمالي الوحدات المستلمة:' : 'Total Units Received:'}</span>
            <span className="font-mono font-bold text-emerald-700">{totalUnitsReceived}</span>
          </div>
          <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-900">
            <span>{isRtl ? 'إجمالي قيمة البضاعة المستلمة (قبل الضريبة):' : 'Total Received Value (Excl. VAT):'}</span>
            <span className="font-mono text-emerald-700">{formatCurrency(totalReceivedValue)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-8 text-xs text-center border-t border-slate-200 mt-6 print-avoid-break">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'مندوب المورد / المسلّم' : 'Supplier Representative'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتوقيع' : 'Name & Signature'}
          </span>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'أمين المستودع / المستلم' : 'Warehouse Receiver'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاسم والتاريخ والتوقيع' : 'Name, Date & Signature'}
          </span>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'مراقبة الجودة / المدير المناوب' : 'Quality Control / Manager'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isRtl ? 'الاعتماد والختم' : 'Approval & Stamp'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PrintableGoodsReceipt({ receipt, onClose }: PrintableGoodsReceiptProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="space-y-4">
      <PrintPreviewToolbar
        title={`${t('goodsReceipts.receiptDetailsTitle')} — ${receipt.receipt_number}`}
        pageSize="a4"
        onClose={onClose}
        isRtl={isRtl}
      />

      {/* Screen Preview */}
      <GoodsReceiptDocumentBody receipt={receipt} isRtl={isRtl} t={t} />

      {/* Isolated Top-Level Print Portal */}
      <PrintPortal pageSize="a4" dir={isRtl ? 'rtl' : 'ltr'}>
        <GoodsReceiptDocumentBody receipt={receipt} isRtl={isRtl} t={t} />
      </PrintPortal>
    </div>
  );
}
