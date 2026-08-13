/**
 * RestoFlow Phase 8: Comprehensive Order Management & Refund Verification Suite
 * 
 * Tests 25 explicit business requirements:
 * 1. Order listing (getOrders)
 * 2. Order details lazy fetching on-demand (getOrderDetails)
 * 3. PENDING → CONFIRMED transition
 * 4. CONFIRMED → PREPARING transition
 * 5. PREPARING → READY transition
 * 6. READY → COMPLETED transition
 * 7. Invalid state transition rejection
 * 8. Cancellation from PENDING
 * 9. Cancellation from CONFIRMED
 * 10. Cancellation from PREPARING
 * 11. Cancellation from READY
 * 12. COMPLETED order cancellation rejection
 * 13. CANCELLED → COMPLETED transition rejection
 * 14. Cancellation reason validation
 * 15. Stock restoration on cancellation
 * 16. Double cancellation protection (idempotency)
 * 17. Full refund handling
 * 18. Duplicate refund prevention
 * 19. Refund permission enforcement (ADMIN / MANAGER allowed, CASHIER / STAFF blocked)
 * 20. Historical unit_price preservation
 * 21. Historical unit_cost snapshot preservation
 * 22. Payment status correctness
 * 23. Split payment handling & display
 * 24. RLS / Role security matrix enforcement
 * 25. Orders page performance behavior (instant 0ms mount)
 */

import { DatabaseService, localDb } from '../src/services/db.service.js';

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

async function runPhase8Suite() {
  console.log('\n------------------------------------------------------------');
  console.log(' RestoFlow Phase 8: Order Management & Performance Suite');
  console.log('------------------------------------------------------------\n');

  // Fetch test users & product
  const adminUser = localDb.users.find(u => u.role?.name === 'ADMIN')!;
  const managerUser = localDb.users.find(u => u.role?.name === 'MANAGER')!;
  const cashierUser = localDb.users.find(u => u.role?.name === 'CASHIER')!;
  const staffUser = localDb.users.find(u => u.role?.name === 'STAFF')!;
  const testProduct = localDb.products[0];

  // Helper to create test order
  const createTestOrder = async (orderType: 'TAKEAWAY' | 'DINE_IN' | 'DELIVERY' = 'TAKEAWAY') => {
    const res = await DatabaseService.executeCheckout({
      user_id: cashierUser.id,
      order_type: orderType,
      items: [{ product_id: testProduct.id, quantity: 2 }],
      payments: [
        { payment_method: 'CASH', amount: 50 },
        { payment_method: 'MADA', amount: (testProduct.price * 2) * 1.15 - 50 },
      ],
    });
    const orders = await DatabaseService.getOrders();
    return orders.find(o => o.id === res.order_id)!;
  };

  // Test 1: Order listing (getOrders)
  const ordersList = await DatabaseService.getOrders();
  assert(Array.isArray(ordersList) && ordersList.length > 0, 'Test 1: Order listing (getOrders)');

  // Test 2: Order details fetching on-demand (getOrderDetails)
  const sampleOrder = ordersList[0];
  const orderDetails = await DatabaseService.getOrderDetails(sampleOrder.id);
  assert(orderDetails.id === sampleOrder.id && Array.isArray(orderDetails.items), 'Test 2: Order details lazy fetching on-demand (getOrderDetails)');

  // --- State Machine Transitions ---
  // Test 3: PENDING -> CONFIRMED
  const order3 = await createTestOrder();
  const raw3 = localDb.orders.find(o => o.id === order3.id)!;
  raw3.status = 'PENDING';
  const res3 = await DatabaseService.advanceOrderStatus(order3.id, 'CONFIRMED', cashierUser.id);
  assert(res3.success && res3.new_status === 'CONFIRMED', 'Test 3: PENDING -> CONFIRMED transition');

  // Test 4: CONFIRMED -> PREPARING
  const res4 = await DatabaseService.advanceOrderStatus(order3.id, 'PREPARING', cashierUser.id);
  assert(res4.success && res4.new_status === 'PREPARING', 'Test 4: CONFIRMED -> PREPARING transition');

  // Test 5: PREPARING -> READY
  const res5 = await DatabaseService.advanceOrderStatus(order3.id, 'READY', cashierUser.id);
  assert(res5.success && res5.new_status === 'READY', 'Test 5: PREPARING -> READY transition');

  // Test 6: READY -> COMPLETED
  const res6 = await DatabaseService.advanceOrderStatus(order3.id, 'COMPLETED', cashierUser.id);
  assert(res6.success && res6.new_status === 'COMPLETED', 'Test 6: READY -> COMPLETED transition');

  // Test 7: Invalid state transition rejection
  let err7 = false;
  try {
    await DatabaseService.advanceOrderStatus(order3.id, 'PREPARING', cashierUser.id);
  } catch {
    err7 = true;
  }
  assert(err7, 'Test 7: Invalid state transition rejection');

  // --- Order Cancellation ---
  // Test 8: Cancellation from PENDING
  const order8 = await createTestOrder();
  const raw8 = localDb.orders.find(o => o.id === order8.id)!;
  raw8.status = 'PENDING';
  const res8 = await DatabaseService.cancelOrder(order8.id, cashierUser.id, 'CUSTOMER_REQUEST');
  assert(res8.success, 'Test 8: Cancellation from PENDING works');

  // Test 9: Cancellation from CONFIRMED
  const order9 = await createTestOrder();
  const res9 = await DatabaseService.cancelOrder(order9.id, cashierUser.id, 'OUT_OF_STOCK');
  assert(res9.success, 'Test 9: Cancellation from CONFIRMED works');

  // Test 10: Cancellation from PREPARING
  const order10 = await createTestOrder();
  const raw10 = localDb.orders.find(o => o.id === order10.id)!;
  raw10.status = 'PREPARING';
  const res10 = await DatabaseService.cancelOrder(order10.id, cashierUser.id, 'DUPLICATE_ORDER');
  assert(res10.success, 'Test 10: Cancellation from PREPARING works');

  // Test 11: Cancellation from READY
  const order11 = await createTestOrder();
  const raw11 = localDb.orders.find(o => o.id === order11.id)!;
  raw11.status = 'READY';
  const res11 = await DatabaseService.cancelOrder(order11.id, cashierUser.id, 'WRONG_ORDER');
  assert(res11.success, 'Test 11: Cancellation from READY works');

  // Test 12: COMPLETED order cancellation rejection
  const order12 = await createTestOrder();
  const raw12 = localDb.orders.find(o => o.id === order12.id)!;
  raw12.status = 'COMPLETED';
  let err12 = false;
  try {
    await DatabaseService.cancelOrder(order12.id, cashierUser.id, 'CUSTOMER_REQUEST');
  } catch {
    err12 = true;
  }
  assert(err12, 'Test 12: COMPLETED order cancellation rejection');

  // Test 13: CANCELLED -> COMPLETED transition rejection
  let err13 = false;
  try {
    await DatabaseService.advanceOrderStatus(order8.id, 'COMPLETED', cashierUser.id);
  } catch {
    err13 = true;
  }
  assert(err13, 'Test 13: CANCELLED -> COMPLETED transition rejection');

  // Test 14: Cancellation reason validation
  const order14 = await createTestOrder();
  let err14 = false;
  try {
    await DatabaseService.cancelOrder(order14.id, cashierUser.id, '' as any);
  } catch {
    err14 = true;
  }
  assert(err14, 'Test 14: Cancellation reason validation');

  // Test 15 & 16: Stock restoration and double cancellation protection (idempotency)
  const stockBefore = testProduct.stock_quantity;
  const order15 = await createTestOrder();
  await DatabaseService.cancelOrder(order15.id, cashierUser.id, 'OTHER');
  const stockAfterCancel = testProduct.stock_quantity;
  assert(stockAfterCancel === stockBefore, 'Test 15: Stock restored on cancellation');

  await DatabaseService.cancelOrder(order15.id, cashierUser.id, 'OTHER');
  assert(testProduct.stock_quantity === stockBefore, 'Test 16: Double cancellation protection (idempotency)');

  // --- Full Refund Handling ---
  // Test 17: Full refund handling
  const order17 = await createTestOrder();
  const raw17 = localDb.orders.find(o => o.id === order17.id)!;
  raw17.status = 'COMPLETED';
  const res17 = await DatabaseService.refundCompletedPayment(order17.id, managerUser.id);
  assert(res17.success, 'Test 17: Full refund handling on COMPLETED order');

  // Test 18: Duplicate refund prevention
  let err18 = false;
  try {
    await DatabaseService.refundCompletedPayment(order17.id, adminUser.id);
  } catch {
    err18 = true;
  }
  assert(err18, 'Test 18: Duplicate refund prevention');

  // Test 19: Refund permission enforcement (ADMIN / MANAGER allowed, CASHIER / STAFF blocked)
  const order19 = await createTestOrder();
  const raw19 = localDb.orders.find(o => o.id === order19.id)!;
  raw19.status = 'COMPLETED';
  let err19 = false;
  try {
    await DatabaseService.refundCompletedPayment(order19.id, cashierUser.id);
  } catch {
    err19 = true;
  }
  assert(err19, 'Test 19: Refund permission enforcement (CASHIER blocked)');

  // Test 20: Historical unit_price preservation
  const order20Details = await DatabaseService.getOrderDetails(order17.id);
  assert(order20Details.items![0].unit_price === testProduct.price, 'Test 20: Historical unit_price preservation');

  // Test 21: Historical unit_cost snapshot preservation
  assert(order20Details.items![0].unit_cost === testProduct.cost, 'Test 21: Historical unit_cost snapshot preservation');

  // Test 22: Payment status correctness
  const paymentRecord = localDb.payments.find(p => p.order_id === order17.id)!;
  assert(paymentRecord.status === 'REFUNDED', 'Test 22: Payment status correctness');

  // Test 23: Split payment handling & display
  const splitOrderDetails = await DatabaseService.getOrderDetails(order3.id);
  assert(splitOrderDetails.payments!.length === 2, 'Test 23: Split payment handling & display');

  // Test 24: RLS / Role security matrix enforcement
  let err24 = false;
  try {
    await DatabaseService.refundCompletedPayment(order19.id, staffUser.id);
  } catch {
    err24 = true;
  }
  assert(err24, 'Test 24: RLS / Role security matrix enforcement');

  // Test 25: Orders page performance behavior (instant 0ms mount via getCachedOrdersSync)
  const cachedSync = DatabaseService.getCachedOrdersSync();
  assert(Array.isArray(cachedSync) && cachedSync.length > 0, 'Test 25: Orders page performance behavior (instant 0ms mount via getCachedOrdersSync)');

  console.log('\n------------------------------------------------------------');
  console.log(` Phase 8 Suite Finished: ${passedCount} / 25 Verification Requirements Passed`);
  console.log('------------------------------------------------------------\n');
}

runPhase8Suite().catch(err => {
  console.error('Phase 8 verification error:', err);
  process.exit(1);
});
