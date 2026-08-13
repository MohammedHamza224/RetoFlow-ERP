import React, { useState } from 'react';
import { SupplierManagement } from '@/components/suppliers/SupplierManagement';
import { PurchaseManagement } from '@/components/purchases/PurchaseManagement';
import { Button } from '@/components/ui/Button';

export function SupplierView() {
  const [subTab, setSubTab] = useState<'suppliers' | 'purchases'>('suppliers');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl w-fit text-xs font-semibold select-none border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setSubTab('suppliers')}
          className={`px-4 py-2 rounded-lg transition-all ${
            subTab === 'suppliers'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Suppliers Directory
        </button>
        <button
          onClick={() => setSubTab('purchases')}
          className={`px-4 py-2 rounded-lg transition-all ${
            subTab === 'purchases'
              ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Purchase Orders & Receiving
        </button>
      </div>

      {subTab === 'suppliers' ? <SupplierManagement /> : <PurchaseManagement />}
    </div>
  );
}
