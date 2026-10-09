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

async function updateSheet(sheets, tabName, values) {
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: `${tabName}!A:Z`,
    });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
  } catch (err) {
    console.error(`-> Failed to sync '${tabName}':`, err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!SUPABASE_URL || !GOOGLE_SHEETS_ID) return res.status(500).json({ error: 'Missing ENV vars' });

  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    const profileRows = [['ID', 'Name', 'Phone', 'Email', 'Role', 'Primary Address', 'Lat', 'Lng', 'Created At']];
    (profiles || []).forEach(p => {
      profileRows.push([p.id || '', p.name || '', p.phone || '', p.email || '', p.role || '', p.address || '', p.lat || '', p.lng || '', p.created_at || '']);
    });
    await updateSheet(sheets, 'Profiles', profileRows);

    // Addresses
    const { data: addresses } = await supabase.from('addresses').select('*');
    const addressRows = [['ID', 'Profile ID', 'Type', 'Details', 'Phone', 'Created At']];
    (addresses || []).forEach(a => {
      addressRows.push([a.id || '', a.profile_id || '', a.type || '', a.details || '', a.phone || '', a.created_at || '']);
    });
    await updateSheet(sheets, 'Addresses', addressRows);

    // Orders
    const { data: orders } = await supabase.from('orders').select('*');
    const orderRows = [['Order ID', 'Profile ID', 'Total', 'Status', 'Payment Method', 'Payment Status', 'Created At']];
    (orders || []).forEach(o => {
      orderRows.push([o.id || '', o.profile_id || '', o.total || '', o.status || '', o.payment_method || '', o.payment_status || '', o.created_at || '']);
    });
    await updateSheet(sheets, 'Orders', orderRows);

    // Products
    const { data: products } = await supabase.from('products').select('*');
    const productsRows = [['ID', 'Name', 'Category ID', 'Price', 'Stock', 'Unit', 'Created At']];
    (products || []).forEach(i => {
      productsRows.push([i.id || '', i.name || '', i.category_id || '', i.price || '', i.stock || '', i.unit || '', i.created_at || '']);
    });
    await updateSheet(sheets, 'Inventory', productsRows);

    res.status(200).json({ success: true, message: 'Successfully pushed latest data to Google Sheets.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
