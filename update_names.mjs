import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function updateNames() {
  await supabase.from('users').update({ name: 'Mohammed Hamza' }).eq('id', '11111111-1111-1111-1111-111111111111');
  await supabase.from('users').update({ name: 'Ahmed Khalid' }).eq('id', '22222222-2222-2222-2222-222222222222');
  await supabase.from('users').update({ name: 'Amro Ali' }).eq('id', '33333333-3333-3333-3333-333333333333');
  await supabase.from('users').update({ name: 'Ahmed Youssef' }).eq('id', '44444444-4444-4444-4444-444444444444');
  console.log('Done updating users.');
}
updateNames();
