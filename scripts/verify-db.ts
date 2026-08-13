import { DatabaseService, localDb } from '../src/services/db.service';
import { calculateOrderTotals, DEFAULT_VAT_RATE } from '../src/config/tax.config';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runDatabaseVerificationSuite() {
  console.log('------------------------------------------------------------');
  console.log(' RestoFlow Phase 2: Security, RLS, & RPC Authorization Review');
  console.log('------------------------------------------------------------\n');

  let passedTests = 0;

  const adminUserId = '11111111-1111-1111-1111-111111111111';   // ADMIN
  const managerUserId = '22222222-2222-2222-2222-222222222222'; // MANAGER
  const cashierUserId = '33333333-3333-3333-3333-333333333333'; // CASHIER
  const staffUserId = '44444444-4444-4444-4444-444444444444';   // STAFF
  const unauthenticatedUserId = undefined;                    // Unauthenticated

  // Test 1: ORD-000001 Sequence Generation
  try {
    const orderNum1 = localDb.generateOrderNumber();
    const orderNum2 = localDb.generateOrderNumber();
    assert(orderNum1.startsWith('ORD-') && orderNum2.startsWith('ORD-'), 'Order numbers must start with ORD-');
    assert(orderNum1 !== orderNum2, 'Order numbers must be unique');
    console.log(`✅ Test 1 PASSED: Order sequence generated ${orderNum1}, ${orderNum2}`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 1 FAILED: ${e.message}`);
  }

  // Test 2: Stock cannot become negative constraint & rollback behavior
  try {
    const lowStockProduct = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000003')!;
    const initialStock = lowStockProduct.stock_quantity; // Stock is 4

    let errorThrown = false;
    try {
      await DatabaseService.executeCheckout({
        user_id: cashierUserId,
        order_type: 'TAKEAWAY',
        items: [{ product_id: lowStockProduct.id, quantity: 10 }], // Requesting 10 when stock is 4
        payments: [{ payment_method: 'CASH', amount: 414.00 }],
      });
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes('Insufficient stock'), 'Error message must specify insufficient stock');
    }

    assert(errorThrown, 'Checkout with excess quantity must fail');
    assert(lowStockProduct.stock_quantity === initialStock, 'Stock must not change when checkout fails');
    console.log('✅ Test 2 PASSED: Insufficient stock rejected and transaction rolled back cleanly');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 2 FAILED: ${e.message}`);
  }

  // Test 3: Atomic Checkout & Snapshot Unit Cost Capture
  try {
    const targetProduct = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000001')!; // Truffle Burger (Price: 45, Cost: 18)
    const initialStock = targetProduct.stock_quantity;

    const checkoutResult = await DatabaseService.executeCheckout({
      user_id: cashierUserId,
      order_type: 'TAKEAWAY',
      items: [{ product_id: targetProduct.id, quantity: 2 }],
      payments: [{ payment_method: 'MADA', amount: 103.50 }], // (45*2) = 90 - 0 = 90 + 15% VAT (13.50) = 103.50
    });

    assert(checkoutResult.success, 'Checkout should succeed');
    assert(targetProduct.stock_quantity === initialStock - 2, 'Stock quantity should be deducted by 2');

    const createdItem = localDb.orderItems.find(oi => oi.order_id === checkoutResult.order_id)!;
    assert(createdItem.unit_price === 45.00, 'Snapshot unit_price captured');
    assert(createdItem.unit_cost === 18.00, 'Snapshot unit_cost captured for historical profit accuracy');

    console.log(`✅ Test 3 PASSED: Checkout atomic stock deduction and snapshot unit_cost verified (${checkoutResult.order_number})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 3 FAILED: ${e.message}`);
  }

  // Test 4: Split Payment Validation & Total Mismatch Protection
  try {
    let splitErrorThrown = false;
    try {
      await DatabaseService.executeCheckout({
        user_id: cashierUserId,
        order_type: 'TAKEAWAY',
        items: [{ product_id: 'b0000000-0000-0000-0000-000000000002', quantity: 1 }], // Total 43.70
        payments: [{ payment_method: 'CASH', amount: 20.00 }], // Insufficient payment
      });
    } catch (err: any) {
      splitErrorThrown = true;
      assert(err.message.includes('does not equal order total'), 'Must reject mismatched payment totals');
    }
    assert(splitErrorThrown, 'Mismatched payment totals must be rejected');
    console.log('✅ Test 4 PASSED: Mismatched split payment rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 4 FAILED: ${e.message}`);
  }

  // Test 5: Order State Machine Strict Transition Limits
  try {
    const targetOrder = localDb.orders.find(o => o.status === 'CONFIRMED')!;

    // Valid transition: CONFIRMED -> PREPARING
    const res1 = await DatabaseService.advanceOrderStatus(targetOrder.id, 'PREPARING', staffUserId);
    assert(res1.new_status === 'PREPARING', 'Transition to PREPARING allowed');

    // Invalid transition: PREPARING -> PENDING (backward skip forbidden)
    let invalidErrorThrown = false;
    try {
      await DatabaseService.advanceOrderStatus(targetOrder.id, 'PENDING' as any, staffUserId);
    } catch (err: any) {
      invalidErrorThrown = true;
      assert(err.message.includes('Illegal order state transition'), 'Error message must report illegal transition');
    }
    assert(invalidErrorThrown, 'Illegal state transition rejected');
    console.log('✅ Test 5 PASSED: Order state machine transition validation verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 5 FAILED: ${e.message}`);
  }

  // Test 6: Order Cancellation & Idempotent Stock Reversal
  try {
    const targetProduct = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000002')!;
    const stockBeforeCheckout = targetProduct.stock_quantity;

    // Execute order
    const checkoutRes = await DatabaseService.executeCheckout({
      user_id: cashierUserId,
      order_type: 'TAKEAWAY',
      items: [{ product_id: targetProduct.id, quantity: 3 }],
      payments: [{ payment_method: 'CASH', amount: 131.10 }],
    });

    assert(targetProduct.stock_quantity === stockBeforeCheckout - 3, 'Stock deducted by 3');

    // Cancel order
    const cancelRes = await DatabaseService.cancelOrder(checkoutRes.order_id, managerUserId, 'CUSTOMER_REQUEST');
    assert(cancelRes.success, 'Cancellation succeeded');
    assert(targetProduct.stock_quantity === stockBeforeCheckout, 'Stock restored to exact previous level');

    // Attempt second cancellation (Idempotency check)
    const secondCancelRes = await DatabaseService.cancelOrder(checkoutRes.order_id, managerUserId, 'CUSTOMER_REQUEST');
    assert(secondCancelRes.idempotent === true, 'Second cancellation handled idempotently');
    assert(targetProduct.stock_quantity === stockBeforeCheckout, 'Stock not restored a second time');

    console.log('✅ Test 6 PASSED: Order cancellation and idempotent stock reversal verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 6 FAILED: ${e.message}`);
  }

  // Test 7: Full Refund & Refund-Aware Business Metrics
  try {
    const completedOrder = localDb.orders.find(o => o.status === 'COMPLETED')!;
    const initialMetrics = await DatabaseService.getBusinessMetrics(adminUserId);

    // Refund completed order
    await DatabaseService.refundCompletedPayment(completedOrder.id, adminUserId);
    const updatedMetrics = await DatabaseService.getBusinessMetrics(adminUserId);

    assert(updatedMetrics.total_revenue < initialMetrics.total_revenue, 'Revenue decreases when payment is refunded');
    console.log(`✅ Test 7 PASSED: Full refund payment status updated & refund-aware metrics verified (Rev: ${updatedMetrics.total_revenue})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 7 FAILED: ${e.message}`);
  }

  // Test 8: Purchase Receiving & Stock Increment
  try {
    const draftPurchase = localDb.purchases.find(p => p.status === 'DRAFT')!;
    const res = await DatabaseService.receivePurchase(draftPurchase.id, managerUserId);
    assert(res.success, 'Purchase marked RECEIVED');

    // Attempt double receiving
    let doubleReceiveError = false;
    try {
      await DatabaseService.receivePurchase(draftPurchase.id, managerUserId);
    } catch (err) {
      doubleReceiveError = true;
    }
    assert(doubleReceiveError, 'Double purchase receiving prevented');
    console.log('✅ Test 8 PASSED: Purchase receiving & double receive prevention verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 8 FAILED: ${e.message}`);
  }

  // Dedicated Test 9: RLS & RPC Role Permission Enforcement Matrix
  try {
    console.log('\n--- Running Dedicated Role Authorization Matrix Tests ---');

    // 9.1 Product Modification Permission Test
    const p1 = await DatabaseService.modifyProduct(adminUserId, 'b0000000-0000-0000-0000-000000000001', { price: 46.00 });
    assert(p1.success, 'ADMIN can modify product');

    const p2 = await DatabaseService.modifyProduct(managerUserId, 'b0000000-0000-0000-0000-000000000001', { price: 45.00 });
    assert(p2.success, 'MANAGER can modify product');

    let cashierModifyProductBlocked = false;
    try {
      await DatabaseService.modifyProduct(cashierUserId, 'b0000000-0000-0000-0000-000000000001', { price: 10.00 });
    } catch (err: any) {
      cashierModifyProductBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierModifyProductBlocked, 'CASHIER modify product must be rejected');

    let staffModifyProductBlocked = false;
    try {
      await DatabaseService.modifyProduct(staffUserId, 'b0000000-0000-0000-0000-000000000001', { price: 10.00 });
    } catch (err: any) {
      staffModifyProductBlocked = err.message.includes('Unauthorized');
    }
    assert(staffModifyProductBlocked, 'STAFF modify product must be rejected');

    let unauthModifyProductBlocked = false;
    try {
      await DatabaseService.modifyProduct(unauthenticatedUserId, 'b0000000-0000-0000-0000-000000000001', { price: 10.00 });
    } catch (err: any) {
      unauthModifyProductBlocked = err.message.includes('Unauthorized');
    }
    assert(unauthModifyProductBlocked, 'UNAUTHENTICATED modify product must be rejected');

    // 9.2 Refund Authorization Test
    let cashierRefundBlocked = false;
    try {
      await DatabaseService.refundCompletedPayment('o0000000-0000-0000-0000-000000000001', cashierUserId);
    } catch (err: any) {
      cashierRefundBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierRefundBlocked, 'CASHIER refund must be rejected');

    let staffRefundBlocked = false;
    try {
      await DatabaseService.refundCompletedPayment('o0000000-0000-0000-0000-000000000001', staffUserId);
    } catch (err: any) {
      staffRefundBlocked = err.message.includes('Unauthorized');
    }
    assert(staffRefundBlocked, 'STAFF refund must be rejected');

    // 9.3 Cancellation Authorization Test
    let staffCancelBlocked = false;
    try {
      await DatabaseService.cancelOrder('o0000000-0000-0000-0000-000000000001', staffUserId, 'OTHER');
    } catch (err: any) {
      staffCancelBlocked = err.message.includes('Unauthorized');
    }
    assert(staffCancelBlocked, 'STAFF order cancellation must be rejected');

    // 9.4 Business Analytics Access Test
    let cashierAnalyticsBlocked = false;
    try {
      await DatabaseService.getBusinessMetrics(cashierUserId);
    } catch (err: any) {
      cashierAnalyticsBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierAnalyticsBlocked, 'CASHIER access to Business Analytics must be rejected');

    let staffAnalyticsBlocked = false;
    try {
      await DatabaseService.getBusinessMetrics(staffUserId);
    } catch (err: any) {
      staffAnalyticsBlocked = err.message.includes('Unauthorized');
    }
    assert(staffAnalyticsBlocked, 'STAFF access to Business Analytics must be rejected');

    let unauthAnalyticsBlocked = false;
    try {
      await DatabaseService.getBusinessMetrics(unauthenticatedUserId);
    } catch (err: any) {
      unauthAnalyticsBlocked = err.message.includes('Unauthorized');
    }
    assert(unauthAnalyticsBlocked, 'UNAUTHENTICATED access to Business Analytics must be rejected');

    console.log('✅ Test 9 PASSED: Role Permission Matrix & Unauthenticated Access Enforcement verified across all roles (ADMIN, MANAGER, CASHIER, STAFF, Unauthenticated)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 9 FAILED: ${e.message}`);
  }

  console.log('\n------------------------------------------------------------');
  console.log(` Verification Suite Finished: ${passedTests} / 9 Test Categories Passed`);
  console.log('------------------------------------------------------------');
}

runDatabaseVerificationSuite().catch((err) => {
  console.error('Database verification execution error:', err);
  process.exit(1);
});
