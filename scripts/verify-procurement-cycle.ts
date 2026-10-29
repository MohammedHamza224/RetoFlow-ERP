/**
 * RestoFlow Automated Procurement Lifecycle Verification
 * Tests:
 * 1. PO Creation with multi-items, discounts, VAT (15%).
 * 2. Crucial Rule: PO Creation does NOT alter product stock!
 * 3. Partial Goods Receipt: Atomically increments stock for received items only.
 * 4. Double-Receipt Guard: Prevents receiving more than remaining ordered quantity.
 * 5. Full Goods Receipt: Transitions PO status to RECEIVED.
 * 6. Purchase Invoice Generation: Transfers 100% of line items faithfully.
 * 7. Invoice does NOT double-increment stock.
 * 8. Protection Rule: Cannot delete a POSTED invoice (must be cancelled).
 * 9. Safe draft deletion.
 * 10. Supplier Statement aggregation and balance due calculation.
 */

import 'dotenv/config';
import { DatabaseService, localDb } from '../src/services/db.service';

const ADMIN_USER_ID = '11111111-1111-1111-1111-111111111111';

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RESTOFLOW PROCUREMENT LIFECYCLE VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  try {
    // 1. Get initial products and supplier
    const suppliers = await DatabaseService.getSuppliers();
    const products = await DatabaseService.getProducts();

    assert(suppliers.length > 0, 'Suppliers available in system');
    assert(products.length >= 2, 'At least 2 products available in catalog');

    const testSupplier = suppliers[0];
    const prodA = products[0];
    const prodB = products[1];

    const initialStockA = prodA.stock_quantity;
    const initialStockB = prodB.stock_quantity;

    console.log(`\nInitial stock: [${prodA.name}]: ${initialStockA}, [${prodB.name}]: ${initialStockB}`);

    // TEST 1 & 2: Create Purchase Order without altering inventory
    console.log('\n--- Step 1: Create Purchase Order ---');
    const orderItems = [
      { product_id: prodA.id, quantity: 20, unit_cost: 15.00 },
      { product_id: prodB.id, quantity: 10, unit_cost: 25.00 },
    ];

    const newPO = await DatabaseService.createPurchaseOrder(
      ADMIN_USER_ID,
      testSupplier.id,
      `PO-TEST-${Date.now().toString().slice(-4)}`,
      orderItems,
      {
        notes: 'Verification test order',
        discount: 50.00,
        expected_delivery_date: '2026-11-01',
      }
    );

    assert(!!newPO && !!newPO.id, 'Purchase Order successfully created');
    assert(newPO.status === 'PENDING_RECEIPT', 'PO initial status is PENDING_RECEIPT');
    assert(newPO.items?.length === 2, 'PO contains all 2 ordered line items');

    // Expected financials: subtotal = (20*15) + (10*25) = 300 + 250 = 550.
    // discount = 50. taxable = 500. tax (15%) = 75. total = 575.
    assert(newPO.subtotal === 550, `Subtotal is 550 SAR (got: ${newPO.subtotal})`);
    assert(newPO.discount === 50, `Discount is 50 SAR (got: ${newPO.discount})`);
    assert(newPO.tax === 75, `Tax is 75 SAR (got: ${newPO.tax})`);
    assert(newPO.total === 575, `Total is 575 SAR (got: ${newPO.total})`);

    // CRUCIAL CHECK: Verify stock DID NOT change!
    const refreshedProdsAfterPO = await DatabaseService.getProducts();
    const stockAfterPoA = refreshedProdsAfterPO.find(p => p.id === prodA.id)?.stock_quantity;
    const stockAfterPoB = refreshedProdsAfterPO.find(p => p.id === prodB.id)?.stock_quantity;

    assert(
      stockAfterPoA === initialStockA && stockAfterPoB === initialStockB,
      'CRUCIAL: PO Creation did NOT increment inventory stock!',
      `Expected A=${initialStockA}, B=${initialStockB}; got A=${stockAfterPoA}, B=${stockAfterPoB}`
    );

    // TEST 3: Partial Goods Receipt
    console.log('\n--- Step 2: Partial Goods Receipt (Receive 12 of Item A, 0 of Item B) ---');
    const poItemA = newPO.items!.find(i => i.product_id === prodA.id)!;
    const poItemB = newPO.items!.find(i => i.product_id === prodB.id)!;

    const partialReceiptResult = await DatabaseService.recordGoodsReceipt({
      purchase_id: newPO.id,
      received_by: ADMIN_USER_ID,
      items: [
        {
          purchase_item_id: poItemA.id,
          product_id: prodA.id,
          quantity_received: 12,
          unit_cost: 15.00,
        },
      ],
      notes: 'Partial batch delivery 1',
    });

    assert(partialReceiptResult.success === true, 'Partial goods receipt recorded successfully');
    assert(
      partialReceiptResult.purchase_status === 'PARTIALLY_RECEIVED',
      'PO status changed to PARTIALLY_RECEIVED'
    );

    const prodsAfterPartial = await DatabaseService.getProducts();
    const stockAfterPartialA = prodsAfterPartial.find(p => p.id === prodA.id)?.stock_quantity;
    const stockAfterPartialB = prodsAfterPartial.find(p => p.id === prodB.id)?.stock_quantity;

    assert(
      stockAfterPartialA === initialStockA + 12,
      `Product A stock incremented by exactly 12 (now: ${stockAfterPartialA})`
    );
    assert(
      stockAfterPartialB === initialStockB,
      `Product B stock remained unchanged (still: ${stockAfterPartialB})`
    );

    // TEST 4: Attempt Over-Receiving Guard
    console.log('\n--- Step 3: Attempt Over-Receiving Guard ---');
    let overReceiveBlocked = false;
    try {
      // Remaining for A is 20 - 12 = 8. Trying to receive 15 must fail!
      await DatabaseService.recordGoodsReceipt({
        purchase_id: newPO.id,
        received_by: ADMIN_USER_ID,
        items: [
          {
            purchase_item_id: poItemA.id,
            product_id: prodA.id,
            quantity_received: 15,
          },
        ],
      });
    } catch (err: any) {
      overReceiveBlocked = true;
      console.log(`   Captured expected rejection: ${err.message}`);
    }
    assert(overReceiveBlocked, 'System rejected receiving quantity exceeding remaining ordered quantity');

    // TEST 5: Complete Final Goods Receipt
    console.log('\n--- Step 4: Final Goods Receipt (Remaining 8 of A, and 10 of B) ---');
    const finalReceiptResult = await DatabaseService.recordGoodsReceipt({
      purchase_id: newPO.id,
      received_by: ADMIN_USER_ID,
      items: [
        {
          purchase_item_id: poItemA.id,
          product_id: prodA.id,
          quantity_received: 8,
        },
        {
          purchase_item_id: poItemB.id,
          product_id: prodB.id,
          quantity_received: 10,
        },
      ],
      notes: 'Final batch delivery 2',
    });

    assert(finalReceiptResult.success === true, 'Final goods receipt recorded');
    assert(
      finalReceiptResult.purchase_status === 'RECEIVED',
      'PO status changed to RECEIVED after 100% of items delivered'
    );

    const prodsAfterFinal = await DatabaseService.getProducts();
    const stockAfterFinalA = prodsAfterFinal.find(p => p.id === prodA.id)?.stock_quantity;
    const stockAfterFinalB = prodsAfterFinal.find(p => p.id === prodB.id)?.stock_quantity;

    assert(
      stockAfterFinalA === initialStockA + 20,
      `Product A stock total increase is exactly 20 (now: ${stockAfterFinalA})`
    );
    assert(
      stockAfterFinalB === initialStockB + 10,
      `Product B stock total increase is exactly 10 (now: ${stockAfterFinalB})`
    );

    // TEST 6 & 7: Generate Purchase Invoice from PO
    console.log('\n--- Step 5: Generate Purchase Invoice from PO ---');
    const invoice = await DatabaseService.createPurchaseInvoiceFromPO(
      ADMIN_USER_ID,
      newPO.id,
      'EXT-INV-99001'
    );

    assert(!!invoice && !!invoice.id, 'Purchase invoice generated successfully');
    assert(invoice.items?.length === 2, 'STRICT REQUIREMENT: 100% of line items transferred faithfully (2/2 items)');
    assert(invoice.purchase_id === newPO.id, 'Invoice is linked to source purchase order');
    assert(invoice.status === 'POSTED', 'Invoice status is POSTED');
    assert(invoice.total === newPO.total, `Invoice total matches PO total: ${invoice.total} SAR`);

    // Verify stock did NOT double-increment!
    const prodsAfterInvoice = await DatabaseService.getProducts();
    const stockAfterInvA = prodsAfterInvoice.find(p => p.id === prodA.id)?.stock_quantity;
    assert(
      stockAfterInvA === stockAfterFinalA,
      'DOUBLE-INCREMENT PROTECTION: Generating an invoice did NOT re-increment inventory'
    );

    // TEST 8: Posted Invoice Deletion Protection
    console.log('\n--- Step 6: Posted Invoice Audit Protection ---');
    let postedDeleteBlocked = false;
    try {
      await DatabaseService.deletePurchaseInvoice(ADMIN_USER_ID, invoice.id);
    } catch (err: any) {
      postedDeleteBlocked = true;
      console.log(`   Captured expected rejection: ${err.message}`);
    }
    assert(postedDeleteBlocked, 'AUDIT SAFETY: Deleting a posted invoice is strictly prevented');

    // TEST 9: Safe Cancellation of Posted Invoice & Safe Draft Deletion
    console.log('\n--- Step 7: Cancel Posted Invoice & Test Draft Deletion ---');
    const cancelledInvoice = await DatabaseService.updatePurchaseInvoice(ADMIN_USER_ID, invoice.id, {
      status: 'CANCELLED',
    });
    assert(cancelledInvoice.status === 'CANCELLED', 'Posted invoice successfully cancelled safely');

    // Create a DRAFT invoice to verify safe draft deletion
    const draftInvoice = await DatabaseService.createPurchaseInvoice(ADMIN_USER_ID, {
      supplier_id: testSupplier.id,
      status: 'DRAFT',
      items: [{ product_id: prodA.id, quantity: 1, unit_cost: 10 }],
    });
    assert(draftInvoice.status === 'DRAFT', 'Draft invoice created');

    await DatabaseService.deletePurchaseInvoice(ADMIN_USER_ID, draftInvoice.id);
    const draftLookup = await DatabaseService.getPurchaseInvoiceById(draftInvoice.id);
    assert(!draftLookup, 'DRAFT invoice can be deleted cleanly without residue');

    // TEST 10: Supplier Statement Aggregation
    console.log('\n--- Step 8: Supplier Statement & History ---');
    const statement = await DatabaseService.getSupplierStatement(testSupplier.id);

    assert(statement.supplier.id === testSupplier.id, 'Statement generated for correct supplier');
    assert(statement.total_orders >= 1, `Statement tracks total orders count (${statement.total_orders})`);
    assert(statement.total_order_amount >= 575, `Statement tracks total order value (${statement.total_order_amount} SAR)`);
    assert(typeof statement.outstanding_balance === 'number', `Statement tracks outstanding balance (${statement.outstanding_balance} SAR)`);
    assert(statement.receipts.length >= 2, 'Statement includes goods receipts history');

  } catch (error: any) {
    console.error('💥 Unhandled exception during verification:', error);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
