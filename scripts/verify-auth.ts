import { AuthService } from '../src/services/auth.service';
import { DatabaseService, localDb } from '../src/services/db.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAuthenticationVerificationSuite() {
  console.log('------------------------------------------------------------');
  console.log(' RestoFlow Phase 3: Authentication & Role Verification');
  console.log('------------------------------------------------------------\n');

  let passedTests = 0;

  // Test 1: ADMIN Login & Full Permissions
  try {
    const adminUser = await AuthService.login('admin@restoflow.sa');
    assert(adminUser.role_name === 'ADMIN', 'Role must be ADMIN');
    assert(adminUser.is_active === true, 'Admin must be active');
    assert(AuthService.isModuleAllowed('ADMIN', 'settings'), 'ADMIN can access settings');
    assert(AuthService.isModuleAllowed('ADMIN', 'analytics'), 'ADMIN can access analytics');
    console.log(`✅ Test 1 PASSED: ADMIN login & full permissions verified (${adminUser.name})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 1 FAILED: ${e.message}`);
  }

  // Test 2: MANAGER Login & Permission Boundaries
  try {
    const managerUser = await AuthService.login('manager@restoflow.sa');
    assert(managerUser.role_name === 'MANAGER', 'Role must be MANAGER');
    assert(AuthService.isModuleAllowed('MANAGER', 'analytics') === true, 'MANAGER can access analytics');
    assert(AuthService.isModuleAllowed('MANAGER', 'settings') === false, 'MANAGER must be blocked from settings');
    console.log(`✅ Test 2 PASSED: MANAGER login & settings restriction verified (${managerUser.name})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 2 FAILED: ${e.message}`);
  }

  // Test 3: CASHIER Login & Permission Boundaries
  try {
    const cashierUser = await AuthService.login('cashier@restoflow.sa');
    assert(cashierUser.role_name === 'CASHIER', 'Role must be CASHIER');
    assert(AuthService.isModuleAllowed('CASHIER', 'pos') === true, 'CASHIER can access POS');
    assert(AuthService.isModuleAllowed('CASHIER', 'analytics') === false, 'CASHIER must be blocked from analytics');
    assert(AuthService.isModuleAllowed('CASHIER', 'suppliers') === false, 'CASHIER must be blocked from suppliers');
    console.log(`✅ Test 3 PASSED: CASHIER login & analytics/suppliers restriction verified (${cashierUser.name})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 3 FAILED: ${e.message}`);
  }

  // Test 4: STAFF Login & Permission Boundaries
  try {
    const staffUser = await AuthService.login('staff@restoflow.sa');
    assert(staffUser.role_name === 'STAFF', 'Role must be STAFF');
    assert(AuthService.isModuleAllowed('STAFF', 'orders') === true, 'STAFF can access orders');
    assert(AuthService.isModuleAllowed('STAFF', 'tables') === true, 'STAFF can access floor tables');
    assert(AuthService.isModuleAllowed('STAFF', 'pos') === false, 'STAFF must be blocked from POS checkout');
    assert(AuthService.isModuleAllowed('STAFF', 'analytics') === false, 'STAFF must be blocked from analytics');
    console.log(`✅ Test 4 PASSED: STAFF login & POS/analytics restriction verified (${staffUser.name})`);
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 4 FAILED: ${e.message}`);
  }

  // Test 5: Invalid Credentials Rejection
  try {
    let invalidAuthFailed = false;
    try {
      await AuthService.login('nonexistent@restoflow.sa', 'wrongpass');
    } catch (err: any) {
      invalidAuthFailed = err.message.includes('Invalid email or password');
    }
    assert(invalidAuthFailed, 'Invalid credentials must throw user-friendly authentication error');
    console.log('✅ Test 5 PASSED: Invalid credentials rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 5 FAILED: ${e.message}`);
  }

  // Test 6: Inactive User Rejection (is_active = false)
  try {
    // Temporarily set staff user as inactive
    const staff = localDb.users.find(u => u.email === 'staff@restoflow.sa')!;
    staff.is_active = false;

    let inactiveAuthFailed = false;
    try {
      await AuthService.login('staff@restoflow.sa');
    } catch (err: any) {
      inactiveAuthFailed = err.message.includes('inactive');
    }

    // Restore active status
    staff.is_active = true;

    assert(inactiveAuthFailed, 'Inactive user account must be rejected on login');
    console.log('✅ Test 6 PASSED: Inactive user account login rejected');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 6 FAILED: ${e.message}`);
  }

  // Test 7: Logout Session Clearance
  try {
    await AuthService.logout();
    console.log('✅ Test 7 PASSED: Session logout executed');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 7 FAILED: ${e.message}`);
  }

  // Test 8: RLS / RPC Security Enforcement Under Authenticated Roles
  try {
    const staffUser = localDb.users.find(u => u.email === 'staff@restoflow.sa')!;
    let rpcUnauthorizedBlocked = false;

    try {
      // Attempting privileged analytics call under STAFF user ID
      await DatabaseService.getBusinessMetrics(staffUser.id);
    } catch (err: any) {
      rpcUnauthorizedBlocked = err.message.includes('Unauthorized');
    }

    assert(rpcUnauthorizedBlocked, 'RPC security must reject unauthorized role calls');
    console.log('✅ Test 8 PASSED: Database RPC security enforcement under authenticated role verified');
    passedTests++;
  } catch (e: any) {
    console.error(`❌ Test 8 FAILED: ${e.message}`);
  }

  console.log('\n------------------------------------------------------------');
  console.log(` Authentication Suite Finished: ${passedTests} / 8 Test Categories Passed`);
  console.log('------------------------------------------------------------');
}

runAuthenticationVerificationSuite().catch((err) => {
  console.error('Authentication verification error:', err);
  process.exit(1);
});
