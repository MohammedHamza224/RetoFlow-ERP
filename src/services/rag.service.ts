/**
 * RestoFlow RAG (Retrieval-Augmented Generation) Knowledge Base Service
 * 
 * Modular pipeline:
 * Document Cleaning -> Chunking -> Vector Similarity Retrieval -> Hybrid Context Assembly -> Grounded Synthesis.
 * Enforces role-based access filtering before context is passed to the generation layer.
 */

import { DatabaseService } from './db.service';
import {
  KnowledgeDocument,
  KnowledgeChunk,
  RagSourceCitation,
  RagQueryResponse,
  UserRole,
  BusinessMetrics,
  Product,
} from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { chunkText, generateLocalEmbedding, cosineSimilarity } from '@/lib/rag-utils';

export class RagService {
  /**
   * Split document content into clean, semantic chunks with sliding overlap
   */
  static chunkDocument(
    content: string,
    chunkSize: number = 320,
    chunkOverlap: number = 50
  ): string[] {
    return chunkText(content, chunkSize, chunkOverlap);
  }

  /**
   * Generates a 768-dimension local embedding
   */
  static generateLocalEmbedding(text: string, dimensions: number = 768): number[] {
    return generateLocalEmbedding(text, dimensions);
  }

  /**
   * Role-Filtered Retrieval: Vector Similarity Search across Knowledge Base
   */
  static async retrieveRelevantChunks(
    queryText: string,
    callerRole: UserRole = 'STAFF',
    topK: number = 4,
    similarityThreshold: number = 0.35
  ): Promise<RagSourceCitation[]> {
    return await DatabaseService.matchKnowledgeChunks(
      queryText,
      callerRole,
      similarityThreshold,
      topK
    );
  }

  /**
   * Hybrid RAG Query Pipeline:
   * Combines retrieved restaurant policies + live database metrics for authorized roles
   */
  static async executeRagQuery(
    userId: string | undefined,
    question: string,
    language: 'en' | 'ar' = 'en',
    startDate?: string,
    endDate?: string,
    periodLabel: string = 'Current Period'
  ): Promise<RagQueryResponse> {
    const startTime = Date.now();
    const callerRole = DatabaseService.getUserRole(userId);
    const isAr = language === 'ar';
    const qLower = question.toLowerCase().trim();

    // 1. Role-Filtered Vector Knowledge Retrieval
    const relevantChunks = await this.retrieveRelevantChunks(
      question,
      callerRole === 'UNAUTHENTICATED' ? 'STAFF' : callerRole,
      4,
      0.35
    );

    // 2. Fetch Live Business Metrics (only if caller has ADMIN or MANAGER privileges)
    let liveMetrics: BusinessMetrics | undefined = undefined;
    let productsNeedingReorder: Product[] = [];

    const isLiveMetricsAuthorized = callerRole === 'ADMIN' || callerRole === 'MANAGER';
    if (isLiveMetricsAuthorized) {
      try {
        liveMetrics = await DatabaseService.getBusinessMetrics(userId, startDate, endDate);
        const allProducts = await DatabaseService.getProducts();
        productsNeedingReorder = allProducts.filter(
          p => p.is_active && p.stock_quantity <= p.minimum_stock
        );
      } catch (e) {
        console.warn('[RagService] Live metrics fetch optional fallback:', e);
      }
    }

    // 3. Determine if Query is purely Metric, purely Policy, or Hybrid
    const hasLiveKeywords =
      qLower.includes('revenue') || qLower.includes('sales') || qLower.includes('إيراد') ||
      qLower.includes('مبيعات') || qLower.includes('profit') || qLower.includes('ربح') ||
      qLower.includes('aov') || qLower.includes('ticket') || qLower.includes('قيمة الطلب') ||
      qLower.includes('best') || qLower.includes('top') || qLower.includes('أفضل') ||
      qLower.includes('أكثر مبيعاً');

    const hasKnowledge = relevantChunks.length > 0;

    // 4. Grounded Synthesis
    let answerText = '';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'HIGH';

    if (hasKnowledge) {
      // Primary Knowledge Base Grounded Synthesis
      const primaryChunk = relevantChunks[0];
      const sourceTitles = Array.from(new Set(relevantChunks.map(c => c.document_title))).join(' & ');

      // Check if hybrid (needs current numbers + policy)
      const isReorderHybrid =
        (qLower.includes('reorder') || qLower.includes('إعادة طلب') || qLower.includes('نقص')) &&
        (qLower.includes('policy') || qLower.includes('سياسة') || qLower.includes('how') || qLower.includes('كيف'));

      if (isReorderHybrid && liveMetrics && productsNeedingReorder.length >= 0) {
        const productListStr = productsNeedingReorder.length > 0
          ? productsNeedingReorder.map(p => `• **${p.name}** (SKU: ${p.sku}) — ${isAr ? 'الرصيد الحالي' : 'Stock'}: ${p.stock_quantity} / ${isAr ? 'الحد الأدنى' : 'Min'}: ${p.minimum_stock}`).join('\n')
          : (isAr ? '• جميع الأصناف حالياً أعلى من الحد الأدنى للمخزون.' : '• All tracked menu items are currently above threshold.');

        answerText = isAr
          ? `### إجراءات إعادة الطلب وسياسة المخزون المعتمدة:\n${primaryChunk.content}\n\n` +
            `### حالة المخزون الحالية المباشرة (${productsNeedingReorder.length} ${isAr ? 'منتجات تحتاج إعادة طلب' : 'products need attention'}):\n${productListStr}`
          : `### Stock Reordering Policy & Procedure:\n${primaryChunk.content}\n\n` +
            `### Live Inventory Status (${productsNeedingReorder.length} products requiring reorder):\n${productListStr}`;

      } else {
        // Standard Grounded Knowledge Response with Citations
        answerText = isAr
          ? `استناداً إلى وثائق التشغيل المعتمدة (**${sourceTitles}**):\n\n${relevantChunks.map(c => c.content).join('\n\n')}`
          : `Based on verified operational documentation (**${sourceTitles}**):\n\n${relevantChunks.map(c => c.content).join('\n\n')}`;
      }

      confidence = relevantChunks[0].similarity > 0.6 ? 'HIGH' : 'MEDIUM';

    } else if (hasLiveKeywords && liveMetrics) {
      // Pure Business Metrics Fallback
      confidence = 'HIGH';
      if (qLower.includes('revenue') || qLower.includes('إيراد') || qLower.includes('sales')) {
        answerText = isAr
          ? `بناءً على البيانات المعتمدة لـ (${periodLabel})، بلغت إجمالي الإيرادات **${formatCurrency(liveMetrics.total_revenue)}** من خلال **${liveMetrics.completed_orders_count}** طلب مكتمل.`
          : `Based on verified restaurant data for (${periodLabel}), total revenue is **${formatCurrency(liveMetrics.total_revenue)}** across **${liveMetrics.completed_orders_count}** completed orders.`;
      } else if (qLower.includes('profit') || qLower.includes('ربح')) {
        answerText = isAr
          ? `إجمالي الربح الهامشي لفترة (${periodLabel}) هو **${formatCurrency(liveMetrics.gross_profit)}**، محسبة بناءً على تكلفة الوحدات التاريخية.`
          : `Gross Profit for (${periodLabel}) is **${formatCurrency(liveMetrics.gross_profit)}**, strictly using historical snapshot item costs.`;
      } else {
        answerText = isAr
          ? `ملخص أداء المطعم لـ (${periodLabel}): إيرادات: **${formatCurrency(liveMetrics.total_revenue)}** | طلبات مكتملة: **${liveMetrics.completed_orders_count}** | متوسط الطلب: **${formatCurrency(liveMetrics.average_order_value)}** | ربح: **${formatCurrency(liveMetrics.gross_profit)}**.`
          : `Performance summary for (${periodLabel}): Revenue: **${formatCurrency(liveMetrics.total_revenue)}** | Orders: **${liveMetrics.completed_orders_count}** | AOV: **${formatCurrency(liveMetrics.average_order_value)}** | Profit: **${formatCurrency(liveMetrics.gross_profit)}**.`;
      }

    } else {
      // Nothing Found in Knowledge Base
      confidence = 'NONE';
      answerText = isAr
        ? `عذراً، لم يتم العثور على إجراءات أو معلومات مطابقة في قاعدة المعرفة المعتمدة لصلاحيتك (${callerRole}). يرجى مراجعة إدارة المطعم أو التأكد من إدخال الوثيقة المطلوبة.`
        : `Information not found in the verified knowledge base for your role (${callerRole}). Please consult restaurant management or verify that the relevant SOP is indexed.`;
    }

    const latencyMs = Date.now() - startTime;

    return {
      answer: answerText,
      sources: relevantChunks,
      ragUsed: hasKnowledge,
      confidence,
      latencyMs,
      metricsSnapshot: liveMetrics,
    };
  }
}
