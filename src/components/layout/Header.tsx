import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Globe, Search, LogOut, User, Menu } from 'lucide-react';
import { setAppLanguage } from '@/i18n/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { UserProfileModal } from '@/components/auth/UserProfileModal';

export interface HeaderProps {
  activeTab: string;
  onToggleMobileNav?: () => void;
}

export function Header({ activeTab, onToggleMobileNav }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout, switchDemoRole } = useAuth();
  const currentLang = i18n.language as 'en' | 'ar';

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const isRtl = currentLang === 'ar';

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'ar' : 'en';
    setAppLanguage(nextLang);
  };

  const translateRole = (role?: string) => {
    if (!role) return 'STAFF';
    if (currentLang !== 'ar') return role;
    switch (role) {
      case 'ADMIN': return 'مسؤول النظام';
      case 'MANAGER': return 'المدير';
      case 'CASHIER': return 'الكاشير';
      case 'STAFF': return 'الموظف';
      default: return role;
    }
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
      users: t('nav.users'),
      settings: t('nav.settings'),
    };
    return titleMap[tab] || t('brand.name');
  };

  return (
    <header className="h-16 bg-card border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 shadow-subtle shrink-0">
      {/* Left side: Mobile Hamburger + Page Title & Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle Button (< lg) */}
        <button
          onClick={onToggleMobileNav}
          className="lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 -ms-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-display text-base sm:text-lg lg:text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 truncate">
          {getPageTitle(activeTab)}
        </h1>
        <span className="text-slate-300 dark:text-slate-700 font-light hidden md:inline">|</span>
        <span className="text-xs text-muted-foreground hidden md:inline truncate">
          {t('brand.name')} &bull; {isRtl ? 'نقطة بيع 01' : 'Terminal 01'}
        </span>
      </div>

      {/* Right side: Global Search, Quick Role Switcher, Language & Profile Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Search Input (Hidden on mobile/tablet) */}
        <div className="hidden xl:block w-56">
          <Input
            placeholder={t('header.search')}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs bg-slate-50 dark:bg-slate-900/50"
          />
        </div>

        {/* Quick Role Switcher Dropdown for Testing (Desktop & Tablet Landscape) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
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
              {translateRole(r)}
            </button>
          ))}
        </div>

        {/* Language Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          leftIcon={<Globe className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />}
          className="h-10 min-h-[40px] px-2.5 sm:px-3 text-xs font-semibold shrink-0"
        >
          <span className="hidden sm:inline">{currentLang === 'en' ? 'العربية (AR)' : 'English (EN)'}</span>
          <span className="sm:hidden font-bold">{currentLang === 'en' ? 'AR' : 'EN'}</span>
        </Button>

        {/* Notification Bell */}
        <button
          className="relative h-10 w-10 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          title={t('header.notifications')}
          aria-label={t('header.notifications')}
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-resto-terracotta-600 ring-2 ring-white dark:ring-slate-900" />
        </button>

        {/* Authenticated User Profile Badge & Logout */}
        <div className="flex items-center gap-1 sm:gap-2 ps-1 sm:ps-2 border-s border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 text-start hover:opacity-80 transition-opacity p-1 min-h-[40px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isRtl ? 'تعديل الملف الشخصي' : 'Edit User Profile'}
            aria-label="User Profile"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-resto-charcoal-800 text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-sm shrink-0 border border-slate-700 font-mono">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden xl:flex flex-col">
              <span className="text-xs font-bold text-resto-charcoal-900 dark:text-slate-100 leading-tight">
                {user?.name || (isRtl ? 'مستخدم مسجل' : 'Authenticated User')}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                  {translateRole(user?.role_name)}
                </Badge>
              </div>
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="h-10 w-10 min-h-[40px] min-w-[40px] text-slate-400 hover:text-red-600 rounded-lg shrink-0"
            title={t('nav.logout')}
            aria-label={t('nav.logout')}
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
