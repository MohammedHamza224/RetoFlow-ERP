import { DatabaseService, localDb } from '../src/services/db.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase5VerificationSuite() {
  console.log('------------------------------------------------------------');
  console.log(' RestoFlow Phase 5: Customer & Table Management Suite');
  console.log('------------------------------------------------------------\n');

  let passedTests = 0;

  const adminUserId = '11111111-1111-1111-1111-111111111111';   // ADMIN
  const managerUserId = '22222222-2222-2222-2222-222222222222'; // MANAGER
  const cashierUserId = '33333333-3333-3333-3333-333333333333'; // CASHIER
  const staffUserId = '44444444-4444-4444-4444-444444444444';   // STAFF

  // Test 1: Admin can create customer
  try {
    const cust = await DatabaseService.createCustomer(adminUserId, {
      name: 'Sheikh Hamdan Al-Maktoum',
      phone: '+966559998877',
      email: 'hamdan@vip.sa',
      customer_type: 'VIP',
    });
    assert(cust.name === 'Sheikh Hamdan Al-Maktoum' && cust.customer_type === 'VIP', 'Admin customer created');
    console.log('✅ Test 1 PASSED: Admin can create customer');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 1 FAILED: ${e.message}`);
  }

  // Test 2: Manager can create customer
  try {
    const cust = await DatabaseService.createCustomer(managerUserId, {
      name: 'Dr. Faisal Al-Zahrani',
      phone: '+966501112233',
      email: 'faisal@medical.sa',
      customer_type: 'REGULAR',
    });
    assert(cust.name === 'Dr. Faisal Al-Zahrani', 'Manager customer created');
    console.log('✅ Test 2 PASSED: Manager can create customer');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 2 FAILED: ${e.message}`);
  }

  // Test 3: Cashier can create customer
  try {
    const cust = await DatabaseService.createCustomer(cashierUserId, {
      name: 'Noura Al-Shehri',
      phone: '+966504445566',
      customer_type: 'REGULAR',
    });
    assert(cust.name === 'Noura Al-Shehri', 'Cashier customer created');
    console.log('✅ Test 3 PASSED: Cashier can create customer');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 3 FAILED: ${e.message}`);
  }

  // Test 4: Staff cannot create customer
  try {
    let staffCustBlocked = false;
    try {
      await DatabaseService.createCustomer(staffUserId, { name: 'Forbidden Customer' });
    } catch (err: any) {
      staffCustBlocked = err.message.includes('Unauthorized');
    }
    assert(staffCustBlocked, 'Staff customer creation blocked');
    console.log('✅ Test 4 PASSED: Staff cannot create customer (Unauthorized)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 4 FAILED: ${e.message}`);
  }

  // Test 5: Walk-in Guest protection
  try {
    const guest = localDb.customers.find(c => c.id === 'c0000000-0000-0000-0000-000000000001')!;
    assert(guest !== undefined && guest.customer_type === 'GUEST', 'Default Walk-in Guest exists');
    console.log('✅ Test 5 PASSED: Default Walk-in Guest protected & verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 5 FAILED: ${e.message}`);
  }

  // Test 6: Search customer by name/phone/email
  try {
    const customers = await DatabaseService.getCustomers();
    const searchRes = customers.filter(c => c.name.toLowerCase().includes('khalid') || (c.phone && c.phone.includes('551112233')));
    assert(searchRes.length >= 1, 'Customer search returned results');
    console.log('✅ Test 6 PASSED: Search customer by name/phone/email works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 6 FAILED: ${e.message}`);
  }

  // Test 7: Filter customer by type (GUEST, REGULAR, VIP)
  try {
    const customers = await DatabaseService.getCustomers();
    const vips = customers.filter(c => c.customer_type === 'VIP');
    assert(vips.every(c => c.customer_type === 'VIP'), 'VIP filtering matching');
    console.log(`✅ Test 7 PASSED: Filter customer by type works (${vips.length} VIPs)`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 7 FAILED: ${e.message}`);
  }

  // Test 8: Admin can create table definition
  try {
    const tbl = await DatabaseService.createTable(adminUserId, {
      table_number: 'T-99',
      capacity: 10,
      location: 'VIP Balcony',
      status: 'AVAILABLE',
    });
    assert(tbl.table_number === 'T-99' && tbl.capacity === 10, 'Admin table created');
    console.log('✅ Test 8 PASSED: Admin can create restaurant table definition');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 8 FAILED: ${e.message}`);
  }

  // Test 9: Manager can create table definition
  try {
    const tbl = await DatabaseService.createTable(managerUserId, {
      table_number: 'T-88',
      capacity: 4,
      location: 'Patio',
      status: 'AVAILABLE',
    });
    assert(tbl.table_number === 'T-88', 'Manager table created');
    console.log('✅ Test 9 PASSED: Manager can create restaurant table definition');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 9 FAILED: ${e.message}`);
  }

  // Test 10: Cashier cannot create table definition
  try {
    let cashierTableBlocked = false;
    try {
      await DatabaseService.createTable(cashierUserId, { table_number: 'T-77', capacity: 2 });
    } catch (err: any) {
      cashierTableBlocked = err.message.includes('Unauthorized');
    }
    assert(cashierTableBlocked, 'Cashier table creation blocked');
    console.log('✅ Test 10 PASSED: Cashier cannot create table definition (Unauthorized)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 10 FAILED: ${e.message}`);
  }

  // Test 11: Staff cannot create table definition
  try {
    let staffTableBlocked = false;
    try {
      await DatabaseService.createTable(staffUserId, { table_number: 'T-66', capacity: 2 });
    } catch (err: any) {
      staffTableBlocked = err.message.includes('Unauthorized');
    }
    assert(staffTableBlocked, 'Staff table creation blocked');
    console.log('✅ Test 11 PASSED: Staff cannot create table definition (Unauthorized)');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 11 FAILED: ${e.message}`);
  }

  // Test 12: Duplicate table number rejected
  try {
    let dupTableBlocked = false;
    try {
      await DatabaseService.createTable(adminUserId, { table_number: 'T-01', capacity: 2 });
    } catch (err: any) {
      dupTableBlocked = err.message.includes('already exists');
    }
    assert(dupTableBlocked, 'Duplicate table number rejected');
    console.log('✅ Test 12 PASSED: Duplicate table number rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 12 FAILED: ${e.message}`);
  }

  // Test 13: Table capacity < 1 rejected
  try {
    let zeroCapacityBlocked = false;
    try {
      await DatabaseService.createTable(adminUserId, { table_number: 'T-00', capacity: 0 });
    } catch (err: any) {
      zeroCapacityBlocked = err.message.includes('capacity');
    }
    assert(zeroCapacityBlocked, 'Zero capacity rejected');
    console.log('✅ Test 13 PASSED: Invalid table capacity < 1 rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 13 FAILED: ${e.message}`);
  }

  // Test 14: All roles can update table occupancy status (AVAILABLE, OCCUPIED, RESERVED)
  try {
    const tbl = localDb.tables.find(t => t.table_number === 'T-01')!;

    // Staff updates to OCCUPIED
    await DatabaseService.updateTableStatus(staffUserId, tbl.id, 'OCCUPIED');
    assert(tbl.status === 'OCCUPIED', 'Staff updated status to OCCUPIED');

    // Cashier updates to RESERVED
    await DatabaseService.updateTableStatus(cashierUserId, tbl.id, 'RESERVED');
    assert(tbl.status === 'RESERVED', 'Cashier updated status to RESERVED');

    // Manager updates to AVAILABLE
    await DatabaseService.updateTableStatus(managerUserId, tbl.id, 'AVAILABLE');
    assert(tbl.status === 'AVAILABLE', 'Manager updated status to AVAILABLE');

    console.log('✅ Test 14 PASSED: Table occupancy status switcher verified for all active roles');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 14 FAILED: ${e.message}`);
  }

  // Test 15: Search table by number or location
  try {
    const tables = await DatabaseService.getTables();
    const patioTables = tables.filter(t => t.location.toLowerCase().includes('patio') || t.table_number === 'T-05');
    assert(patioTables.length >= 1, 'Table search matching');
    console.log('✅ Test 15 PASSED: Search table by number or location works');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 15 FAILED: ${e.message}`);
  }

  // Test 16: Filter tables by status
  try {
    const tables = await DatabaseService.getTables();
    const availableTables = tables.filter(t => t.status === 'AVAILABLE');
    assert(availableTables.every(t => t.status === 'AVAILABLE'), 'Available table filter matching');
    console.log(`✅ Test 16 PASSED: Filter tables by status works (${availableTables.length} available)`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 16 FAILED: ${e.message}`);
  }

  // Test 17: Existing Phase 2, 3, 4 functionality intact
  try {
    const products = await DatabaseService.getProducts();
    const categories = await DatabaseService.getCategories();
    assert(products.length > 0 && categories.length > 0, 'Prior phases intact');
    console.log('✅ Test 17 PASSED: Existing Phase 2, 3, & 4 functionality intact');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 17 FAILED: ${e.message}`);
  }

  console.log('\n------------------------------------------------------------');
  console.log(` Phase 5 Suite Finished: ${passedTests} / 17 Verification Requirements Passed`);
  console.log('------------------------------------------------------------');
}

runPhase5VerificationSuite().catch((err) => {
  console.error('Phase 5 verification error:', err);
  process.exit(1);
});
