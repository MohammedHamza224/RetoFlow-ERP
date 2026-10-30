import React from 'react';
import { useTranslation } from 'react-i18next';
import { SupplierStatement } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { getCompanySettings } from './PrintPortal';

export interface PrintableSupplierStatementProps {
  statement: SupplierStatement;
}

export function PrintableSupplierStatement({ statement }: PrintableSupplierStatementProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const company = getCompanySettings();
  const { supplier, invoices, purchases, receipts } = statement;

  return (
    <div
      className="p-4 sm:p-6 md:p-8 bg-white text-slate-900 print:p-0 print:w-full"
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
              FINANCE & AP
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {isRtl
              ? 'الإدارة المالية وحسابات الموردين'
              : 'Accounts Payable & Supplier Financial Ledger'}
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
            {isRtl ? 'كشف حساب مورد مفصل' : 'Official Supplier Account Statement'}
          </h1>
          <p className="font-mono text-xs text-slate-600 mt-1">
            {isRtl ? 'تاريخ إصدار الكشف: ' : 'Statement Date: '}
            <span className="font-bold text-slate-900">
              {new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
            </span>
          </p>
        </div>
      </div>

      {/* Supplier Info & Account Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 sm:gap-8 py-4 border-b border-slate-200 text-xs print-avoid-break">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            {isRtl ? 'بيانات المورد' : 'Supplier Information'}
          </h4>
          <p className="text-sm font-black text-slate-900">{supplier.name}</p>
          {supplier.tax_number && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الرقم الضريبي: ' : 'VAT / Tax No: '}</span>
              {supplier.tax_number}
            </p>
          )}
          {supplier.phone && (
            <p className="text-slate-700 font-mono">
              <span className="font-semibold">{isRtl ? 'الهاتف: ' : 'Phone: '}</span>
              {supplier.phone}
            </p>
          )}
          {supplier.email && (
            <p className="text-slate-700 break-all">
              <span className="font-semibold">{isRtl ? 'البريد: ' : 'Email: '}</span>
              {supplier.email}
            </p>
          )}
          {supplier.address && (
            <p className="text-slate-700">
              <span className="font-semibold">{isRtl ? 'العنوان: ' : 'Address: '}</span>
              {supplier.address}
            </p>
          )}
        </div>

        {/* Financial Summary Box */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">{t('suppliers.statementTotalOrders')}:</span>
            <span className="font-mono font-bold">{statement.total_orders}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{t('suppliers.statementTotalOrderedAmount')}:</span>
            <span className="font-mono font-bold">{formatCurrency(statement.total_order_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{t('suppliers.statementTotalInvoiced')}:</span>
            <span className="font-mono font-bold">{formatCurrency(statement.total_invoiced)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{isRtl ? 'إجمالي المدفوعات:' : 'Total Paid:'}</span>
            <span className="font-mono font-bold text-emerald-700">
              {formatCurrency(statement.total_paid)}
            </span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-300 font-black text-sm">
            <span>{t('suppliers.statementBalanceDue')}:</span>
            <span
              className={`font-mono ${
                statement.outstanding_balance > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(statement.outstanding_balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Purchase Invoices */}
      <div className="py-4 space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          1. {t('suppliers.statementInvoicesTab')} ({invoices.length})
        </h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">{t('purchaseInvoices.noInvoices')}</p>
        ) : (
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
                <th className="py-1.5 px-2 text-start">{t('purchaseInvoices.invoiceNum')}</th>
                <th className="py-1.5 px-2 text-start">{isRtl ? 'فاتورة المورد' : 'Supplier Ref'}</th>
                <th className="py-1.5 px-2 text-start">{t('purchaseInvoices.issueDate')}</th>
                <th className="py-1.5 px-2 text-center">{t('common.status')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchaseInvoices.totalAmount')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchaseInvoices.paidAmount')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchaseInvoices.balanceDue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map((inv) => {
                const bal = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
                return (
                  <tr key={inv.id} className="print-avoid-break">
                    <td className="py-1.5 px-2 font-mono font-bold">{inv.invoice_number}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-600">
                      {inv.supplier_invoice_number || '-'}
                    </td>
                    <td className="py-1.5 px-2 font-mono">{inv.issue_date}</td>
                    <td className="py-1.5 px-2 text-center font-semibold">
                      {t(`purchaseInvoices.status.${inv.status}`)}
                    </td>
                    <td className="py-1.5 px-2 text-end font-mono font-bold">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-1.5 px-2 text-end font-mono text-emerald-700">
                      {formatCurrency(inv.paid_amount || 0)}
                    </td>
                    <td className="py-1.5 px-2 text-end font-mono font-bold text-rose-700">
                      {formatCurrency(bal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Purchase Orders */}
      <div className="py-4 space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          2. {t('suppliers.statementOrdersTab')} ({purchases.length})
        </h3>
        {purchases.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">{t('purchases.noPurchases')}</p>
        ) : (
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
                <th className="py-1.5 px-2 text-start">{t('purchases.orderNumber')}</th>
                <th className="py-1.5 px-2 text-start">{t('purchases.orderDate')}</th>
                <th className="py-1.5 px-2 text-center">{t('common.status')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchases.subtotal').replace(/:$/, '')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchases.tax').replace(/:$/, '')}</th>
                <th className="py-1.5 px-2 text-end">{t('purchases.totalCost').replace(/:$/, '')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {purchases.map((po) => (
                <tr key={po.id} className="print-avoid-break">
                  <td className="py-1.5 px-2 font-mono font-bold">{po.invoice_number}</td>
                  <td className="py-1.5 px-2 font-mono">{po.purchase_date}</td>
                  <td className="py-1.5 px-2 text-center font-semibold">
                    {t(`purchases.status.${po.status}`)}
                  </td>
                  <td className="py-1.5 px-2 text-end font-mono">{formatCurrency(po.subtotal)}</td>
                  <td className="py-1.5 px-2 text-end font-mono">{formatCurrency(po.tax)}</td>
                  <td className="py-1.5 px-2 text-end font-mono font-bold">
                    {formatCurrency(po.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Goods Receipts */}
      <div className="py-4 space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          3. {t('suppliers.statementReceiptsTab')} ({receipts.length})
        </h3>
        {receipts.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">{t('goodsReceipts.noReceipts')}</p>
        ) : (
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
                <th className="py-1.5 px-2 text-start">{t('goodsReceipts.receiptNumber')}</th>
                <th className="py-1.5 px-2 text-start">{t('goodsReceipts.poReference')}</th>
                <th className="py-1.5 px-2 text-start">{t('goodsReceipts.receivedDate')}</th>
                <th className="py-1.5 px-2 text-center">{t('goodsReceipts.itemsCount')}</th>
                <th className="py-1.5 px-2 text-start">{t('common.notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.map((rcpt) => (
                <tr key={rcpt.id} className="print-avoid-break">
                  <td className="py-1.5 px-2 font-mono font-bold text-emerald-700">
                    {rcpt.receipt_number}
                  </td>
                  <td className="py-1.5 px-2 font-mono">
                    {rcpt.purchase?.invoice_number || '-'}
                  </td>
                  <td className="py-1.5 px-2 font-mono">
                    {new Date(rcpt.received_at).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono">
                    {rcpt.items?.length || 0}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">{rcpt.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 sm:gap-12 pt-8 text-xs text-center border-t border-slate-200 mt-6 print-avoid-break">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'إعداد محاسب الموردين' : 'Prepared By AP Accountant'}
          </span>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-8 mb-2"></div>
          <span className="font-bold text-slate-800 block">
            {isRtl ? 'اعتماد المدير المالي / مصادقة المورد' : 'Finance Manager / Supplier Confirmation'}
          </span>
        </div>
      </div>
    </div>
  );
}
