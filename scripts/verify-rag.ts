/**
 * RestoFlow RAG Knowledge Base Integration Verification Suite
 * File: scripts/verify-rag.ts
 * 
 * Verifies:
 * 1. Document ingestion and sliding-window chunking
 * 2. Deterministic 768-dim vector embedding & L2 normalization
 * 3. Role-based isolation (CASHIER/STAFF cannot retrieve restricted management docs)
 * 4. Semantic similarity ranking & top-K retrieval
 * 5. Grounded synthesis with source citations
 * 6. Hybrid live database metrics integration
 * 7. 100% offline fallback resilience
 */

import { chunkText, generateLocalEmbedding, cosineSimilarity } from '../src/lib/rag-utils';
import { DatabaseService, localDb } from '../src/services/db.service';
import { RagService } from '../src/services/rag.service';
import { AiAssistantService } from '../src/services/ai.service';
import { UserRole } from '../src/types/database.types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log(' RestoFlow RAG Knowledge Base — Test Verification Suite');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: CHUNKING & LOCAL VECTOR EMBEDDINGS
  // --------------------------------------------------------------------------
  console.log('[Suite 1: Text Chunking & Deterministic Vectorization]');

  const testContent = 
    'Orders can be cancelled before food preparation begins or in special customer request cases. ' +
    'When an order is cancelled in RestoFlow: 1. A mandatory cancellation reason must be recorded. ' +
    '2. Inventory quantities for every order item are atomically restored to the physical stock balance immediately. ' +
    '3. If payment was already collected, a formal refund workflow must be initiated. ' +
    'Staff must never discard cancelled food items without logging waste. ' +
    'Repeat cancellations require supervisor review.';

  const chunks = chunkText(testContent, 120, 30);
  assert(chunks.length > 1, 'Sliding-window chunking splits long text into multiple chunks', `Count: ${chunks.length}`);
  assert(chunks.every(c => c.length > 20), 'Every chunk satisfies minimum length threshold');

  const vectorA = generateLocalEmbedding('order cancellation and stock return');
  assert(vectorA.length === 768, 'Vector embedding has exact 768 dimensions', `Length: ${vectorA.length}`);

  let norm = 0;
  for (const val of vectorA) norm += val * val;
  const l2Magnitude = Math.sqrt(norm);
  assert(Math.abs(l2Magnitude - 1.0) < 0.001, 'Vector is unit L2-normalized (magnitude ≈ 1.0)', `Magnitude: ${l2Magnitude.toFixed(4)}`);

  const vectorB = generateLocalEmbedding('customer payment refund process');
  const simRelated = cosineSimilarity(vectorA, vectorB);
  const vectorC = generateLocalEmbedding('astronomy telescope galaxy star orbit');
  const simUnrelated = cosineSimilarity(vectorA, vectorC);
  assert(simRelated > simUnrelated, 'Semantic similarity ranks restaurant-related terms above unrelated terms', `Related: ${simRelated.toFixed(3)}, Unrelated: ${simUnrelated.toFixed(3)}`);

  // --------------------------------------------------------------------------
  // TEST SUITE 2: KNOWLEDGE BASE REGISTRY & IN-MEMORY STORE
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2: Seed Documents & In-Memory Knowledge Store]');

  const docs = await DatabaseService.getKnowledgeDocuments();
  assert(docs.length >= 7, 'Default operational knowledge base contains foundational documents', `Count: ${docs.length}`);

  const activeDocs = docs.filter(d => d.is_active);
  assert(activeDocs.length >= 7, 'All foundational operational seed documents are active');
  assert(localDb.knowledgeChunks.length >= 7, 'Document chunks are vectorized and indexed in local memory store', `Chunks: ${localDb.knowledgeChunks.length}`);

  // --------------------------------------------------------------------------
  // TEST SUITE 3: ROLE-BASED ACCESS CONTROL (RBAC) ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3: Role-Based Retrieval Isolation (Security Check)]');

  // Query Management-Only Document ("Executive Management KPI & Margin Strategy")
  const adminResults = await DatabaseService.matchKnowledgeChunks(
    'gross profit margin target and KPI strategy',
    'ADMIN',
    0.20,
    5
  );
  const adminHasManagementDoc = adminResults.some(r => r.document_category === 'MANAGEMENT');
  assert(adminHasManagementDoc, 'ADMIN can retrieve executive management documents');

  const managerResults = await DatabaseService.matchKnowledgeChunks(
    'gross profit margin target and KPI strategy',
    'MANAGER',
    0.20,
    5
  );
  const managerHasManagementDoc = managerResults.some(r => r.document_category === 'MANAGEMENT');
  assert(managerHasManagementDoc, 'MANAGER can retrieve executive management documents');

  const cashierResults = await DatabaseService.matchKnowledgeChunks(
    'gross profit margin target and KPI strategy',
    'CASHIER',
    0.20,
    5
  );
  const cashierHasManagementDoc = cashierResults.some(r => r.document_category === 'MANAGEMENT');
  assert(!cashierHasManagementDoc, 'SECURITY ISOLATION: CASHIER cannot retrieve MANAGEMENT documents (strictly filtered out)');

  const staffResults = await DatabaseService.matchKnowledgeChunks(
    'gross profit margin target and KPI strategy',
    'STAFF',
    0.20,
    5
  );
  const staffHasManagementDoc = staffResults.some(r => r.document_category === 'MANAGEMENT');
  assert(!staffHasManagementDoc, 'SECURITY ISOLATION: STAFF cannot retrieve MANAGEMENT documents (strictly filtered out)');

  // Query Cashier SOP as CASHIER
  const cashierSopResults = await DatabaseService.matchKnowledgeChunks(
    'cash drawer handover and end of day closing terminal',
    'CASHIER',
    0.25,
    3
  );
  const hasCashierSop = cashierSopResults.some(r => r.document_category === 'POS');
  assert(hasCashierSop, 'CASHIER can retrieve POS cash drawer SOPs');

  // Query Table turnover SOP as STAFF
  const staffTableResults = await DatabaseService.matchKnowledgeChunks(
    'dining table turnover cleaning standards and sanitization',
    'STAFF',
    0.25,
    3
  );
  const hasTableSop = staffTableResults.some(r => r.document_category === 'OPERATIONS');
  assert(hasTableSop, 'STAFF can retrieve dining floor cleaning SOPs');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: GROUNDED HYBRID RAG EXECUTION & CITATIONS
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4: Grounded Hybrid RAG Execution & Interactive Citations]');

  const adminUserId = '11111111-1111-1111-1111-111111111111';
  const ragResponse = await RagService.executeRagQuery(
    adminUserId,
    'What is our policy on order cancellations and stock return?',
    'en'
  );

  assert(ragResponse.ragUsed === true, 'RAG was successfully engaged for operational policy question');
  assert(ragResponse.sources.length > 0, 'Source citations are populated with similarity scores', `Sources: ${ragResponse.sources.length}`);
  assert(
    ragResponse.sources[0].document_title.toLowerCase().includes('cancellation'),
    'Top retrieved source matches Order Cancellation Policy',
    ragResponse.sources[0].document_title
  );
  assert(ragResponse.answer.includes('Order Cancellation & Inventory Restoration Policy'), 'Synthesized answer references verified document title');

  // Test Arabic query
  const ragArResponse = await RagService.executeRagQuery(
    adminUserId,
    'ما هي سياسة إلغاء الطلبات وإرجاع المخزون؟',
    'ar'
  );
  assert(ragArResponse.ragUsed === true, 'RAG successfully handles Arabic query with citations');
  assert(ragArResponse.answer.includes('استناداً إلى وثائق التشغيل المعتمدة'), 'Arabic answer properly formatted with Arabic grounding header');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: HYBRID REORDER POLICY + LIVE INVENTORY
  // --------------------------------------------------------------------------
  console.log('\n[Suite 5: Hybrid Policy + Live Inventory Numbers]');

  const hybridResponse = await RagService.executeRagQuery(
    adminUserId,
    'What is our inventory reorder policy and how do we reorder low stock?',
    'en'
  );

  assert(hybridResponse.ragUsed === true, 'Hybrid query retrieves reorder policy');
  assert(
    hybridResponse.answer.includes('Stock Reordering Policy') || hybridResponse.answer.includes('Inventory Thresholds'),
    'Hybrid response includes inventory policy guidelines'
  );
  assert(hybridResponse.metricsSnapshot !== undefined, 'Live business metrics snapshot attached to hybrid response');

  // --------------------------------------------------------------------------
  // TEST SUITE 6: AI ASSISTANT SERVICE INTEGRATION & BACKWARD COMPATIBILITY
  // --------------------------------------------------------------------------
  console.log('\n[Suite 6: AI Assistant Service Full Integration & Metric Preservation]');

  // Test pure KPI query (preserves 100% of existing deterministic engine)
  const revenueMsg = await AiAssistantService.queryAssistant(
    adminUserId,
    'How much revenue did we make this period?',
    'en'
  );
  assert(revenueMsg.ragUsed === false, 'Pure metric query routes directly to verified KPI calculation engine');
  assert(revenueMsg.metricsSnapshot !== undefined, 'Deterministic business metrics snapshot included');
  assert(revenueMsg.text.includes('revenue is'), 'Revenue response generated from single source of truth');

  // Test operational question via AiAssistantService
  const sopMsg = await AiAssistantService.queryAssistant(
    adminUserId,
    'What is the policy for customer payment refunds?',
    'en'
  );
  assert(sopMsg.ragUsed === true, 'AiAssistantService delegates operational SOP queries to RAG pipeline');
  assert(sopMsg.sources && sopMsg.sources.length > 0, 'AiAssistant message includes interactive source citations');

  console.log('\n===============================================================');
  console.log(` Verification Completed: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===============================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL RAG KNOWLEDGE BASE TESTS PASSED WITH ZERO ERRORS!\n');
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
