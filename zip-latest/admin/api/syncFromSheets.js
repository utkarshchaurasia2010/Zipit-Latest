require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || './credentials.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!SUPABASE_URL || !GOOGLE_SHEETS_ID) return res.status(500).json({ error: 'Missing ENV vars' });

  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    let updatedOrders = 0;
    let updatedProducts = 0;

    // Sync Orders
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: 'Orders!A2:G',
    });
    
    const orderRows = ordersRes.data.values || [];
    for (const row of orderRows) {
      const [id, profile_id, total, status, payment_method, payment_status] = row;
      if (id && status) {
        await supabase.from('orders').update({ status, payment_status }).eq('id', id);
        updatedOrders++;
      }
    }

    // Sync Inventory (Products)
    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: 'Inventory!A2:G',
    });
    
    const invRows = invRes.data.values || [];
    for (const row of invRows) {
      const [id, name, category_id, price, stock, unit] = row;
      if (id && price) {
        await supabase.from('products').update({ 
          price: parseFloat(price), 
          stock: parseInt(stock) 
        }).eq('id', id);
        updatedProducts++;
      }
    }

    res.status(200).json({ success: true, message: `Successfully pulled from Sheets. Updated ${updatedOrders} Orders, ${updatedProducts} Products.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
