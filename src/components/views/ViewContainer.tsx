import React, { Suspense, lazy } from 'react';
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
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { DEFAULT_VAT_RATE } from '@/config/tax.config';
import { UserRole } from '@/types/database.types';

// Performance Optimization: Code-split secondary management views using React.lazy
const PosView = lazy(() => import('./PosView').then(m => ({ default: m.PosView })));
const MenuView = lazy(() => import('./MenuView').then(m => ({ default: m.MenuView })));
const CustomerView = lazy(() => import('./CustomerView').then(m => ({ default: m.CustomerView })));
const TableView = lazy(() => import('./TableView').then(m => ({ default: m.TableView })));
const OrderView = lazy(() => import('./OrderView').then(m => ({ default: m.OrderView })));
const InventoryView = lazy(() => import('./InventoryView').then(m => ({ default: m.InventoryView })));
const SupplierView = lazy(() => import('./SupplierView').then(m => ({ default: m.SupplierView })));
const AnalyticsView = lazy(() => import('./AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const DashboardView = lazy(() => import('./DashboardView').then(m => ({ default: m.DashboardView })));
const AiView = lazy(() => import('./AiView').then(m => ({ default: m.AiView })));
const UserView = lazy(() => import('./UserView').then(m => ({ default: m.UserView })));
const SettingsView = lazy(() => import('./SettingsView').then(m => ({ default: m.SettingsView })));

export interface ViewContainerProps {
  activeTab: string;
  currentUser: {
    name: string;
    email: string;
    role: UserRole;
  };
}

export function ViewContainer({ activeTab, currentUser }: ViewContainerProps) {
  const { t, i18n } = useTranslation();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'pos':
        return <PosView />;
      case 'menu':
        return <MenuView />;
      case 'customers':
        return <CustomerView />;
      case 'tables':
        return <TableView />;
      case 'orders':
        return <OrderView />;
      case 'inventory':
        return <InventoryView />;
      case 'suppliers':
        return <SupplierView />;
      case 'ai':
      case 'ai-assistant':
        return <AiView />;
      case 'users':
        return <UserView />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  if (['dashboard', 'analytics', 'pos', 'menu', 'customers', 'tables', 'orders', 'inventory', 'suppliers', 'ai', 'ai-assistant', 'users', 'settings'].includes(activeTab)) {
    return (
      <Suspense fallback={<Skeleton className="w-full h-[80vh] rounded-xl" />}>
        {renderActiveView()}
      </Suspense>
    );
  }

  const getModuleDetails = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return {
          title: t('nav.dashboard'),
          icon: LayoutDashboard,
          phase: 'Phase 9 Target',
          desc: 'Executive analytics cards, Recharts sales velocity, and grounded AI insights.',
        };
      case 'inventory':
        return {
          title: t('nav.inventory'),
          icon: Package,
          phase: 'Phase 8 Target',
          desc: 'Stock level tracking, minimum stock alert triggers, and inventory value.',
        };
      case 'suppliers':
        return {
          title: t('nav.suppliers'),
          icon: Truck,
          phase: 'Phase 8 Target',
          desc: 'Supplier contact directory, procurement tracking, and purchase receiving.',
        };
      case 'analytics':
        return {
          title: t('nav.analytics'),
          icon: BarChart3,
          phase: 'Phase 9 Target',
          desc: 'Centralized Business Metrics engine view with historical gross profit metrics.',
        };
      case 'ai-assistant':
        return {
          title: t('nav.aiAssistant'),
          icon: Bot,
          phase: 'Phase 10 Target',
          desc: 'Grounded business assistant evaluating operational SQL aggregate data.',
        };
      case 'settings':
        return {
          title: t('nav.settings'),
          icon: Settings,
          phase: 'Phase 1 Target',
          desc: 'System settings, centralized VAT configuration (15%), and i18n locale settings.',
        };
      default:
        return {
          title: t('brand.name'),
          icon: ShieldCheck,
          phase: 'Phase 1 Base',
          desc: 'RestoFlow modular application framework.',
        };
    }
  };

  const currentModule = getModuleDetails(activeTab);
  const Icon = currentModule.icon;
  const isRtl = i18n.language === 'ar';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-resto-charcoal-900 via-resto-charcoal-800 to-resto-terracotta-900 text-white shadow-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-resto-terracotta-400 shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{currentModule.title}</h2>
              <Badge variant="warning" className="text-xs bg-resto-terracotta-500 text-white border-none">
                {currentModule.phase}
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl font-light">
              {currentModule.desc}
            </p>
          </div>
        </div>

        {/* User Context & Config Badge */}
        <div className="flex flex-wrap items-center gap-2 bg-black/20 p-2.5 rounded-xl border border-white/10 text-xs">
          <span className="text-slate-400">{isRtl ? 'المستخدم:' : 'User:'}</span>
          <span className="font-bold text-white">{currentUser.name}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{isRtl ? 'نسبة الضريبة:' : 'VAT Rate:'}</span>
          <span className="font-bold text-resto-terracotta-400">{DEFAULT_VAT_RATE}%</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{isRtl ? 'اللغة:' : 'Mode:'}</span>
          <span className="font-bold text-emerald-400">{i18n.language.toUpperCase()} ({document.dir.toUpperCase()})</span>
        </div>
      </div>

      {/* Verification Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">
              {isRtl ? 'محرك نقطة البيع الحي' : 'POS Engine Live'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {isRtl ? 'إتمام الدفع وخصم المخزون الذري' : 'Atomic Checkout & Stock Deduction'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRtl
                ? 'تنفيذ دالة execute_pos_checkout وحفظ السعر والتكلفة بدقة.'
                : 'Executes `execute_pos_checkout` RPC, capturing price & snapshot cost.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">
              {isRtl ? 'محرك دورة حياة الطلبات' : 'Order Lifecycle Engine'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {isRtl ? 'مصفوفة حالات صارمة' : 'Strict State Machine Matrix'}
            </div>
            <p className="text-xs text-muted-foreground">
              PENDING → CONFIRMED → PREPARING → READY → COMPLETED.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">
              {isRtl ? 'محرك الإلغاء والاسترداد' : 'Cancellation & Refund Engine'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {isRtl ? 'إرجاع المخزون التلقائي والاسترداد الكامل' : 'Idempotent Stock Restoration & Full Refund'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRtl
                ? 'استعادة المخزون ذرياً ومعالجة استرداد المدفوعات بصلاحيات مقيدة.'
                : 'Atomic RPC stock restoration and role-restricted payment refund handling.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
