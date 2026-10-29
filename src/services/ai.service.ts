import { DatabaseService } from './db.service';
import { RagService } from './rag.service';
import { BusinessMetrics, RagSourceCitation } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  metricsSnapshot?: BusinessMetrics;
  periodLabel?: string;
  sources?: RagSourceCitation[];
  ragUsed?: boolean;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

export class AiAssistantService {
  /**
   * Safe, Multi-Role AI Query Processor combining Grounded RAG Knowledge Base
   * with Centralized Deterministic Business Metrics.
   */
  static async queryAssistant(
    userId: string | undefined,
    question: string,
    language: 'en' | 'ar' = 'en',
    startDate?: string,
    endDate?: string,
    periodLabel: string = 'Current Period'
  ): Promise<AiChatMessage> {
    const role = DatabaseService.getUserRole(userId);
    const isAr = language === 'ar';
    const q = question.toLowerCase().trim();

    // 1. Role Authorization Check:
    // Any active authenticated role (ADMIN, MANAGER, CASHIER, STAFF) can query within their permissions.
    if (role === 'UNAUTHENTICATED') {
      throw new Error(
        isAr
          ? 'غير مصرح: يجب تسجيل الدخول للوصول إلى المساعد الذكي.'
          : 'Unauthorized: User authentication required to access AI Assistant.'
      );
    }

    // 2. Identify pure metric-only intent vs policy/SOP/hybrid intent
    const isExplicitMetricQuery =
      (q.includes('revenue') || q.includes('إيراد') || q.includes('sales') || q.includes('دخل') ||
       q.includes('aov') || q.includes('متوسط الطلب') || q.includes('قيمة الطلب') ||
       q.includes('profit') || q.includes('ربح') || q.includes('أرباح') || q.includes('margin') ||
       q.includes('best') || q.includes('top') || q.includes('أفضل') || q.includes('الأكثر مبيعاً')) &&
      !q.includes('policy') && !q.includes('سياسة') && !q.includes('sop') && !q.includes('إجراء') &&
      !q.includes('how') && !q.includes('كيف') && !q.includes('guide') && !q.includes('دليل');

    // If caller is CASHIER or STAFF and attempts to query management-only BI metrics
    if (isExplicitMetricQuery && role !== 'ADMIN' && role !== 'MANAGER') {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: isAr
          ? 'عذراً، الاطلاع على مؤشرات الأداء المالي والأرباح يتطلب صلاحيات المشرف أو مدير النظام.'
          : 'Access to financial KPIs, gross profit, and store revenue requires MANAGER or ADMIN role.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 'NONE',
        ragUsed: false,
      };
    }

    // 3. First attempt RAG Knowledge Base Retrieval
    try {
      const ragResponse = await RagService.executeRagQuery(
        userId,
        question,
        language,
        startDate,
        endDate,
        periodLabel
      );

      // If relevant operational knowledge was found or hybrid synthesis was applied
      if (ragResponse.ragUsed && ragResponse.sources.length > 0) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: ragResponse.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          metricsSnapshot: ragResponse.metricsSnapshot,
          periodLabel,
          sources: ragResponse.sources,
          ragUsed: true,
          confidence: ragResponse.confidence,
        };
      }
    } catch (ragError) {
      console.warn('[AiAssistantService] RAG pipeline notice, falling back to core engine:', ragError);
    }

    // 4. Fallback to Centralized Deterministic Business Metrics for ADMIN & MANAGER
    if (role === 'ADMIN' || role === 'MANAGER') {
      const metrics = await DatabaseService.getBusinessMetrics(userId, startDate, endDate);
      let responseText = '';

      if (q.includes('revenue') || q.includes('إيراد') || q.includes('مبيعات') || q.includes('sales') || q.includes('make') || q.includes('دخل')) {
        responseText = isAr
          ? `بناءً على البيانات المعتمدة لـ (${periodLabel})، بلغت إجمالي الإيرادات الخافضة للاستردادات **${formatCurrency(metrics.total_revenue)}** من خلال تنفيذ **${metrics.completed_orders_count}** طلب مكتمل.`
          : `Based on verified restaurant data for (${periodLabel}), your total refund-aware revenue is **${formatCurrency(metrics.total_revenue)}** across **${metrics.completed_orders_count}** completed orders.`;

      } else if (q.includes('aov') || q.includes('average order') || q.includes('متوسط الطلب') || q.includes('قيمة الطلب')) {
        responseText = isAr
          ? `متوسط قيمة الطلب (AOV) لفترة (${periodLabel}) هو **${formatCurrency(metrics.average_order_value)}** لكل تذكرة مبيعات مكتملة.`
          : `Your Average Order Value (AOV) for (${periodLabel}) is **${formatCurrency(metrics.average_order_value)}** per completed ticket.`;

      } else if (q.includes('profit') || q.includes('ربح') || q.includes('أرباح') || q.includes('margin')) {
        responseText = isAr
          ? `إجمالي الربح الهامشي لفترة (${periodLabel}) هو **${formatCurrency(metrics.gross_profit)}**، محسبة بناءً على تكلفة الوحدات التاريخية عند إتمام كل طلب.`
          : `Your Gross Profit for (${periodLabel}) is **${formatCurrency(metrics.gross_profit)}**, calculated strictly using snapshot historical item unit costs.`;

      } else if (q.includes('best') || q.includes('top') || q.includes('أفضل') || q.includes('الأكثر مبيعاً') || q.includes('منتج')) {
        responseText = isAr
          ? `المنتج الأكثر مبيعاً لفترة (${periodLabel}) هو **${metrics.top_selling_product_name}**.`
          : `Your top-selling product for (${periodLabel}) is **${metrics.top_selling_product_name}**.`;

      } else if (q.includes('cancel') || q.includes('إلغاء') || q.includes('ملغاة') || q.includes('rate')) {
        responseText = isAr
          ? `تم إلغاء **${metrics.cancelled_orders_count}** طلب بنسبة إلغاء إجمالية قدرها **${metrics.cancellation_rate}%** خلال فترة (${periodLabel}).`
          : `There were **${metrics.cancelled_orders_count}** cancelled orders during (${periodLabel}), representing a cancellation rate of **${metrics.cancellation_rate}%**.`;

      } else if (q.includes('stock') || q.includes('inventory') || q.includes('مخزون') || q.includes('تنبيه') || q.includes('low')) {
        responseText = isAr
          ? `يوجد حالياً **${metrics.inventory_low_stock_count}** منتج نشط عند أو أقل من حد الأدنى للمخزون ويتطلب إعادة طلب.`
          : `There are currently **${metrics.inventory_low_stock_count}** active products at or below their minimum stock threshold requiring attention.`;

      } else {
        // General Executive Summary Response
        responseText = isAr
          ? `إليك ملخص أداء المطعم المعتمد لـ (${periodLabel}):\n` +
            `• **إجمالي الإيرادات**: ${formatCurrency(metrics.total_revenue)}\n` +
            `• **الطلبات المكتملة**: ${metrics.completed_orders_count}\n` +
            `• **متوسط قيمة الطلب**: ${formatCurrency(metrics.average_order_value)}\n` +
            `• **إجمالي الربح**: ${formatCurrency(metrics.gross_profit)}\n` +
            `• **نسبة الإلغاء**: ${metrics.cancellation_rate}%\n` +
            `• **المنتج الأعلى مبيعاً**: ${metrics.top_selling_product_name}\n` +
            `• **تنبيهات المخزون المنخفض**: ${metrics.inventory_low_stock_count} منتجات`
          : `Here is the verified executive performance summary for (${periodLabel}):\n` +
            `• **Total Revenue**: ${formatCurrency(metrics.total_revenue)}\n` +
            `• **Completed Orders**: ${metrics.completed_orders_count}\n` +
            `• **Average Order Value**: ${formatCurrency(metrics.average_order_value)}\n` +
            `• **Gross Profit**: ${formatCurrency(metrics.gross_profit)}\n` +
            `• **Cancellation Rate**: ${metrics.cancellation_rate}%\n` +
            `• **Top Selling Product**: ${metrics.top_selling_product_name}\n` +
            `• **Low Stock Alert**: ${metrics.inventory_low_stock_count} products requiring attention`;
      }

      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metricsSnapshot: metrics,
        periodLabel,
        ragUsed: false,
        confidence: 'HIGH',
      };
    }

    // 5. Default Response for Staff when no knowledge chunk matched
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: isAr
        ? 'عذراً، لم أجد إجابة مطابقة في قاعدة المعرفة المعتمدة لصلاحيات حسابك. يرجى مراجعة إدارة المطعم.'
        : 'No matching policy or procedure found in the knowledge base for your role. Please consult restaurant management.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ragUsed: false,
      confidence: 'NONE',
    };
  }
}
