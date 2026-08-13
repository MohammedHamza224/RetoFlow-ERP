import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  Calendar,
  RefreshCw,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { AiAssistantService, AiChatMessage } from '@/services/ai.service';
import { useAuth } from '@/context/AuthContext';
import { BusinessMetrics } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'ALL';

const PRESET_LABELS: Record<DatePreset, { en: string; ar: string }> = {
  ALL: { en: 'All Time', ar: 'كل الأوقات' },
  TODAY: { en: 'Today', ar: 'اليوم' },
  YESTERDAY: { en: 'Yesterday', ar: 'الأمس' },
  LAST_7: { en: 'Last 7 Days', ar: 'آخر 7 أيام' },
  LAST_30: { en: 'Last 30 Days', ar: 'آخر 30 يوماً' },
  THIS_MONTH: { en: 'This Month', ar: 'هذا الشهر' },
};

const SUGGESTED_QUESTIONS = [
  { en: 'How much revenue did we make this period?', ar: 'كم بلغت الإيرادات في هذه الفترة؟' },
  { en: 'What is our average order value?', ar: 'ما هو متوسط قيمة الطلب؟' },
  { en: 'What is our best-selling product?', ar: 'ما هو المنتج الأكثر مبيعاً؟' },
  { en: 'How many orders were cancelled?', ar: 'كم عدد الطلبات الملغاة؟' },
  { en: 'What is our cancellation rate?', ar: 'ما هي نسبة الإلغاء؟' },
  { en: 'How is gross profit performing?', ar: 'كيف هو أداء الربح الإجمالي؟' },
  { en: 'Which products need stock attention?', ar: 'ما هي المنتجات التي تحتاج انتباه المخزون؟' },
  { en: 'Give me an executive summary of performance.', ar: 'أعطني ملخصاً تنفيذياً للأداء.' },
];

export function AiAssistant() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const isAuthorized = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getDateRangeParams = useCallback((preset: DatePreset) => {
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
      periodLabel: PRESET_LABELS[preset][isRtl ? 'ar' : 'en'],
    };
  }, [isRtl]);

  const loadMetrics = useCallback(async (preset: DatePreset) => {
    if (!isAuthorized) return;
    setIsLoadingMetrics(true);

    const { startDate, endDate } = getDateRangeParams(preset);
    try {
      const data = await DatabaseService.getBusinessMetrics(user?.id, startDate, endDate);
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load metrics for AI Assistant:', err);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [user, isAuthorized, getDateRangeParams]);

  useEffect(() => {
    loadMetrics(datePreset);
  }, [datePreset, loadMetrics]);

  // Initial Welcome Message
  useEffect(() => {
    if (isAuthorized && messages.length === 0) {
      setMessages([
        {
          id: 'welcome_1',
          sender: 'assistant',
          text: isRtl
            ? 'مرحباً بك! أنا مساعد الذكاء الاصطناعي الخاص بـ RestoFlow. يمكنني مساعدتك في تحليل إيرادات المطعم، الأرباح الهامشية، الطلبات المكتملة والملغاة، وتنبيهات المخزون استناداً إلى بيانات قاعدة البيانات المعتمدة.'
            : 'Welcome! I am your RestoFlow AI Business Intelligence Assistant. I can help you analyze revenue, gross profit, sales volume, cancellation rates, and stock alerts based strictly on verified restaurant data.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isAuthorized, isRtl, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const handleSendQuery = async (queryText?: string) => {
    const textToSubmit = queryText || inputQuery;
    if (!textToSubmit.trim() || isAiThinking) return;

    const userMsg: AiChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSubmit.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsAiThinking(true);

    const { startDate, endDate, periodLabel } = getDateRangeParams(datePreset);

    try {
      const aiReply = await AiAssistantService.queryAssistant(
        user?.id,
        textToSubmit,
        isRtl ? 'ar' : 'en',
        startDate,
        endDate,
        periodLabel
      );
      setMessages(prev => [...prev, aiReply]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: err.message || (isRtl ? 'حدث خطأ أثناء معالجة السؤال.' : 'An error occurred while processing your question.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Role Access Guard
  if (!isAuthorized) {
    return (
      <div className="p-8 rounded-xl bg-card border border-red-200 dark:border-red-900/60 text-center space-y-4 max-w-lg mx-auto my-12 select-none">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Access Restricted</h3>
        <p className="text-xs text-slate-500">
          RestoFlow AI Restaurant Assistant requires ADMIN or MANAGER authorization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-6xl mx-auto">
      {/* Header & Date Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-resto-terracotta-600 animate-pulse" />
            RestoFlow AI Restaurant Intelligence Assistant
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Understand your restaurant performance with trusted business insights
          </p>
        </div>

        {/* Date Range Selector */}
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
            onClick={() => loadMetrics(datePreset)}
            className="h-7 w-7 text-slate-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Verified Business Metrics Bar */}
      {isLoadingMetrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Revenue</span>
            <span className="text-sm font-extrabold font-display text-emerald-600 dark:text-emerald-400 block">{formatCurrency(metrics.total_revenue)}</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Completed</span>
            <span className="text-sm font-extrabold font-display text-slate-900 dark:text-slate-100 block">{metrics.completed_orders_count} Orders</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Avg Ticket</span>
            <span className="text-sm font-extrabold font-display text-slate-900 dark:text-slate-100 block">{formatCurrency(metrics.average_order_value)}</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Gross Profit</span>
            <span className="text-sm font-extrabold font-display text-resto-terracotta-600 block">{formatCurrency(metrics.gross_profit)}</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Cancel Rate</span>
            <span className="text-sm font-extrabold font-display text-red-600 dark:text-red-400 block">{metrics.cancellation_rate}%</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Low Stock</span>
            <span className="text-sm font-extrabold font-display text-amber-600 dark:text-amber-400 block">{metrics.inventory_low_stock_count} Items</span>
          </div>
        </div>
      ) : null}

      {/* Suggested Questions Action Chips */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-resto-terracotta-600" />
          {isRtl ? 'أسئلة مقترحة سريعة:' : 'Suggested Executive Queries:'}
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSendQuery(sq[isRtl ? 'ar' : 'en'])}
              className="px-3 py-1.5 rounded-lg bg-card border border-slate-200 dark:border-slate-800 hover:border-resto-terracotta-500 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-resto-terracotta-600 transition-colors shadow-subtle"
            >
              {sq[isRtl ? 'ar' : 'en']}
            </button>
          ))}
        </div>
      </div>

      {/* Conversational Chat Box */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-card shadow-subtle flex flex-col h-[480px]">
        {/* Messages Scroll Area */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-resto-terracotta-600/10 border border-resto-terracotta-600/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-resto-terracotta-600" />
                </div>
              )}

              <div
                className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-resto-charcoal-800 text-white rounded-br-none dark:bg-slate-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <span className="text-[9px] opacity-60 block mt-1.5 text-right font-mono">
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {/* AI Thinking Spinner Indicator */}
          {isAiThinking && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-resto-terracotta-600/10 border border-resto-terracotta-600/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-resto-terracotta-600 animate-spin" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                {isRtl ? 'جاري تحليل بيانات المطعم المعتمدة...' : 'Analyzing verified restaurant metrics...'}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </CardContent>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={isRtl ? 'اسأل عن أداء المطعم أو الإيرادات...' : 'Ask about restaurant revenue, profit, or performance...'}
              className="h-10 text-xs bg-background"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!inputQuery.trim() || isAiThinking}
              leftIcon={<Send className="w-4 h-4" />}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold shrink-0"
            >
              {isRtl ? 'إرسال' : 'Send'}
            </Button>
          </form>
          <span className="text-[10px] text-slate-400 mt-2 block text-center font-mono">
            ✓ Based on verified restaurant database metrics for {PRESET_LABELS[datePreset][isRtl ? 'ar' : 'en']}
          </span>
        </div>
      </Card>
    </div>
  );
}
