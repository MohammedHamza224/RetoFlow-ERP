import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('--- STARTING E2E TEST ---');

  // 1. Authenticate as ADMIN
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@restoflow.sa',
    password: 'demo123',
  });
  
  if (authError) {
    console.error('Login failed:', authError.message);
    return;
  }
  console.log('1. Login: PASS. User ID:', authData.user.id);

  // 2. Read existing customers
  const { data: customersBefore, error: fetchError1 } = await supabase.from('customers').select('*');
  if (fetchError1) {
    console.error('Fetch failed:', fetchError1.message);
    return;
  }
  console.log('2. Read Customers: PASS. Count:', customersBefore.length);

  // 3. Create a Customer
  const { data: newCust, error: createError } = await supabase.from('customers').insert({
    name: 'Test CRUD Customer',
    phone: '0501111111',
    email: 'crud@test.com',
    customer_type: 'REGULAR'
  }).select().single();

  if (createError) {
    console.error('Create failed:', createError.message);
    return;
  }
  console.log('3. Create Customer: PASS. ID:', newCust.id);

  // 4. Update the Customer
  const { data: updatedCust, error: updateError } = await supabase.from('customers').update({
    name: 'Test CRUD Customer Updated',
    phone: '0502222222'
  }).eq('id', newCust.id).select().single();

  if (updateError) {
    console.error('Update failed:', updateError.message);
    return;
  }
  console.log('4. Update Customer: PASS. Name:', updatedCust.name);

  // 5. Delete the Customer
  const { error: deleteError } = await supabase.from('customers').delete().eq('id', newCust.id);
  
  if (deleteError) {
    console.error('Delete failed:', deleteError.message);
    return;
  }
  console.log('5. Delete Customer: PASS.');

  // 6. Verify Deletion
  const { data: customersAfter, error: fetchError2 } = await supabase.from('customers').select('*').eq('id', newCust.id);
  if (fetchError2 || customersAfter.length > 0) {
    console.error('Verification failed: Customer still exists.');
    return;
  }
  console.log('6. Verify Deletion: PASS.');

  // 7. Verify User Names
  const { data: users, error: usersError } = await supabase.from('users').select('id, name');
  if (usersError) {
    console.error('Users fetch failed:', usersError.message);
    return;
  }
  console.log('7. Users fetched successfully:', users.map(u => u.name));

  console.log('--- TEST COMPLETED SUCCESSFULLY ---');
}

runTest();
