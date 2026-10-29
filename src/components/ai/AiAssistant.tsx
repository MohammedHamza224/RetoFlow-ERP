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
  BookOpen,
  Layers,
  MessageSquare,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { AiAssistantService, AiChatMessage } from '@/services/ai.service';
import { useAuth } from '@/context/AuthContext';
import { BusinessMetrics, RagSourceCitation } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';

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
  // Operational Knowledge & Policies
  { en: 'What is the order cancellation and inventory restoration policy?', ar: 'ما هي سياسة إلغاء الطلبات وإرجاع المخزون؟' },
  { en: 'What are the rules and procedures for customer refunds?', ar: 'ما هي ضوابط استرداد أموال ومدفوعات العملاء؟' },
  { en: 'How does inventory reordering work and what products need attention?', ar: 'ما هي إجراءات إعادة طلب المخزون وما الأصناف التي تحتاج طلباً؟' },
  { en: 'What are the table turnover and sanitization standards?', ar: 'ما هي معايير نظافة الطاولات وسرعة دوران المقاعد؟' },
  { en: 'What is the POS cash drawer end-of-day closing procedure?', ar: 'ما هي إجراءات تسليم وردية الكاشير وإغلاق الصندوق؟' },

  // Financial Business Intelligence Metrics
  { en: 'How much revenue did we make this period?', ar: 'كم بلغت الإيرادات في هذه الفترة؟' },
  { en: 'What is our average order value?', ar: 'ما هو متوسط قيمة الطلب؟' },
  { en: 'What is our best-selling product?', ar: 'ما هو المنتج الأكثر مبيعاً؟' },
  { en: 'How is gross profit performing?', ar: 'كيف هو أداء إجمالي الربح الهامشي؟' },
  { en: 'Give me an executive summary of performance.', ar: 'أعطني ملخصاً تنفيذياً لأداء المطعم.' },
];

export function AiAssistant() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  const isManagement = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'knowledge'>('chat');

  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<RagSourceCitation | null>(null);
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
    if (!isManagement) return;
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
  }, [user, isManagement, getDateRangeParams]);

  useEffect(() => {
    if (isManagement) {
      loadMetrics(datePreset);
    }
  }, [datePreset, loadMetrics, isManagement]);

  // Initial Welcome Message
  useEffect(() => {
    if (user && messages.length === 0) {
      setMessages([
        {
          id: 'welcome_1',
          sender: 'assistant',
          text: isRtl
            ? `مرحباً بك (${user.name})! أنا المساعد الذكي المدعوم بقاعدة المعرفة (RAG) وبيانات التحليلات لـ RestoFlow. يمكنك الاستفسار عن سياسات التشغيل، إجراءات الإلغاء والاسترداد، تنبيهات المخزون، أو مؤشرات الأداء المالي.`
            : `Welcome (${user.name})! I am your RestoFlow RAG AI Assistant. You can query verified restaurant operational SOPs, cancellation policies, refund workflows, inventory reordering rules, or business analytics.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [user, isRtl, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        text: isRtl
          ? 'تم مسح المحادثة. كيف يمكنني مساعدتك في عمليات المطعم أو البيانات التشغيلية؟'
          : 'Conversation cleared. How can I assist you with restaurant policies or metrics today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

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

  // If user is not logged in
  if (!user) {
    return (
      <div className="p-8 rounded-xl bg-card border border-red-200 dark:border-red-900/60 text-center space-y-4 max-w-lg mx-auto my-12 select-none">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('aiAssistant.accessRestricted')}</h3>
        <p className="text-xs text-slate-500">
          {t('aiAssistant.accessRestrictedDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-6xl mx-auto">
      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-resto-terracotta-600 animate-pulse" />
            {isRtl ? 'مساعد RestoFlow الذكي وقاعدة المعرفة (RAG)' : 'RestoFlow RAG Assistant & Knowledge Base'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl
              ? 'إجابات موثقة بالذكاء الاصطناعي مستندة إلى سياسات التشغيل وبيانات الأداء المعتمدة'
              : 'Grounded AI intelligence backed by operational SOPs, restaurant policies, and verified metrics.'}
          </p>
        </div>

        {/* Admin & Manager Sub-Tabs */}
        {isManagement && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeSubTab === 'chat'
                  ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {isRtl ? 'المحادثة والتحليلات' : 'Chat & Insights'}
            </button>
            <button
              onClick={() => setActiveSubTab('knowledge')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeSubTab === 'knowledge'
                  ? 'bg-resto-charcoal-800 text-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isRtl ? 'سجل قاعدة المعرفة' : 'Knowledge Registry'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area based on Sub-Tab */}
      {activeSubTab === 'knowledge' && isManagement ? (
        <KnowledgeBaseManager />
      ) : (
        <div className="space-y-6">
          {/* Management Only: Date Preset Bar & Verified Metrics Summary */}
          {isManagement && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-resto-terracotta-600" />
                  {isRtl ? 'نطاق بيانات التحليلات المباشرة:' : 'Live Metrics Period:'}
                </span>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(['ALL', 'TODAY', 'YESTERDAY', 'LAST_7', 'LAST_30', 'THIS_MONTH'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setDatePreset(p)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        datePreset === p
                          ? 'bg-resto-charcoal-800 text-white shadow-xs dark:bg-slate-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                    title={isRtl ? 'تحديث' : 'Refresh'}
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
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.revenue')}</span>
                    <span className="text-sm font-extrabold font-display text-emerald-600 dark:text-emerald-400 block">
                      {formatCurrency(metrics.total_revenue)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.completed')}</span>
                    <span className="text-sm font-extrabold font-display text-slate-900 dark:text-slate-100 block">
                      {metrics.completed_orders_count} {t('aiAssistant.ordersCount')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.avgTicket')}</span>
                    <span className="text-sm font-extrabold font-display text-slate-900 dark:text-slate-100 block">
                      {formatCurrency(metrics.average_order_value)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.profit')}</span>
                    <span className="text-sm font-extrabold font-display text-resto-terracotta-600 block">
                      {formatCurrency(metrics.gross_profit)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.cancelRate')}</span>
                    <span className="text-sm font-extrabold font-display text-red-600 dark:text-red-400 block">
                      {metrics.cancellation_rate}%
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('aiAssistant.lowStock')}</span>
                    <span className="text-sm font-extrabold font-display text-amber-600 dark:text-amber-400 block">
                      {metrics.inventory_low_stock_count} {t('aiAssistant.itemsCount')}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* Suggested Questions Action Chips */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-resto-terracotta-600" />
              {isRtl ? 'أسئلة مقترحة سريعة (سياسات ومؤشرات):' : 'Suggested Operational & Intelligence Queries:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(sq[isRtl ? 'ar' : 'en'])}
                  className="px-3 py-1.5 rounded-lg bg-card border border-slate-200 dark:border-slate-800 hover:border-resto-terracotta-500 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-resto-terracotta-600 transition-colors shadow-subtle text-left rtl:text-right"
                >
                  {sq[isRtl ? 'ar' : 'en']}
                </button>
              ))}
            </div>
          </div>

          {/* Conversational Chat Box */}
          <Card className="border border-slate-200 dark:border-slate-800 bg-card shadow-subtle flex flex-col h-[520px]">
            {/* Chat Box Header Bar */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isRtl ? 'محادثة المساعد الذكي المعتمد' : 'Verified AI Assistant Session'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Role: {user.role_name}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="h-7 px-2 text-[11px] text-slate-500 hover:text-red-600"
              >
                <Trash2 className="w-3 h-3 mr-1 rtl:mr-0 rtl:ml-1" />
                {isRtl ? 'مسح المحادثة' : 'Clear Chat'}
              </Button>
            </div>

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
                    className={`max-w-2xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-resto-charcoal-800 text-white rounded-br-none dark:bg-slate-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {/* Grounding Verification Badge */}
                    {msg.sender === 'assistant' && (
                      <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-200/50 dark:border-slate-700/50">
                        {msg.ragUsed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isRtl ? 'موثق عبر قاعدة معرفة RAG' : 'Grounded via RAG Knowledge Base'}
                          </span>
                        ) : msg.metricsSnapshot ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isRtl ? 'مؤشرات الأداء المعتمدة' : 'Verified Business Metrics'}
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className="whitespace-pre-line">{msg.text}</div>

                    {/* Interactive Source Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-resto-terracotta-600" />
                          {isRtl ? 'المصادر والسياسات المعتمدة المسترجعة:' : 'Retrieved SOP Citations:'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {msg.sources.map((src, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedCitation(src)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-resto-terracotta-600 hover:border-resto-terracotta-500 transition-colors shadow-2xs"
                              title={isRtl ? 'انقر لعرض تفاصيل المرجع' : 'Click to inspect citation'}
                            >
                              <span>{src.document_title}</span>
                              <span className="text-[9px] text-slate-400">
                                ({Math.round(src.similarity * 100)}%)
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <span className="text-[9px] opacity-60 block mt-2 text-right font-mono">
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
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-resto-terracotta-600 animate-pulse" />
                    {isRtl
                      ? 'جاري استرجاع متجهات قاعدة المعرفة وتحليل البيانات المعتمدة...'
                      : 'Retrieving knowledge vectors & synthesizing grounded answer...'}
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
                  placeholder={
                    isRtl
                      ? 'اسأل عن سياسات المطعم، الإلغاء، إعادة طلب المخزون، أو الإيرادات...'
                      : 'Ask about restaurant SOPs, refunds, reorder policies, or revenue...'
                  }
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
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1 font-mono">
                <span>✓ RAG Knowledge Base + Centralized Metrics</span>
                <span>Active Role: {user.role_name}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Citation Detail Modal */}
      <Modal
        isOpen={!!selectedCitation}
        onClose={() => setSelectedCitation(null)}
        title={selectedCitation?.document_title || ''}
        description={
          isRtl
            ? 'المقطع المعتمد المسترجع من قاعدة المعرفة بواسطة البحث الدلالي المتجه'
            : 'Operational source chunk retrieved via semantic vector search'
        }
        maxWidth="md"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-resto-terracotta-600 font-bold">
              {selectedCitation?.document_source}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {selectedCitation?.document_category}
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
            {selectedCitation?.content}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Chunk #{((selectedCitation?.chunk_index ?? 0) + 1)}</span>
            <span>Vector Match: {Math.round((selectedCitation?.similarity ?? 0) * 100)}%</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
