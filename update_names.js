import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraHR0am5xd29waGt1ZGl0a3B6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjU2MzI0NywiZXhwIjoyMTAyMTM5MjQ3fQ.GzAowe9UMUKqLE3HQA9gTNN4Kll5YIPcTRB5Tsjk0jg';

if (!supabaseUrl) {
  console.error("Missing URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateNames() {
  const updates = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Mohammed Al-Otaibi' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Ahmed Al-Qahtani' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Omar Al-Harbi' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Khalid Al-Dosari' },
  ];

  for (const user of updates) {
    const { error } = await supabase.from('users').update({ name: user.name }).eq('id', user.id);
    if (error) {
      console.error(`Error updating ${user.id}:`, error.message);
    } else {
      console.log(`Updated ${user.id} to ${user.name}`);
    }
  }
}

updateNames();
