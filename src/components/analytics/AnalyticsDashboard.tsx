import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Percent,
  AlertTriangle,
  Calendar,
  RefreshCw,
  PieChart as PieIcon,
  ShieldAlert,
  ArrowUpRight,
  Package,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { BusinessMetrics } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981', // emerald
  CANCELLED: '#ef4444', // red
  PREPARING: '#3b82f6', // blue
  READY: '#8b5cf6', // purple
  CONFIRMED: '#f59e0b', // amber
  PENDING: '#64748b', // slate
};

const REASON_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'];

type DateRangePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'ALL';

const PRESET_LABELS: Record<DateRangePreset, { en: string; ar: string }> = {
  ALL: { en: 'All Time', ar: 'كل الأوقات' },
  TODAY: { en: 'Today', ar: 'اليوم' },
  YESTERDAY: { en: 'Yesterday', ar: 'الأمس' },
  LAST_7: { en: 'Last 7 Days', ar: 'آخر 7 أيام' },
  LAST_30: { en: 'Last 30 Days', ar: 'آخر 30 يوماً' },
  THIS_MONTH: { en: 'This Month', ar: 'هذا الشهر' },
};

export function AnalyticsDashboard() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const isAuthorized = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL');
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const getDateRangeParams = useCallback((preset: DateRangePreset) => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (preset === 'TODAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (preset === 'YESTERDAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (preset === 'LAST_7') {
      start = new Date(now.getTime() - 7 * 86400000);
    } else if (preset === 'LAST_30') {
      start = new Date(now.getTime() - 30 * 86400000);
    } else if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      startDate: start ? start.toISOString() : undefined,
      endDate: end ? end.toISOString() : undefined,
    };
  }, []);

  const loadAnalytics = useCallback(async (preset: DateRangePreset, forceFetch: boolean = false) => {
    if (!isAuthorized) return;
    
    // 1. Instant Synchronous Cache Check (0ms UI render)
    const cached = DatabaseService.getCachedAnalyticsSync(preset);
    const needsFetch = forceFetch || !cached;
    
    // If we have cache and don't strictly need to fetch, just use it
    if (cached && !forceFetch) {
      setMetrics(cached.metrics);
      setBreakdown(cached.breakdown);
      setIsLoading(false);
      return; // Skip background refresh to save requests (unless forced)
    }

    // If we have cache but are fetching in background, we still show the cached data instantly
    if (cached) {
      setMetrics(cached.metrics);
      setBreakdown(cached.breakdown);
      setIsLoading(false); // Don't show skeleton
    } else if (!metrics) {
      setIsLoading(true); // Only show skeleton if we have NO data at all
    }
    
    setErrorMsg('');

    const { startDate, endDate } = getDateRangeParams(preset);

    try {
      const [metricsData, breakdownData] = await Promise.all([
        DatabaseService.getBusinessMetrics(user?.id, startDate, endDate),
        DatabaseService.getAnalyticsBreakdown(user?.id, startDate, endDate),
      ]);
      
      // 2. Cache for subsequent rapid navigations
      DatabaseService.setCachedAnalyticsSync(preset, metricsData, breakdownData);
      
      setMetrics(metricsData);
      setBreakdown(breakdownData);
    } catch (err: any) {
      console.error('Failed to load business analytics:', err);
      if (!cached) {
        setErrorMsg(isRtl ? 'تعذر تحميل بيانات التحليلات. يرجى التحقق من الاتصال وإعادة المحاولة.' : 'Unable to load analytics data. Please check connection and retry.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthorized, getDateRangeParams, isRtl]);

  useEffect(() => {
    loadAnalytics(datePreset, !metrics);
  }, [datePreset, loadAnalytics]);

  // Role Access Restriction Guard
  if (!isAuthorized) {
    return (
      <div className="p-8 rounded-xl bg-card border border-red-200 dark:border-red-900/60 text-center space-y-4 max-w-lg mx-auto my-12 select-none">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isRtl ? 'تم تقييد الوصول' : 'Access Restricted'}
        </h3>
        <p className="text-xs text-slate-500">
          {isRtl
            ? 'لوحة تحكم تحليلات وذكاء أداء المطعم تتطلب صلاحية مدير النظام أو المشرف.'
            : 'Executive Analytics & Business Intelligence Dashboard requires ADMIN or MANAGER authorization.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* Header & Date Preset Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-resto-terracotta-600" />
            {isRtl ? 'لوحة تحكم ذكاء أداء المطعم والتحليلات' : 'Executive Business Intelligence & Analytics'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl ? 'مؤشرات الأداء الرئيسية المركزية، الأرباح الهامشية التاريخية ومراقبة سلامة المخزون' : 'Centralized performance KPIs, historical gross margins, and inventory health metrics'}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-resto-terracotta-600 dark:text-resto-terracotta-400 bg-resto-terracotta-50/50 dark:bg-resto-terracotta-900/20 w-fit px-2.5 py-1 rounded-md border border-resto-terracotta-100 dark:border-resto-terracotta-800/30">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <Calendar className="w-4 h-4 text-slate-400 ml-1" />
          {(['ALL', 'TODAY', 'YESTERDAY', 'LAST_7', 'LAST_30', 'THIS_MONTH'] as const).map(p => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                datePreset === p
                  ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {PRESET_LABELS[p][isRtl ? 'ar' : 'en']}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadAnalytics(datePreset, true)}
            className="h-7 w-7 text-slate-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Error Message with Retry */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadAnalytics(datePreset, true)}>
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      )}

      {/* Analytics Content */}
      {!isLoading && metrics && breakdown && (
        <>
          {/* Top 6 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-lg font-extrabold font-display text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(metrics.total_revenue)}
                </div>
                <span className="text-[9px] text-slate-400 block">
                  {isRtl ? 'خافض للاستردادات' : 'Refunds Deducted'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {isRtl ? 'الطلبات المكتملة' : 'Completed Orders'}
                  </span>
                  <ShoppingBag className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-lg font-extrabold font-display text-slate-900 dark:text-slate-100">
                  {metrics.completed_orders_count}
                </div>
                <span className="text-[9px] text-slate-400 block">
                  {isRtl ? 'مبيعات منفذة' : 'Fulfilled Sales'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {isRtl ? 'متوسط الطلب' : 'Avg Order Value'}
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-lg font-extrabold font-display text-slate-900 dark:text-slate-100">
                  {formatCurrency(metrics.average_order_value)}
                </div>
                <span className="text-[9px] text-slate-400 block">
                  {isRtl ? 'لكل تذكرة مبيعات' : 'Per Completed Ticket'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {isRtl ? 'الربح الإجمالي' : 'Gross Profit'}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-resto-terracotta-600" />
                </div>
                <div className="text-lg font-extrabold font-display text-resto-terracotta-600">
                  {formatCurrency(metrics.gross_profit)}
                </div>
                <span className="text-[9px] text-slate-400 block">
                  {isRtl ? 'تكلفة تاريخية' : 'Historical Unit Cost'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cancellation Rate</span>
                  <Percent className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-lg font-extrabold font-display text-red-600 dark:text-red-400">
                  {metrics.cancellation_rate}%
                </div>
                <span className="text-[9px] text-slate-400 block">{metrics.cancelled_orders_count} Orders Cancelled</span>
              </CardContent>
            </Card>

            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Low Stock Items</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-lg font-extrabold font-display text-amber-600 dark:text-amber-400">
                  {metrics.inventory_low_stock_count}
                </div>
                <span className="text-[9px] text-slate-400 block">Requires Reorder</span>
              </CardContent>
            </Card>
          </div>

          {/* Visual Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue & Gross Profit Time Series Trend Chart */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Revenue & Gross Profit Performance Trend</span>
                  <Badge variant="success" className="text-[10px]">Refund-Aware Historical Margin</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72 pt-4">
                {!breakdown.revenue_profit_trend || breakdown.revenue_profit_trend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No sales trend data available for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdown.revenue_profit_trend} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: number) => [formatCurrency(val), 'Amount']} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Selling Products Bar Chart */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Top Performing Menu Products</span>
                  <Badge variant="info" className="text-[10px]">Units Sold</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-4">
                {breakdown.top_products.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No product sales recorded for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdown.top_products} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" textAnchor="end" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="product_name" type="category" width={110} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: number) => [`${val} Units`, 'Quantity']} />
                      <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Category Performance Bar Chart */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Category Revenue Breakdown</span>
                  <Badge variant="outline" className="text-[10px]">Menu Categories</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-4">
                {!breakdown.category_performance || breakdown.category_performance.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No category data available for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdown.category_performance} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="category_name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: number) => [formatCurrency(val), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Method Analysis Section */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Payment Method Analysis</span>
                  <Badge variant="info" className="text-[10px]">Completed Payments</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(breakdown.payment_methods || []).map((pm: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{pm.method.replace('_', ' ')}</span>
                      <span className="text-sm font-extrabold font-display text-slate-900 dark:text-slate-100 block">{formatCurrency(pm.amount)}</span>
                      <span className="text-[9px] text-slate-400 block">{pm.count} Transactions</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Status Distribution Pie Chart */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Order Lifecycle Distribution</span>
                  <Badge variant="outline" className="text-[10px]">Status Mix</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-2 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown.status_breakdown.filter((s: any) => s.count > 0)}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={4}
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {breakdown.status_breakdown.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [`${val} Orders`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cancellation Reasons Breakdown */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Cancellation Reason Analysis</CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-2 flex items-center justify-center">
                {breakdown.cancellation_reasons.every((r: any) => r.count === 0) ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No order cancellations recorded in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown.cancellation_reasons.filter((r: any) => r.count > 0)}
                        dataKey="count"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        paddingAngle={3}
                        label={({ reason, count }) => `${reason.replace('_', ' ')}: ${count}`}
                      >
                        {breakdown.cancellation_reasons.map((entry: any, index: number) => (
                          <Cell key={`cell-reason-${index}`} fill={REASON_COLORS[index % REASON_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Inventory Health Alert List */}
            <Card className="bg-card border border-slate-200 dark:border-slate-800 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Inventory Stock Health & Alert Monitoring</span>
                  <Badge variant="warning" className="text-[10px]">Restock Thresholds</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto pt-2 space-y-2 text-xs">
                {breakdown.inventory_health.map((prod: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{prod.product_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="font-extrabold block text-sm">{prod.stock_quantity}</span>
                        <span className="text-[9px] text-slate-400">Min: {prod.minimum_stock}</span>
                      </div>

                      <Badge variant={prod.status === 'OUT' ? 'destructive' : prod.status === 'LOW' ? 'warning' : 'success'} className="text-[9px]">
                        {prod.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
