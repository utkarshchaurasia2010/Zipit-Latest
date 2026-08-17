import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function removeUnits() {
  const { data: products, error } = await supabase.from('products').select('id, nutrition_info');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  for (const p of products) {
    if (p.nutrition_info && typeof p.nutrition_info === 'object') {
      let updated = false;
      const newInfo = { ...p.nutrition_info };
      
      for (const key of Object.keys(newInfo)) {
        if (typeof newInfo[key] === 'string') {
          const original = newInfo[key];
          // Remove " kcal", "kcal", " g", "g" (case insensitive)
          const stripped = original.replace(/\s*kcal/i, '').replace(/\s*g/i, '').trim();
          if (stripped !== original) {
            newInfo[key] = stripped;
            updated = true;
          }
        }
      }

      if (updated) {
        const { error: updateError } = await supabase.from('products').update({ nutrition_info: newInfo }).eq('id', p.id);
        if (updateError) {
          console.error(`Error updating product ${p.id}:`, updateError);
        } else {
          console.log(`Updated product ${p.id} successfully!`);
        }
      }
    }
  }
  console.log('Finished removing units!');
}

removeUnits();
