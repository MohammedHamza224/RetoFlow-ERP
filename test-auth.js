import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('Testing Auth Roles...');
  
  const roles = [
    { email: 'admin@restoflow.sa', role: 'ADMIN' },
    { email: 'manager@restoflow.sa', role: 'MANAGER' },
    { email: 'cashier@restoflow.sa', role: 'CASHIER' },
    { email: 'staff@restoflow.sa', role: 'STAFF' },
  ];

  for (const r of roles) {
    const t0 = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: r.email,
      password: 'demo123'
    });
    const duration = Date.now() - t0;
    
    if (error) {
      console.log(`[${r.role}] LOGIN FAILED:`, error.message, `(${duration}ms)`);
    } else {
      console.log(`[${r.role}] LOGIN SUCCESS. UUID:`, data.user.id, `(${duration}ms)`);
      
      const { data: profile } = await supabase
        .from('users')
        .select('*, roles(name)')
        .eq('id', data.user.id)
        .single();
        
      console.log(`  -> Profile mapped to public.users:`, profile?.name);
    }
    
    // sign out to test next
    await supabase.auth.signOut();
  }
}

testAuth();
