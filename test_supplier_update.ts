import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envStr.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [k, v] = line.split('=');
    env[k.trim()] = v.trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log('Testing Supplier Update with all fields...');
  
  // Login as ADMIN
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@restoflow.sa',
    password: 'demo123'
  });
  
  if (authError || !authData.user) {
    console.error('Failed to login:', authError);
    return;
  }
  
  // 1. Get first supplier
  const { data: suppliers, error: err1 } = await supabase.from('suppliers').select('*').limit(1);
  if (err1 || !suppliers || suppliers.length === 0) {
    console.error('Failed to fetch supplier:', err1);
    return;
  }
  const sup = suppliers[0];
  
  // 2. Attempt update
  const payload = {
    name: sup.name + ' Updated',
    phone: '+966500000000',
    email: 'test@example.com',
    address: '123 Test St',
    tax_number: '1234567890',
    updated_at: new Date().toISOString()
  };
  
  const { data: updated, error: err2 } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', sup.id)
    .select()
    .single();
    
  if (err2) {
    console.error('Update failed:', err2);
  } else {
    console.log('Update success:', updated.id, updated.name);
    // revert
    await supabase.from('suppliers').update({ name: sup.name, phone: sup.phone, email: sup.email, address: sup.address, tax_number: sup.tax_number }).eq('id', sup.id);
  }
}

testUpdate();
