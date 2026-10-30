import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  UtensilsCrossed,
  Grid,
  Users,
  Package,
  Truck,
  BarChart3,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ChefHat,
  UserCog,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { logout, isAllowed } = useAuth();
  const isRtl = i18n.language === 'ar';

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const allNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'pos', label: t('nav.pos'), icon: ShoppingCart },
    { id: 'orders', label: t('nav.orders'), icon: Receipt },
    { id: 'menu', label: t('nav.menu'), icon: UtensilsCrossed },
    { id: 'tables', label: t('nav.tables'), icon: Grid },
    { id: 'customers', label: t('nav.customers'), icon: Users },
    { id: 'inventory', label: t('nav.inventory'), icon: Package },
    { id: 'suppliers', label: t('nav.suppliers'), icon: Truck },
    { id: 'analytics', label: t('nav.analytics'), icon: BarChart3 },
    { id: 'ai-assistant', label: t('nav.aiAssistant'), icon: Bot, badge: 'AI' },
    { id: 'users', label: t('nav.users'), icon: UserCog },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  // Dynamically filter sidebar items based on authenticated role permissions
  const navItems = allNavItems.filter(item => isAllowed(item.id));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-in fade-in duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        className={cn(
          'bg-resto-charcoal-900 text-slate-200 border-resto-charcoal-800 flex flex-col transition-all duration-300 select-none shrink-0',
          // Desktop styles: visible from lg upwards
          'hidden lg:flex relative h-screen border-r z-30',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          // Mobile & Tablet Drawer styles: sliding drawer when open
          isMobileOpen &&
            'flex fixed inset-y-0 start-0 w-72 max-w-[85vw] h-full border-e z-50 shadow-2xl animate-in slide-in-from-left rtl:slide-in-from-right duration-300'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-resto-charcoal-800 justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-resto-terracotta-600 to-resto-terracotta-500 flex items-center justify-center text-white shadow-md shrink-0">
              <ChefHat className="w-6 h-6" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-display text-lg font-bold text-white tracking-wide leading-none">
                  Resto<span className="text-resto-terracotta-500">Flow</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {t('brand.tagline')}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-resto-charcoal-800 rounded-lg hidden lg:flex"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
            )}
          </Button>

          {/* Mobile Drawer Close Button */}
          {isMobileOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseMobile}
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-resto-charcoal-800 rounded-lg lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative min-h-[44px]',
                  isActive
                    ? 'bg-resto-terracotta-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:bg-resto-charcoal-800 hover:text-slate-100'
                )}
                title={isCollapsed && !isMobileOpen ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {(!isCollapsed || isMobileOpen) && (
                  <span className="truncate flex-1 text-start">{item.label}</span>
                )}
                {(!isCollapsed || isMobileOpen) && item.badge && (
                  <span className="bg-resto-terracotta-500/20 text-resto-terracotta-400 border border-resto-terracotta-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-3 border-t border-resto-charcoal-800 shrink-0">
          <button
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              logout();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-950/30 hover:text-red-400 transition-colors min-h-[44px]',
              isCollapsed && !isMobileOpen && 'justify-center'
            )}
            title={isCollapsed && !isMobileOpen ? t('nav.logout') : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span>{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
