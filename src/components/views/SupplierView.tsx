import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, FileText, PackageCheck, Receipt } from 'lucide-react';
import { SupplierManagement } from '@/components/suppliers/SupplierManagement';
import { PurchaseManagement } from '@/components/purchases/PurchaseManagement';
import { GoodsReceiptManagement } from '@/components/purchases/GoodsReceiptManagement';
import { PurchaseInvoiceManagement } from '@/components/purchases/PurchaseInvoiceManagement';

export function SupplierView() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'suppliers' | 'purchases' | 'receipts' | 'invoices'>('suppliers');
  const [activePurchaseId, setActivePurchaseId] = useState<string | undefined>(undefined);

  const handleNavigateToReceipts = (purchaseId: string) => {
    setActivePurchaseId(purchaseId);
    setSubTab('receipts');
  };

  const handleNavigateToInvoices = (purchaseId: string) => {
    setActivePurchaseId(purchaseId);
    setSubTab('invoices');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub Tab Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl w-fit text-xs font-semibold select-none border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActivePurchaseId(undefined);
            setSubTab('suppliers');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            subTab === 'suppliers'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          {t('suppliers.directoryTab')}
        </button>

        <button
          onClick={() => {
            setActivePurchaseId(undefined);
            setSubTab('purchases');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            subTab === 'purchases'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('suppliers.purchasesTab')}
        </button>

        <button
          onClick={() => {
            setActivePurchaseId(undefined);
            setSubTab('receipts');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            subTab === 'receipts'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          {t('suppliers.receiptsTab')}
        </button>

        <button
          onClick={() => {
            setActivePurchaseId(undefined);
            setSubTab('invoices');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            subTab === 'invoices'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          {t('suppliers.invoicesTab')}
        </button>
      </div>

      {/* Render Selected View */}
      {subTab === 'suppliers' && <SupplierManagement />}
      {subTab === 'purchases' && (
        <PurchaseManagement
          onNavigateToReceipts={handleNavigateToReceipts}
          onNavigateToInvoices={handleNavigateToInvoices}
        />
      )}
      {subTab === 'receipts' && (
        <GoodsReceiptManagement initialPurchaseId={activePurchaseId} />
      )}
      {subTab === 'invoices' && (
        <PurchaseInvoiceManagement initialPurchaseId={activePurchaseId} />
      )}
    </div>
  );
}
