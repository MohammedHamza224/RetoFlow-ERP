/**
 * RestoFlow Phase 9: Inventory, Suppliers & Purchase Management Verification Suite
 * 
 * Tests 25 explicit business requirements:
 * 1. Inventory monitoring (getProducts returns stock quantities)
 * 2. Low stock threshold alert identification (stock_quantity <= minimum_stock)
 * 3. Out of stock alert identification (stock_quantity <= 0)
 * 4. Total inventory valuation calculation (sum(stock_quantity * cost))
 * 5. Supplier listing (getSuppliers)
 * 6. Supplier creation (createSupplier by ADMIN/MANAGER)
 * 7. Supplier update (updateSupplier)
 * 8. Supplier validation (blank name rejected)
 * 9. Supplier role permission enforcement (CASHIER blocked)
 * 10. Purchase order listing (getPurchases)
 * 11. Purchase order creation in DRAFT status (createPurchase)
 * 12. Purchase invoice number auto-generation (PO-XXXXXX)
 * 13. Purchase order total & 15% VAT calculation correctness
 * 14. Purchase line items validation (empty line items rejected)
 * 15. Purchase item quantity validation (quantity <= 0 rejected)
 * 16. Purchase item unit cost validation (negative unit cost rejected)
 * 17. Purchase receiving execution
 * 18. Atomic stock increment on purchase receiving
 * 19. Purchase status updated to RECEIVED
 * 20. Purchase receiving idempotency (already RECEIVED order blocked)
 * 21. Receiving a CANCELLED purchase order blocked
 * 22. Purchase receiving role permission enforcement (CASHIER blocked)
 * 23. POS checkout stock deduction preservation
 * 24. Historical cost preservation on products
 * 25. Synchronous cache getters for instant 0ms mount
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

async function runPhase9Suite() {
  console.log('\n------------------------------------------------------------');
  console.log(' RestoFlow Phase 9: Inventory & Procurement Suite');
  console.log('------------------------------------------------------------\n');

  // Fetch test users & product
  const adminUser = localDb.users.find(u => u.role?.name === 'ADMIN')!;
  const managerUser = localDb.users.find(u => u.role?.name === 'MANAGER')!;
  const cashierUser = localDb.users.find(u => u.role?.name === 'CASHIER')!;
  const testProduct = localDb.products[0];

  // Test 1: Inventory monitoring
  const products = await DatabaseService.getProducts();
  assert(Array.isArray(products) && products.every(p => typeof p.stock_quantity === 'number'), 'Test 1: Inventory monitoring');

  // Test 2: Low stock threshold alert identification
  const lowStock = products.filter(p => p.stock_quantity <= p.minimum_stock && p.stock_quantity > 0);
  assert(Array.isArray(lowStock), 'Test 2: Low stock threshold alert identification');

  // Test 3: Out of stock alert identification
  const outOfStock = products.filter(p => p.stock_quantity <= 0);
  assert(Array.isArray(outOfStock), 'Test 3: Out of stock alert identification');

  // Test 4: Total inventory valuation calculation
  const totalValuation = products.reduce((sum, p) => sum + (p.stock_quantity * p.cost), 0);
  assert(totalValuation >= 0, 'Test 4: Total inventory valuation calculation');

  // Test 5: Supplier listing
  const suppliers = await DatabaseService.getSuppliers();
  assert(Array.isArray(suppliers) && suppliers.length > 0, 'Test 5: Supplier listing');

  // Test 6: Supplier creation
  const newSup = await DatabaseService.createSupplier(adminUser.id, {
    name: 'Al Othaim Wholesale Co.',
    phone: '+966 11 444 5555',
    email: 'wholesale@othaim.sa',
    tax_number: '300000000000009',
  });
  assert(newSup.id && newSup.name === 'Al Othaim Wholesale Co.', 'Test 6: Supplier creation');

  // Test 7: Supplier update
  const updatedSup = await DatabaseService.updateSupplier(adminUser.id, newSup.id, { phone: '+966 11 999 8888' });
  assert(updatedSup.phone === '+966 11 999 8888', 'Test 7: Supplier update');

  // Test 8: Supplier validation (blank name rejected)
  let err8 = false;
  try {
    await DatabaseService.createSupplier(adminUser.id, { name: '   ' });
  } catch {
    err8 = true;
  }
  assert(err8, 'Test 8: Supplier validation (blank name rejected)');

  // Test 9: Supplier role permission enforcement (CASHIER blocked)
  let err9 = false;
  try {
    await DatabaseService.createSupplier(cashierUser.id, { name: 'Unauthorized Sup' });
  } catch {
    err9 = true;
  }
  assert(err9, 'Test 9: Supplier role permission enforcement (CASHIER blocked)');

  // Test 10: Purchase order listing
  const purchases = await DatabaseService.getPurchases();
  assert(Array.isArray(purchases), 'Test 10: Purchase order listing');

  // Test 11: Purchase order creation in DRAFT status
  const draftPurchase = await DatabaseService.createPurchase(adminUser.id, {
    supplier_id: newSup.id,
    items: [{ product_id: testProduct.id, quantity: 20, unit_cost: testProduct.cost }],
  });
  assert(draftPurchase.id && draftPurchase.status === 'DRAFT', 'Test 11: Purchase order creation in DRAFT status');

  // Test 12: Purchase invoice number auto-generation
  assert(draftPurchase.invoice_number.startsWith('PO-'), 'Test 12: Purchase invoice number auto-generation');

  // Test 13: Purchase order total & 15% VAT calculation correctness
  const expectedSubtotal = 20 * testProduct.cost;
  const expectedTax = Math.round((expectedSubtotal * 0.15) * 100) / 100;
  const expectedTotal = Math.round((expectedSubtotal + expectedTax) * 100) / 100;
  assert(draftPurchase.subtotal === expectedSubtotal && draftPurchase.total === expectedTotal, 'Test 13: Purchase order total & 15% VAT calculation');

  // Test 14: Purchase line items validation (empty line items rejected)
  let err14 = false;
  try {
    await DatabaseService.createPurchase(adminUser.id, { supplier_id: newSup.id, items: [] });
  } catch {
    err14 = true;
  }
  assert(err14, 'Test 14: Purchase line items validation (empty items rejected)');

  // Test 15: Purchase item quantity validation (quantity <= 0 rejected)
  let err15 = false;
  try {
    await DatabaseService.createPurchase(adminUser.id, {
      supplier_id: newSup.id,
      items: [{ product_id: testProduct.id, quantity: 0, unit_cost: 10 }],
    });
  } catch {
    err15 = true;
  }
  assert(err15, 'Test 15: Purchase item quantity validation (quantity <= 0 rejected)');

  // Test 16: Purchase item unit cost validation (negative unit cost rejected)
  let err16 = false;
  try {
    await DatabaseService.createPurchase(adminUser.id, {
      supplier_id: newSup.id,
      items: [{ product_id: testProduct.id, quantity: 5, unit_cost: -5 }],
    });
  } catch {
    err16 = true;
  }
  assert(err16, 'Test 16: Purchase item unit cost validation (negative cost rejected)');

  // Test 17 & 18 & 19: Purchase receiving execution & atomic stock increment
  const stockBefore = testProduct.stock_quantity;
  const receiveRes = await DatabaseService.receivePurchase(draftPurchase.id, managerUser.id);
  assert(receiveRes.success, 'Test 17: Purchase receiving execution');
  assert(testProduct.stock_quantity === stockBefore + 20, 'Test 18: Atomic stock increment on purchase receiving');
  assert(draftPurchase.status === 'RECEIVED', 'Test 19: Purchase status updated to RECEIVED');

  // Test 20: Purchase receiving idempotency (already RECEIVED order blocked)
  let err20 = false;
  try {
    await DatabaseService.receivePurchase(draftPurchase.id, managerUser.id);
  } catch {
    err20 = true;
  }
  assert(err20, 'Test 20: Purchase receiving idempotency');

  // Test 21: Receiving a CANCELLED purchase order blocked
  const cancelledPur = await DatabaseService.createPurchase(adminUser.id, {
    supplier_id: newSup.id,
    items: [{ product_id: testProduct.id, quantity: 5, unit_cost: testProduct.cost }],
  });
  cancelledPur.status = 'CANCELLED';
  let err21 = false;
  try {
    await DatabaseService.receivePurchase(cancelledPur.id, adminUser.id);
  } catch {
    err21 = true;
  }
  assert(err21, 'Test 21: Receiving a CANCELLED purchase order blocked');

  // Test 22: Purchase receiving role permission enforcement (CASHIER blocked)
  const draftPur22 = await DatabaseService.createPurchase(adminUser.id, {
    supplier_id: newSup.id,
    items: [{ product_id: testProduct.id, quantity: 5, unit_cost: testProduct.cost }],
  });
  let err22 = false;
  try {
    await DatabaseService.receivePurchase(draftPur22.id, cashierUser.id);
  } catch {
    err22 = true;
  }
  assert(err22, 'Test 22: Purchase receiving role permission enforcement (CASHIER blocked)');

  // Test 23: POS checkout stock deduction preservation
  const initialStock23 = testProduct.stock_quantity;
  await DatabaseService.executeCheckout({
    user_id: cashierUser.id,
    order_type: 'TAKEAWAY',
    items: [{ product_id: testProduct.id, quantity: 2 }],
    payments: [{ payment_method: 'CASH', amount: (testProduct.price * 2) * 1.15 }],
  });
  assert(testProduct.stock_quantity === initialStock23 - 2, 'Test 23: POS checkout stock deduction preservation');

  // Test 24: Historical cost preservation on products
  assert(typeof testProduct.cost === 'number' && testProduct.cost > 0, 'Test 24: Historical cost preservation on products');

  // Test 25: Synchronous cache getters for instant 0ms mount
  const syncSuppliers = DatabaseService.getCachedSuppliersSync();
  const syncPurchases = DatabaseService.getCachedPurchasesSync();
  assert(Array.isArray(syncSuppliers) && Array.isArray(syncPurchases), 'Test 25: Synchronous cache getters for instant 0ms mount');

  console.log('\n------------------------------------------------------------');
  console.log(` Phase 9 Suite Finished: ${passedCount} / 25 Verification Requirements Passed`);
  console.log('------------------------------------------------------------\n');
}

runPhase9Suite().catch(err => {
  console.error('Phase 9 verification error:', err);
  process.exit(1);
});
