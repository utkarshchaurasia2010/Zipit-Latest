import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('id, name, amount');
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

fetchProducts();
