import React from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { logout, isAllowed } = useAuth();
  const isRtl = i18n.language === 'ar';

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
    <aside
      className={cn(
        'relative h-screen bg-resto-charcoal-900 text-slate-200 border-r border-resto-charcoal-800 flex flex-col transition-all duration-300 z-30 select-none shrink-0',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-resto-charcoal-800 justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-resto-terracotta-600 to-resto-terracotta-500 flex items-center justify-center text-white shadow-md shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          {!isCollapsed && (
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

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-resto-charcoal-800 rounded-lg hidden lg:flex"
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                isActive
                  ? 'bg-resto-terracotta-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:bg-resto-charcoal-800 hover:text-slate-100'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5 shrink-0 transition-transform group-hover:scale-105', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} />
              {!isCollapsed && <span className="truncate flex-1 text-start">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className="bg-resto-terracotta-500/20 text-resto-terracotta-400 border border-resto-terracotta-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-resto-charcoal-800">
        <button
          onClick={() => logout()}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-950/30 hover:text-red-400 transition-colors',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? t('nav.logout') : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
