import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserRole } from '@/types/database.types';

export interface LayoutContainerProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: {
    name: string;
    email: string;
    role: UserRole;
  };
}

export function LayoutContainer({
  children,
  activeTab,
  onTabChange,
}: LayoutContainerProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-resto-charcoal-50 dark:bg-slate-950 font-sans">
      {/* Sidebar & Mobile Slide-over Drawer */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Honest Offline Network Status Banner */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-600 text-white px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 text-center shrink-0 shadow-sm z-30 no-print"
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {isRtl
                ? 'أنت غير متصل بالإنترنت حالياً. تتطلب عمليات نقطة البيع والمدفوعات وحفظ البيانات اتصالاً نشطاً بالخادم.'
                : 'You are currently offline. Live POS transactions, payments, and database saves require an active internet connection.'}
            </span>
          </div>
        )}

        {/* Header with Hamburger Toggle */}
        <Header
          activeTab={activeTab}
          onToggleMobileNav={() => setIsMobileNavOpen(prev => !prev)}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
