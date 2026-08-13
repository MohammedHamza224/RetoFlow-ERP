import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log(`Connecting to: ${supabaseUrl}`);
  const { data, error } = await supabase.from('roles').select('*').limit(1);
  if (error) {
    console.error("Connection Failed:", error.message);
    process.exit(1);
  }
  console.log("Connection Success! Roles fetched:", data);
}

testConnection();
