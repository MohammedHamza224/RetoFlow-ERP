import { DatabaseService } from './db.service';
import { BusinessMetrics } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  metricsSnapshot?: BusinessMetrics;
  periodLabel?: string;
}

export class AiAssistantService {
  /**
   * Safe, Read-Only AI Query Processor Sourced 100% from Centralized Business Metrics
   */
  static async queryAssistant(
    userId: string | undefined,
    question: string,
    language: 'en' | 'ar' = 'en',
    startDate?: string,
    endDate?: string,
    periodLabel: string = 'Current Period'
  ): Promise<AiChatMessage> {
    // 1. Strict Role Security Authorization Check
    const role = DatabaseService.getUserRole(userId);
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new Error(
        language === 'ar'
          ? 'غير مصرح: الوصول إلى مساعد الذكاء الاصطناعي يتطلب صلاحية مدير النظام أو المشرف.'
          : 'Unauthorized: Access to AI Assistant requires ADMIN or MANAGER privileges.'
      );
    }

    // 2. Fetch Centralized Business Metrics (Single Source of Truth)
    const metrics = await DatabaseService.getBusinessMetrics(userId, startDate, endDate);
    const breakdown = await DatabaseService.getAnalyticsBreakdown(userId, startDate, endDate);

    const q = question.toLowerCase().trim();
    const isAr = language === 'ar';
    let responseText = '';

    // 3. Match Intent & Build Trusted Fact-Based Response
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
    };
  }
}
