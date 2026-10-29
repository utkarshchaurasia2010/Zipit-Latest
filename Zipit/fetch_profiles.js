import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: users, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('Error:', error);
  console.log('Profiles:', JSON.stringify(users, null, 2));
}
test();
