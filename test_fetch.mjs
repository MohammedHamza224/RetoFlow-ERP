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
  
  console.log('Fetching orders...');
  const {data: allOrders, error: getErr} = await supabase.from('orders').select('id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, cancelled_at, cancelled_by, cancellation_reason, stock_deducted, created_at, updated_at, customer:customers(id, name, phone), table:restaurant_tables(id, table_number), user:users!orders_user_id_fkey(id, name), items:order_items(id, order_id, product_id, quantity, unit_price, unit_cost, discount, total, product:products(id, name, sku)), payments:payments(id, order_id, payment_method, amount, status, paid_at)').order('created_at', {ascending: false});
  
  console.log('Orders count:', allOrders?.length, 'Error:', getErr);
}

run();
