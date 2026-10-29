import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  // @ts-ignore - process is injected for Node test environments
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://vkhttjnqwophkuditkpz.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  // @ts-ignore - process is injected for Node test environments
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_LpMOEWyvxGrcBjWhQrlHPQ_guUtDC40';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
