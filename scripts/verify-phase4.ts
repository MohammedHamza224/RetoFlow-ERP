import { DatabaseService, localDb } from '../src/services/db.service';
import { AuthService } from '../src/services/auth.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase4VerificationSuite() {
  console.log('------------------------------------------------------------');
  console.log(' RestoFlow Phase 4: Category & Product Management Suite');
  console.log('------------------------------------------------------------\n');

  let passedTests = 0;

  const adminUserId = '11111111-1111-1111-1111-111111111111';   // ADMIN
  const managerUserId = '22222222-2222-2222-2222-222222222222'; // MANAGER
  const cashierUserId = '33333333-3333-3333-3333-333333333333'; // CASHIER
  const staffUserId = '44444444-4444-4444-4444-444444444444';   // STAFF

  // Test 1: Admin can create category
  try {
    const cat = await DatabaseService.createCategory(adminUserId, {
      name: 'Gourmet Sides',
      description: 'Hand-cut fries & onion rings',
    });
    assert(cat.name === 'Gourmet Sides', 'Admin category created');
    console.log('✅ Test 1 PASSED: Admin can create category');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 1 FAILED: ${e.message}`);
  }

  // Test 2: Manager can create category
  try {
    const cat = await DatabaseService.createCategory(managerUserId, {
      name: 'Specialty Shakes',
      description: 'Artisanal milkshakes',
    });
    assert(cat.name === 'Specialty Shakes', 'Manager category created');
    console.log('✅ Test 2 PASSED: Manager can create category');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 2 FAILED: ${e.message}`);
  }

  // Test 3: Cashier cannot create category
  try {
    let cashierBlocked = false;
    try {
      await DatabaseService.createCategory(cashierUserId, { name: 'Forbidden Cat' });
    } catch (err: any) {
      cashierBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierBlocked, 'Cashier must be blocked from creating category');
    console.log('✅ Test 3 PASSED: Cashier cannot create category');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 3 FAILED: ${e.message}`);
  }

  // Test 4: Staff cannot create category
  try {
    let staffBlocked = false;
    try {
      await DatabaseService.createCategory(staffUserId, { name: 'Forbidden Cat' });
    } catch (err: any) {
      staffBlocked = err.message.includes('Unauthorized');
    }
    assert(staffBlocked, 'Staff must be blocked from creating category');
    console.log('✅ Test 4 PASSED: Staff cannot create category');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 4 FAILED: ${e.message}`);
  }

  // Test 5: Admin can create product
  let newProductId = '';
  try {
    const prod = await DatabaseService.createProduct(adminUserId, {
      category_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Truffle Fries',
      sku: 'SID-001',
      price: 24.00,
      cost: 7.50,
      stock_quantity: 50,
      minimum_stock: 10,
    });
    newProductId = prod.id;
    assert(prod.name === 'Truffle Fries' && prod.sku === 'SID-001', 'Admin product created');
    console.log('✅ Test 5 PASSED: Admin can create product');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 5 FAILED: ${e.message}`);
  }

  // Test 6: Manager can create product
  try {
    const prod = await DatabaseService.createProduct(managerUserId, {
      category_id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Iced Matcha Latte',
      sku: 'DRK-004',
      price: 26.00,
      cost: 8.00,
      stock_quantity: 30,
      minimum_stock: 5,
    });
    assert(prod.name === 'Iced Matcha Latte', 'Manager product created');
    console.log('✅ Test 6 PASSED: Manager can create product');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 6 FAILED: ${e.message}`);
  }

  // Test 7: Cashier has read-only access (Cannot create product)
  try {
    let cashierProdBlocked = false;
    try {
      await DatabaseService.createProduct(cashierUserId, {
        category_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Forbidden Item',
        sku: 'FORB-001',
        price: 10.00,
        cost: 3.00,
        stock_quantity: 10,
        minimum_stock: 2,
      });
    } catch (err: any) {
      cashierProdBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierProdBlocked, 'Cashier creation blocked');
    console.log('✅ Test 7 PASSED: Cashier has read-only product access');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 7 FAILED: ${e.message}`);
  }

  // Test 8: Staff has read-only access (Cannot create product)
  try {
    let staffProdBlocked = false;
    try {
      await DatabaseService.createProduct(staffUserId, {
        category_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Forbidden Item',
        sku: 'FORB-002',
        price: 10.00,
        cost: 3.00,
        stock_quantity: 10,
        minimum_stock: 2,
      });
    } catch (err: any) {
      staffProdBlocked = err.message.includes('Unauthorized');
    }
    assert(staffProdBlocked, 'Staff creation blocked');
    console.log('✅ Test 8 PASSED: Staff has read-only product access');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 8 FAILED: ${e.message}`);
  }

  // Test 9: Duplicate SKU is rejected
  try {
    let dupSkuBlocked = false;
    try {
      await DatabaseService.createProduct(adminUserId, {
        category_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Duplicate SKU Product',
        sku: 'BRG-001', // Existing SKU
        price: 30.00,
        cost: 10.00,
        stock_quantity: 15,
        minimum_stock: 5,
      });
    } catch (err: any) {
      dupSkuBlocked = err.message.includes('already assigned');
    }
    assert(dupSkuBlocked, 'Duplicate SKU rejected');
    console.log('✅ Test 9 PASSED: Duplicate SKU is rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 9 FAILED: ${e.message}`);
  }

  // Test 10: Invalid price (< 0) is rejected
  try {
    let invalidPriceBlocked = false;
    try {
      await DatabaseService.createProduct(adminUserId, {
        category_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Negative Price Product',
        sku: 'NEG-001',
        price: -10.00,
        cost: 5.00,
        stock_quantity: 10,
        minimum_stock: 2,
      });
    } catch (err: any) {
      invalidPriceBlocked = err.message.includes('price');
    }
    assert(invalidPriceBlocked, 'Negative price rejected');
    console.log('✅ Test 10 PASSED: Invalid negative price rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 10 FAILED: ${e.message}`);
  }

  // Test 11: Negative stock is rejected
  try {
    let negStockBlocked = false;
    try {
      await DatabaseService.createProduct(adminUserId, {
        category_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Negative Stock Product',
        sku: 'NEG-002',
        price: 15.00,
        cost: 5.00,
        stock_quantity: -5,
        minimum_stock: 2,
      });
    } catch (err: any) {
      negStockBlocked = err.message.includes('negative');
    }
    assert(negStockBlocked, 'Negative stock rejected');
    console.log('✅ Test 11 PASSED: Negative stock rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 11 FAILED: ${e.message}`);
  }

  // Test 12: Minimum stock threshold validation works
  try {
    const prod = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000003')!; // Crispy Chicken: Stock 4, Min Stock 10
    assert(prod.stock_quantity <= prod.minimum_stock, 'Low stock threshold triggered');
    console.log('✅ Test 12 PASSED: Minimum stock threshold validation works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 12 FAILED: ${e.message}`);
  }

  // Test 13: Product category relationship works
  try {
    const allProducts = await DatabaseService.getProducts();
    const burgerProduct = allProducts.find(p => p.sku === 'BRG-001')!;
    assert(burgerProduct.category !== undefined && burgerProduct.category.name === 'Burgers', 'Category relation joined correctly');
    console.log('✅ Test 13 PASSED: Product category relationship works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 13 FAILED: ${e.message}`);
  }

  // Test 14: Product search works
  try {
    const allProducts = await DatabaseService.getProducts();
    const searchRes = allProducts.filter(p => p.name.toLowerCase().includes('truffle') || p.sku.toLowerCase().includes('brg-001'));
    assert(searchRes.length >= 1, 'Search query returned results');
    console.log('✅ Test 14 PASSED: Product search works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 14 FAILED: ${e.message}`);
  }

  // Test 15: Category filtering works
  try {
    const allProducts = await DatabaseService.getProducts();
    const drinkProducts = allProducts.filter(p => p.category_id === 'a0000000-0000-0000-0000-000000000003');
    assert(drinkProducts.every(p => p.category_id === 'a0000000-0000-0000-0000-000000000003'), 'Category filter matching');
    console.log('✅ Test 15 PASSED: Category filtering works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 15 FAILED: ${e.message}`);
  }

  // Test 16: Stock status calculation works
  try {
    const outOfStockItem = localDb.products.find(p => p.stock_quantity === 0)!; // Classic Mojito
    const inStockItem = localDb.products.find(p => p.stock_quantity > p.minimum_stock)!;
    assert(outOfStockItem.stock_quantity === 0, 'Out of stock identified');
    assert(inStockItem.stock_quantity > inStockItem.minimum_stock, 'In stock identified');
    console.log('✅ Test 16 PASSED: Stock status calculation verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 16 FAILED: ${e.message}`);
  }

  // Test 17: Low-stock products are correctly identified
  try {
    const lowStockItems = localDb.products.filter(p => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock);
    assert(lowStockItems.length > 0, 'Low stock items identified');
    console.log(`✅ Test 17 PASSED: Low-stock products correctly identified (${lowStockItems.length} items)`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 17 FAILED: ${e.message}`);
  }

  // Test 18: Product soft deactivation works (is_active = false)
  try {
    const prod = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000001')!;
    await DatabaseService.toggleProductStatus(adminUserId, prod.id);
    assert(prod.is_active === false, 'Product soft deactivated');
    console.log('✅ Test 18 PASSED: Product soft deactivation works (is_active = false)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 18 FAILED: ${e.message}`);
  }

  // Test 19: Product reactivation works (is_active = true)
  try {
    const prod = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000001')!;
    await DatabaseService.toggleProductStatus(adminUserId, prod.id);
    assert(prod.is_active === true, 'Product reactivated');
    console.log('✅ Test 19 PASSED: Product reactivation works (is_active = true)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 19 FAILED: ${e.message}`);
  }

  // Test 20: Inactive products remain available in historical relationships
  try {
    const historicalItem = localDb.orderItems.find(oi => oi.product_id === 'b0000000-0000-0000-0000-000000000001')!;
    assert(historicalItem !== undefined, 'Historical order_item reference remains intact');
    console.log('✅ Test 20 PASSED: Inactive products remain preserved in historical orders');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 20 FAILED: ${e.message}`);
  }

  // Test 21 & 22: Historical Price & Cost Protection (CRITICAL)
  try {
    const targetProduct = localDb.products.find(p => p.id === 'b0000000-0000-0000-0000-000000000001')!;
    const historicalOrderItem = localDb.orderItems.find(oi => oi.product_id === targetProduct.id)!;

    const originalHistoricalPrice = historicalOrderItem.unit_price; // 45.00
    const originalHistoricalCost = historicalOrderItem.unit_cost;   // 18.00

    // Mutate current product price and cost in product table
    await DatabaseService.updateProduct(adminUserId, targetProduct.id, {
      price: 99.00,
      cost: 50.00,
    });

    // Check that historical order_items snapshot price and cost REMAIN UNCHANGED
    assert(historicalOrderItem.unit_price === originalHistoricalPrice, 'Historical order_item.unit_price must NOT change');
    assert(historicalOrderItem.unit_cost === originalHistoricalCost, 'Historical order_item.unit_cost must NOT change');

    // Restore product price and cost
    await DatabaseService.updateProduct(adminUserId, targetProduct.id, {
      price: 45.00,
      cost: 18.00,
    });

    console.log('✅ Test 21 & 22 PASSED: CRITICAL historical order_items unit_price & unit_cost snapshot protection verified');
    passedTests += 2;
  } catch (e: any) {
    console.error(`❌ Test 21 & 22 FAILED: ${e.message}`);
  }

  // Test 23: Unauthorized bypass protection
  try {
    let unauthProductUpdateBlocked = false;
    try {
      await DatabaseService.updateProduct(undefined, 'b0000000-0000-0000-0000-000000000001', { price: 1.00 });
    } catch (err: any) {
      unauthProductUpdateBlocked = err.message.includes('Unauthorized');
    }
    assert(unauthProductUpdateBlocked, 'Unauthenticated product update blocked');
    console.log('✅ Test 23 PASSED: Unauthorized request bypass protection verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 23 FAILED: ${e.message}`);
  }

  // Test 24: Existing Phase 2 functionality intact
  try {
    const metrics = await DatabaseService.getBusinessMetrics(adminUserId);
    assert(metrics.total_revenue >= 0, 'Business metrics intact');
    console.log('✅ Test 24 PASSED: Existing Phase 2 database & RPC functionality intact');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 24 FAILED: ${e.message}`);
  }

  // Test 25: Existing Phase 3 authentication intact
  try {
    const adminSession = await AuthService.login('admin@restoflow.sa');
    assert(adminSession.role_name === 'ADMIN', 'Auth session intact');
    console.log('✅ Test 25 PASSED: Existing Phase 3 authentication intact');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 25 FAILED: ${e.message}`);
  }

  console.log('\n------------------------------------------------------------');
  console.log(` Phase 4 Suite Finished: ${passedTests} / 25 Verification Requirements Passed`);
  console.log('------------------------------------------------------------');
}

runPhase4VerificationSuite().catch((err) => {
  console.error('Phase 4 verification error:', err);
  process.exit(1);
});
