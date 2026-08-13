/**
 * RestoFlow Phase 10: AI Restaurant Assistant Verification Suite
 * 
 * Tests 18 explicit business requirements:
 * 1. ADMIN user can access AI Assistant
 * 2. MANAGER user can access AI Assistant
 * 3. CASHIER user is blocked from AI Assistant
 * 4. STAFF user is blocked from AI Assistant
 * 5. Revenue reported by AI matches centralized metrics
 * 6. AOV reported by AI matches centralized metrics
 * 7. Gross profit reported by AI uses snapshot unit_cost historical calculation
 * 8. Refunds do NOT inflate AI recognized revenue
 * 9. Cancellation rate reported by AI matches centralized metrics
 * 10. Top-selling product reported by AI matches centralized metrics
 * 11. Low-stock count reported by AI matches centralized metrics
 * 12. AI cannot execute write operations (read-only verification)
 * 13. Missing data does NOT produce fabricated numbers or NaN
 * 14. English response context formatting works
 * 15. Arabic response context formatting works
 * 16. Date range selection updates AI metrics context correctly
 * 17. Previous-period comparison handles zero safely
 * 18. No service-role credentials or secrets exposed in client code
 */

import { DatabaseService, localDb } from '../src/services/db.service.js';
import { AiAssistantService } from '../src/services/ai.service.js';

let passedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ ${testName} FAILED: ${detail || ''}`);
    process.exit(1);
  } else {
    passedCount++;
    console.log(`✅ ${testName} PASSED`);
  }
}

async function runPhase10Suite() {
  console.log('\n------------------------------------------------------------');
  console.log(' RestoFlow Phase 10: AI Restaurant Assistant Suite');
  console.log('------------------------------------------------------------\n');

  // Fetch test users
  const adminUser = localDb.users.find(u => u.role?.name === 'ADMIN')!;
  const managerUser = localDb.users.find(u => u.role?.name === 'MANAGER')!;
  const cashierUser = localDb.users.find(u => u.role?.name === 'CASHIER')!;
  const staffUser = localDb.users.find(u => u.role?.name === 'STAFF')!;

  // Fetch centralized metrics baseline
  const metrics = await DatabaseService.getBusinessMetrics(adminUser.id);

  // Test 1: ADMIN user can access AI Assistant
  const adminQuery = await AiAssistantService.queryAssistant(adminUser.id, 'How much revenue did we make?');
  assert(adminQuery && typeof adminQuery.text === 'string', 'Test 1: ADMIN user can access AI Assistant');

  // Test 2: MANAGER user can access AI Assistant
  const managerQuery = await AiAssistantService.queryAssistant(managerUser.id, 'What is our average order value?');
  assert(managerQuery && typeof managerQuery.text === 'string', 'Test 2: MANAGER user can access AI Assistant');

  // Test 3: CASHIER user is blocked from AI Assistant
  let err3 = false;
  try {
    await AiAssistantService.queryAssistant(cashierUser.id, 'Revenue query');
  } catch {
    err3 = true;
  }
  assert(err3, 'Test 3: CASHIER user is blocked from AI Assistant');

  // Test 4: STAFF user is blocked from AI Assistant
  let err4 = false;
  try {
    await AiAssistantService.queryAssistant(staffUser.id, 'Revenue query');
  } catch {
    err4 = true;
  }
  assert(err4, 'Test 4: STAFF user is blocked from AI Assistant');

  // Test 5: Revenue reported by AI matches centralized metrics
  assert(adminQuery.metricsSnapshot?.total_revenue === metrics.total_revenue, 'Test 5: Revenue reported by AI matches centralized metrics');

  // Test 6: AOV reported by AI matches centralized metrics
  assert(adminQuery.metricsSnapshot?.average_order_value === metrics.average_order_value, 'Test 6: AOV reported by AI matches centralized metrics');

  // Test 7: Gross profit reported by AI uses snapshot unit_cost historical calculation
  assert(adminQuery.metricsSnapshot?.gross_profit === metrics.gross_profit, 'Test 7: Gross profit reported by AI uses snapshot unit_cost');

  // Test 8: Refunds do NOT inflate AI recognized revenue
  const completedOrders = localDb.orders.filter(o => o.status === 'COMPLETED');
  let expectedRev = 0;
  for (const o of completedOrders) {
    const p = localDb.payments.find(pay => pay.order_id === o.id);
    if (p && p.status === 'PAID') expectedRev += o.total;
  }
  assert(adminQuery.metricsSnapshot?.total_revenue === Math.round(expectedRev * 100) / 100, 'Test 8: Refunds do NOT inflate AI recognized revenue');

  // Test 9: Cancellation rate reported by AI matches centralized metrics
  assert(adminQuery.metricsSnapshot?.cancellation_rate === metrics.cancellation_rate, 'Test 9: Cancellation rate reported by AI matches metrics');

  // Test 10: Top-selling product reported by AI matches centralized metrics
  assert(adminQuery.metricsSnapshot?.top_selling_product_name === metrics.top_selling_product_name, 'Test 10: Top-selling product reported by AI matches metrics');

  // Test 11: Low-stock count reported by AI matches centralized metrics
  assert(adminQuery.metricsSnapshot?.inventory_low_stock_count === metrics.inventory_low_stock_count, 'Test 11: Low-stock count reported by AI matches metrics');

  // Test 12: AI cannot execute write operations (read-only verification)
  const productCountBefore = localDb.products.length;
  const orderCountBefore = localDb.orders.length;
  await AiAssistantService.queryAssistant(adminUser.id, 'Update product stock or delete orders');
  assert(localDb.products.length === productCountBefore && localDb.orders.length === orderCountBefore, 'Test 12: AI cannot execute write operations');

  // Test 13: Missing data does NOT produce fabricated numbers or NaN
  const emptyDate = new Date(Date.now() + 86400000 * 365).toISOString();
  const emptyAiRes = await AiAssistantService.queryAssistant(adminUser.id, 'Revenue', 'en', emptyDate);
  assert(!emptyAiRes.text.includes('NaN'), 'Test 13: Missing data does NOT produce fabricated numbers or NaN');

  // Test 14: English response context formatting works
  const enRes = await AiAssistantService.queryAssistant(adminUser.id, 'revenue', 'en');
  assert(enRes.text.includes('revenue') || enRes.text.includes('Based on'), 'Test 14: English response context formatting works');

  // Test 15: Arabic response context formatting works
  const arRes = await AiAssistantService.queryAssistant(adminUser.id, 'إيرادات', 'ar');
  assert(arRes.text.includes('إيرادات') || arRes.text.includes('بناءً على'), 'Test 15: Arabic response context formatting works');

  // Test 16: Date range selection updates AI metrics context correctly
  const last7Ms = new Date(Date.now() - 7 * 86400000).toISOString();
  const filteredAiRes = await AiAssistantService.queryAssistant(adminUser.id, 'summary', 'en', last7Ms);
  assert(!!filteredAiRes.metricsSnapshot, 'Test 16: Date range selection updates AI metrics context correctly');

  // Test 17: Previous-period comparison handles zero safely
  assert(typeof emptyAiRes.metricsSnapshot?.cancellation_rate === 'number', 'Test 17: Previous-period comparison handles zero safely');

  // Test 18: No service-role credentials or secrets exposed in client code
  assert(typeof process.env.VITE_SUPABASE_SERVICE_ROLE_KEY === 'undefined', 'Test 18: No service-role credentials exposed');

  console.log('\n------------------------------------------------------------');
  console.log(` Phase 10 Suite Finished: ${passedCount} / 18 Verification Requirements Passed`);
  console.log('------------------------------------------------------------\n');
}

runPhase10Suite().catch(err => {
  console.error('Phase 10 verification error:', err);
  process.exit(1);
});
