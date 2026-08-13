import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Globe, Search, LogOut, User } from 'lucide-react';
import { setAppLanguage } from '@/i18n/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { UserProfileModal } from '@/components/auth/UserProfileModal';

export interface HeaderProps {
  activeTab: string;
}

export function Header({ activeTab }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout, switchDemoRole } = useAuth();
  const currentLang = i18n.language as 'en' | 'ar';

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'ar' : 'en';
    setAppLanguage(nextLang);
  };

  const getPageTitle = (tab: string) => {
    const titleMap: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      pos: t('nav.pos'),
      orders: t('nav.orders'),
      menu: t('nav.menu'),
      tables: t('nav.tables'),
      customers: t('nav.customers'),
      inventory: t('nav.inventory'),
      suppliers: t('nav.suppliers'),
      analytics: t('nav.analytics'),
      'ai-assistant': t('nav.aiAssistant'),
      settings: t('nav.settings'),
    };
    return titleMap[tab] || t('brand.name');
  };

  return (
    <header className="h-16 bg-card border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-subtle">
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100">
          {getPageTitle(activeTab)}
        </h1>
        <span className="text-slate-300 dark:text-slate-700 font-light hidden sm:inline">|</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {t('brand.name')} &bull; Terminal 01
        </span>
      </div>

      {/* Global Search & User Bar */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="hidden md:block w-64">
          <Input
            placeholder={t('header.search')}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs bg-slate-50 dark:bg-slate-900/50"
          />
        </div>

        {/* Quick Role Switcher Dropdown for Testing */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
          {(['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] as const).map((r) => (
            <button
              key={r}
              onClick={() => switchDemoRole(r)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                user?.role_name === r
                  ? 'bg-resto-terracotta-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Language Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          leftIcon={<Globe className="w-4 h-4 text-resto-terracotta-600" />}
          className="h-9 px-3 text-xs font-semibold"
        >
          {currentLang === 'en' ? 'العربية (AR)' : 'English (EN)'}
        </Button>

        {/* Notification Bell */}
        <button
          className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={t('header.notifications')}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-resto-terracotta-600 ring-2 ring-white dark:ring-slate-900" />
        </button>

        {/* Authenticated User Profile Badge & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Edit User Profile"
          >
            <div className="w-9 h-9 rounded-full bg-resto-charcoal-800 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0 border border-slate-700 font-mono">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden xl:flex flex-col">
              <span className="text-xs font-bold text-resto-charcoal-900 dark:text-slate-100 leading-tight">
                {user?.name || 'Authenticated User'}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                  {user?.role_name || 'STAFF'}
                </Badge>
              </div>
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg"
            title={t('nav.logout')}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* User Profile Editing Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
}
