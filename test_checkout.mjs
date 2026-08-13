import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL.trim();
const supabaseKey = env.VITE_SUPABASE_ANON_KEY.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: 'admin@restoflow.sa', password: 'demo123' });
  if (authError) {
    console.error('Login failed:', authError);
    return;
  }
  console.log('Logged in!');

  console.log('1. Fetching a user, customer, table, and product...');
  const { data: users } = await supabase.from('users').select('*').limit(1);
  const { data: customers } = await supabase.from('customers').select('*').limit(1);
  const { data: tables } = await supabase.from('restaurant_tables').select('*').eq('status', 'AVAILABLE').limit(1);
  const { data: products } = await supabase.from('products').select('*').eq('is_active', true).limit(1);
  
  if (!users?.[0] || !products?.[0]) {
    console.log('Missing data for test.');
    return;
  }
  
  const user = users[0];
  const table = tables?.[0];
  const customer = customers?.[0];
  const product = products[0];
  
  console.log(`Using Table: ${table?.id} (Number: ${table?.table_number})`);
  console.log(`Using Product: ${product.name} (Stock: ${product.stock_quantity}, Price: ${product.price})`);

  console.log('2. Executing POS Checkout RPC...');
  const items = [{ product_id: product.id, quantity: 1, discount: 0, notes: 'Test' }];
  const payments = [{ payment_method: 'CASH', amount: Number((product.price * 1.15).toFixed(2)), transaction_reference: 'test_txn' }];

  const { data, error } = await supabase.rpc('execute_pos_checkout', {
    p_user_id: user.id,
    p_customer_id: customer?.id || null,
    p_table_id: table?.id || null,
    p_order_type: 'DINE_IN',
    p_items: items,
    p_payments: payments,
    p_discount: 0,
    p_notes: 'Automated Test',
    p_vat_rate: 15.00,
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
    
    console.log('3. Verifying Order in DB...');
    const { data: order } = await supabase.from('orders').select('*').eq('id', data.order_id).single();
    console.log('Order created:', order ? 'YES' : 'NO', order);

    if (table) {
      console.log('4. Verifying Table Status...');
      const { data: updatedTable } = await supabase.from('restaurant_tables').select('status').eq('id', table.id).single();
      console.log(`Table Status before: ${table.status}, after: ${updatedTable.status}`);
    }
  }
}

run();
