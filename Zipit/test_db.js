import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1);
  if (!users || users.length === 0) { console.log('No users'); return; }
  const uid = users[0].id;
  
  const { data, error } = await supabase.from('addresses').insert([{ profile_id: uid, type: 'Other', details: 'Test' }]);
  console.log('Error:', error);
}
test();
