import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function renameCategory() {
  console.log("Renaming category...");
  
  // First, find the category
  const { data: categories, error: fetchError } = await supabase
    .from('categories')
    .select('*')
    .ilike('name', 'sauces & vinegars');
    
  if (fetchError) {
    console.error("Error fetching category:", fetchError);
    return;
  }
  
  if (!categories || categories.length === 0) {
    console.log("Category 'sauces & vinegars' not found in database.");
    return;
  }
  
  const categoryId = categories[0].id;
  
  // Update the category
  const { error: updateError } = await supabase
    .from('categories')
    .update({ name: 'Sauces & Jams' })
    .eq('id', categoryId);
    
  if (updateError) {
    console.error("Error updating category:", updateError);
  } else {
    console.log(`Successfully renamed category '${categories[0].name}' to 'Sauces & Jams'.`);
  }
}

renameCategory();
