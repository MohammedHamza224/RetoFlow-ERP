// ============================================================================
// RestoFlow: RAG Assistant Supabase Edge Function
// File: supabase/functions/rag-assistant/index.ts
// Description: Secure server-side endpoint for RAG query processing.
//              Enforces caller role authorization, server-side secrets,
//              role-filtered vector retrieval, and grounded synthesis.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Deterministic 768-dimensional local vector embedding generator
 */
function generateLocalVector(text: string, dimensions: number = 768): number[] {
  const normalized = text.toLowerCase().trim();
  const vector = new Array(dimensions).fill(0);
  const tokens = normalized.split(/\s+|[.,!?;:()\[\]]/).filter((t: string) => t.length > 1);

  if (tokens.length === 0) return vector;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let hash = 0;
    for (let j = 0; j < token.length; j++) {
      hash = (hash << 5) - hash + token.charCodeAt(j);
      hash |= 0;
    }

    const idx1 = Math.abs(hash) % dimensions;
    const idx2 = Math.abs((hash * 31) ^ (i * 17)) % dimensions;
    const weight = 1.0 / Math.sqrt(tokens.length);

    vector[idx1] += weight;
    vector[idx2] += weight * 0.5;
  }

  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing (Service Key)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify Caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: callerAuthUser }, error: callerAuthError } = await userClient.auth.getUser();
    if (callerAuthError || !callerAuthUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch Caller Application Role
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("users")
      .select("id, name, is_active, role:roles(name)")
      .eq("id", callerAuthUser.id)
      .single();

    if (callerProfileError || !callerProfile || !callerProfile.is_active) {
      return new Response(
        JSON.stringify({ error: "User profile not found or account is deactivated." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole: string = (callerProfile.role as any)?.name ?? "STAFF";

    // 3. Parse Request Body
    const body = await req.json();
    const { question, language = "en", startDate, endDate, periodLabel = "Current Period" } = body;

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Question string is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAr = language === "ar";
    const qLower = question.toLowerCase().trim();

    // 4. Generate Query Vector Embedding
    const queryVector = generateLocalVector(question, 768);

    // 5. Execute Role-Filtered Vector Search RPC
    const { data: matchedChunks, error: rpcError } = await adminClient.rpc(
      "match_knowledge_chunks",
      {
        query_embedding: queryVector,
        match_threshold: 0.35,
        match_count: 4,
        caller_role: callerRole,
      }
    );

    if (rpcError) {
      console.warn("[rag-assistant] Vector search RPC notice:", rpcError.message);
    }

    const sources = (matchedChunks || []).map((chunk: any) => ({
      document_id: chunk.document_id,
      document_title: chunk.document_title,
      document_category: chunk.document_category,
      document_source: chunk.document_source || "Operational SOP",
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      similarity: chunk.similarity,
    }));

    // 6. Fetch Business Metrics if authorized
    let liveMetrics: any = null;
    let productsNeedingReorder: any[] = [];
    const isLiveMetricsAuthorized = callerRole === "ADMIN" || callerRole === "MANAGER";

    if (isLiveMetricsAuthorized) {
      try {
        const { data: metricsData } = await adminClient.rpc("get_business_metrics", {
          p_start_date: startDate || null,
          p_end_date: endDate || null,
        });
        if (metricsData) liveMetrics = metricsData;

        const { data: lowStock } = await adminClient
          .from("products")
          .select("id, name, sku, stock_quantity, minimum_stock")
          .eq("is_active", true)
          .filter("stock_quantity", "lte", "minimum_stock");
        if (lowStock) productsNeedingReorder = lowStock;
      } catch (e) {
        console.warn("[rag-assistant] Metrics lookup notice:", e);
      }
    }

    // 7. Grounded Synthesis
    const hasKnowledge = sources.length > 0;
    let answerText = "";
    let confidence = hasKnowledge ? "HIGH" : "NONE";

    if (hasKnowledge) {
      const sourceTitles = Array.from(new Set(sources.map((s: any) => s.document_title))).join(" & ");
      const isReorderHybrid =
        (qLower.includes("reorder") || qLower.includes("إعادة طلب") || qLower.includes("نقص")) &&
        (qLower.includes("policy") || qLower.includes("سياسة") || qLower.includes("how") || qLower.includes("كيف"));

      if (isReorderHybrid && liveMetrics) {
        const productListStr = productsNeedingReorder.length > 0
          ? productsNeedingReorder.map((p: any) => `• **${p.name}** (SKU: ${p.sku}) — ${isAr ? 'الرصيد الحالي' : 'Stock'}: ${p.stock_quantity} / ${isAr ? 'الحد الأدنى' : 'Min'}: ${p.minimum_stock}`).join('\n')
          : (isAr ? '• جميع الأصناف حالياً أعلى من الحد الأدنى للمخزون.' : '• All tracked menu items are currently above threshold.');

        answerText = isAr
          ? `### إجراءات إعادة الطلب وسياسة المخزون المعتمدة:\n${sources[0].content}\n\n` +
            `### حالة المخزون الحالية المباشرة (${productsNeedingReorder.length} منتجات تحتاج إعادة طلب):\n${productListStr}`
          : `### Stock Reordering Policy & Procedure:\n${sources[0].content}\n\n` +
            `### Live Inventory Status (${productsNeedingReorder.length} products requiring reorder):\n${productListStr}`;
      } else {
        answerText = isAr
          ? `استناداً إلى وثائق التشغيل المعتمدة (**${sourceTitles}**):\n\n${sources.map((s: any) => s.content).join('\n\n')}`
          : `Based on verified operational documentation (**${sourceTitles}**):\n\n${sources.map((s: any) => s.content).join('\n\n')}`;
      }
    } else {
      confidence = "NONE";
      answerText = isAr
        ? `عذراً، لم يتم العثور على إجراءات أو معلومات مطابقة في قاعدة المعرفة المعتمدة لصلاحيتك (${callerRole}). يرجى مراجعة إدارة المطعم.`
        : `Information not found in the verified knowledge base for your role (${callerRole}). Please consult restaurant management or verify that the relevant SOP is indexed.`;
    }

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        answer: answerText,
        sources,
        ragUsed: hasKnowledge,
        confidence,
        latencyMs,
        metricsSnapshot: liveMetrics,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[rag-assistant] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
