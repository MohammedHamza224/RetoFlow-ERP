import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runUserManagementVerification() {
  const { AuthService } = await import('../src/services/auth.service.js');
  const { DatabaseService, localDb } = await import('../src/services/db.service.js');
  const { supabase } = await import('../src/lib/supabase.js');

  console.log('============================================================');
  console.log(' RestoFlow: User Management & Role Authorization Verification');
  console.log('============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Authenticate as test admin to establish RLS session
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@restoflow.sa',
      password: 'demo123',
    });
    if (authError) {
      console.log(`[Setup] Supabase auth note: ${authError.message}. Proceeding with service layer.`);
    } else {
      console.log('[Setup] Authenticated as admin@restoflow.sa for RLS testing.');
    }
  } catch (e: any) {
    console.log(`[Setup] Auth setup: ${e.message}`);
  }

  // Fetch actual registered users from database
  const liveUsers = await DatabaseService.getUsers();
  console.log(`[Info] Retrieved ${liveUsers.length} user records from database/cache.`);
  liveUsers.forEach(u => console.log(`   - ${u.name} (${u.email}) [Role: ${u.role?.name || 'NONE'}] ID: ${u.id}`));

  const adminUser = liveUsers.find(u => u.role?.name === 'ADMIN')!;
  const managerUser = liveUsers.find(u => u.role?.name === 'MANAGER')!;
  const cashierUser = liveUsers.find(u => u.role?.name === 'CASHIER') || liveUsers[0];
  const staffUser = liveUsers.find(u => u.role?.name === 'STAFF') || liveUsers[1];

  assert(Boolean(adminUser), 'Must find an ADMIN user in database');
  assert(Boolean(managerUser), 'Must find a MANAGER user in database');

  // --------------------------------------------------------------------------
  // SUITE 1: Module Access Permissions (Navigation & Route Protection)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Module Access Matrix ---');

  totalTests++;
  try {
    assert(AuthService.isModuleAllowed('ADMIN', 'users') === true, 'ADMIN must have access to users');
    assert(AuthService.isModuleAllowed('ADMIN', 'settings') === true, 'ADMIN must have access to settings');
    console.log('✅ Test 1: ADMIN access to User Management & Settings verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 1 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    assert(AuthService.isModuleAllowed('MANAGER', 'users') === true, 'MANAGER must have access to users');
    assert(AuthService.isModuleAllowed('MANAGER', 'settings') === false, 'MANAGER must NOT have access to settings');
    console.log('✅ Test 2: MANAGER access to User Management & exclusion from Settings verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 2 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    assert(AuthService.isModuleAllowed('CASHIER', 'users') === false, 'CASHIER must NOT access users');
    assert(AuthService.isModuleAllowed('STAFF', 'users') === false, 'STAFF must NOT access users');
    console.log('✅ Test 3: CASHIER and STAFF exclusion from User Management verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 3 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Account Creation Privileges & Restrictions
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Account Creation Privileges ---');

  totalTests++;
  try {
    // MANAGER attempting to create ADMIN account must be rejected
    let rejected = false;
    try {
      await DatabaseService.createUser('MANAGER', '22222222-2222-2222-2222-222222222222', {
        name: 'Illegal Admin',
        email: 'illegal.admin@test.sa',
        password: 'password123',
        role_name: 'ADMIN' as any,
      });
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), 'Error message must reflect Unauthorized');
    }
    assert(rejected, 'MANAGER must be blocked from creating an ADMIN account');
    console.log('✅ Test 4: MANAGER cannot create ADMIN account verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 4 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // MANAGER attempting to create MANAGER account must be rejected
    let rejected = false;
    try {
      await DatabaseService.createUser('MANAGER', '22222222-2222-2222-2222-222222222222', {
        name: 'Illegal Manager',
        email: 'illegal.manager@test.sa',
        password: 'password123',
        role_name: 'MANAGER' as any,
      });
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), 'Error message must reflect Unauthorized');
    }
    assert(rejected, 'MANAGER must be blocked from creating a MANAGER account');
    console.log('✅ Test 5: MANAGER cannot create MANAGER account verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 5 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // CASHIER attempting to create account must be rejected
    let rejected = false;
    try {
      await DatabaseService.createUser('CASHIER', '33333333-3333-3333-3333-333333333333', {
        name: 'Illegal Staff',
        email: 'illegal.staff@test.sa',
        password: 'password123',
        role_name: 'STAFF' as any,
      });
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), 'Error message must reflect Unauthorized');
    }
    assert(rejected, 'CASHIER must be blocked from creating user accounts');
    console.log('✅ Test 6: CASHIER/STAFF account creation blocked verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 6 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Account Editing & Role Escalation Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Account Modification & Escalation Protection ---');

  totalTests++;
  try {
    // MANAGER attempting to modify an ADMIN account
    let rejected = false;
    try {
      await DatabaseService.updateUser(
        'MANAGER',
        managerUser.id,
        adminUser.id,
        { name: 'Tampered Admin Name' }
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), `Must be unauthorized: ${err.message}`);
    }
    assert(rejected, 'MANAGER must NOT be able to modify an ADMIN account');
    console.log('✅ Test 7: MANAGER blocked from modifying ADMIN account verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 7 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // MANAGER attempting to promote a STAFF to ADMIN
    let rejected = false;
    try {
      const roles = await DatabaseService.getRoles();
      const adminRole = roles.find(r => r.name === 'ADMIN');
      await DatabaseService.updateUser(
        'MANAGER',
        managerUser.id,
        staffUser.id,
        { role_id: adminRole?.id }
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), `Must be unauthorized: ${err.message}`);
    }
    assert(rejected, 'MANAGER must NOT be able to promote user to ADMIN');
    console.log('✅ Test 8: MANAGER blocked from promoting user to ADMIN verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 8 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // MANAGER attempting to alter their own privileges
    let rejected = false;
    try {
      await DatabaseService.updateUser(
        'MANAGER',
        managerUser.id,
        managerUser.id,
        { name: 'Self Promotion' }
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), `Must be unauthorized: ${err.message}`);
    }
    assert(rejected, 'MANAGER must NOT alter their own privileges in User Management');
    console.log('✅ Test 9: MANAGER self-modification restriction verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 9 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Activation & Deactivation Protections
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Activation & Deactivation Protections ---');

  totalTests++;
  try {
    // ADMIN cannot deactivate their own active account
    let rejected = false;
    try {
      await DatabaseService.toggleUserStatus(
        'ADMIN',
        adminUser.id,
        adminUser.id,
        false // Deactivate
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Action Denied'), `Must reject self-deactivation: ${err.message}`);
    }
    assert(rejected, 'ADMIN must NOT be able to deactivate own account');
    console.log('✅ Test 10: ADMIN self-deactivation protection verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 10 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // MANAGER cannot deactivate an ADMIN account
    let rejected = false;
    try {
      await DatabaseService.toggleUserStatus(
        'MANAGER',
        managerUser.id,
        adminUser.id,
        false
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), `Must be unauthorized: ${err.message}`);
    }
    assert(rejected, 'MANAGER must NOT be able to deactivate an ADMIN account');
    console.log('✅ Test 11: MANAGER blocked from deactivating ADMIN account verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 11 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Safe Deletion & Historical Business Protection
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Safe Deletion & Historical Integrity ---');

  totalTests++;
  try {
    // User with transactions cannot be deleted
    const safetyCheck = await DatabaseService.checkCanDeleteUser(adminUser.id);
    assert(safetyCheck.can_delete === false, 'User with transactions must not be deletable');
    assert(safetyCheck.reason === 'LAST_ADMIN' || safetyCheck.reason === 'HISTORICAL_TRANSACTIONS', `Reason must be protected: ${safetyCheck.reason}`);
    console.log(`✅ Test 12: Business transaction protection prevents user deletion verified (${safetyCheck.reason}).`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 12 FAILED: ${e.message}`);
  }

  totalTests++;
  try {
    // Check that dummy ID with 0 orders is safely marked deletable
    const dummyId = '99999999-9999-9999-9999-999999999999';
    const safetyCheck = await DatabaseService.checkCanDeleteUser(dummyId);
    assert(safetyCheck.can_delete === true, 'User with 0 transactions should be safe to delete');
    console.log('✅ Test 13: Zero-transaction user safe deletion verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 13 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Password Recovery Workflow
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Password Recovery Scope ---');

  totalTests++;
  try {
    // MANAGER cannot initiate password reset for ADMIN
    let rejected = false;
    try {
      await DatabaseService.sendPasswordReset(
        'MANAGER',
        managerUser.id,
        adminUser.id
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('Unauthorized'), `Must be unauthorized: ${err.message}`);
    }
    assert(rejected, 'MANAGER must NOT be able to reset ADMIN passwords');
    console.log('✅ Test 14: MANAGER blocked from resetting ADMIN password verified.');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 14 FAILED: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(` Test Execution Complete: ${passedTests}/${totalTests} Passed`);
  console.log('============================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL USER MANAGEMENT & AUTHORIZATION TESTS PASSED SUCCESSFULLY!');
  } else {
    throw new Error(`${totalTests - passedTests} tests failed.`);
  }
}

runUserManagementVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
