import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Layers } from 'lucide-react';
import { ProductManagement } from '@/components/menu/ProductManagement';
import { CategoryManagement } from '@/components/menu/CategoryManagement';

export function MenuView() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories'>('products');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub-navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'products'
              ? 'bg-resto-terracotta-600 text-white shadow-sm'
              : 'bg-card text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          Products Catalog
        </button>

        <button
          onClick={() => setActiveSubTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'categories'
              ? 'bg-resto-terracotta-600 text-white shadow-sm'
              : 'bg-card text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Menu Categories
        </button>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'products' ? (
        <ProductManagement />
      ) : (
        <CategoryManagement />
      )}
    </div>
  );
}
