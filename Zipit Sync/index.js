require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const cron = require('node-cron');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || './credentials.json';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_SHEETS_ID) {
  console.error("Missing required environment variables in .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Support both environment variable JSON (for Cloud hosts like Render/Railway) and physical file
let authConfig = {
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
};

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    authConfig.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (err) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", err.message);
    authConfig.keyFile = CREDENTIALS_PATH;
  }
} else {
  authConfig.keyFile = CREDENTIALS_PATH;
}

const auth = new google.auth.GoogleAuth(authConfig);

const app = express();
app.use(cors());
app.use(express.json());

// Health Check for Cloud Service monitors (Render, Railway, UptimeRobot)
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Zipit Google Sheets Cloud Sync Engine',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Helper to clear and write to a specific sheet tab
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
    console.log(`-> Successfully synced ${values.length - 1} rows to '${tabName}' tab.`);
  } catch (err) {
    console.error(`-> Failed to sync '${tabName}':`, err.message);
  }
}

// ----------------------------------------------------
// 1. SYNC TO SHEETS (Supabase ➔ Google Sheets)
// ----------------------------------------------------
async function syncToSheets() {
  console.log(`[${new Date().toISOString()}] Starting sync TO Google Sheets...`);
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

  // Products (Inventory)
  const { data: products } = await supabase.from('products').select('*');
  const productsRows = [['ID', 'Name', 'Category ID', 'Price', 'Stock', 'Unit', 'Created At']];
  (products || []).forEach(i => {
    productsRows.push([i.id || '', i.name || '', i.category_id || '', i.price || '', i.stock || '', i.unit || '', i.created_at || '']);
  });
  await updateSheet(sheets, 'Inventory', productsRows);

  console.log(`[${new Date().toISOString()}] Sync TO Sheets completed!`);
}

// ----------------------------------------------------
// 2. SYNC FROM SHEETS (Google Sheets ➔ Supabase)
// ----------------------------------------------------
async function syncFromSheets() {
  console.log(`[${new Date().toISOString()}] Starting sync FROM Google Sheets...`);
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  
  let updatedOrders = 0;
  let updatedProducts = 0;

  try {
    // Sync Orders
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: 'Orders!A2:G',
    });
    
    const orderRows = ordersRes.data.values || [];
    for (const row of orderRows) {
      const [id, profile_id, total, status, payment_method, payment_status] = row;
      if (id && status) {
        // We update the status and payment status in Supabase based on the spreadsheet
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
        // We update price and stock in Supabase based on the spreadsheet
        await supabase.from('products').update({ 
          price: parseFloat(price), 
          stock: parseInt(stock) 
        }).eq('id', id);
        updatedProducts++;
      }
    }

    console.log(`[${new Date().toISOString()}] Sync FROM Sheets completed! Updated ${updatedOrders} Orders, ${updatedProducts} Products.`);
    return { updatedOrders, updatedProducts };
  } catch (err) {
    console.error("Error pulling from sheets:", err.message);
    throw err;
  }
}

// ----------------------------------------------------
// API ENDPOINTS (For Manual Triggers & Cron Webhooks)
// ----------------------------------------------------
const handleSyncToSheets = async (req, res) => {
  try {
    await syncToSheets();
    res.json({ success: true, message: 'Successfully pushed latest data to Google Sheets.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const handleSyncFromSheets = async (req, res) => {
  try {
    const stats = await syncFromSheets();
    res.json({ success: true, message: `Successfully pulled from Sheets. Updated ${stats.updatedOrders} Orders, ${stats.updatedProducts} Products.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.all(['/sync/to-sheets', '/api/syncToSheets'], handleSyncToSheets);
app.all(['/sync/from-sheets', '/api/syncFromSheets'], handleSyncFromSheets);

// ----------------------------------------------------
// BOOTSTRAP
// ----------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ZIPIT-SYNC] Ready & listening on http://0.0.0.0:${PORT}`);
  
  // Run an initial sync on startup
  syncToSheets().catch(err => {
    console.error("[ZIPIT-SYNC] Initial sync error:", err.message);
  });

  // Schedule to run every 3 hours automatically
  cron.schedule('0 */3 * * *', () => {
    console.log("[ZIPIT-SYNC] Scheduled 3-hour cron sync triggered...");
    syncToSheets().catch(err => console.error("[ZIPIT-SYNC] Cron sync error:", err.message));
  });
});
