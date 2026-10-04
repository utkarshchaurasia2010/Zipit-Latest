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

const fs = require('fs');
const crypto = require('crypto');

function isValidPrivateKey(key) {
  try {
    if (!key || typeof key !== 'string') return false;
    const sign = crypto.createSign('SHA256');
    sign.update('test');
    sign.end();
    sign.sign(key);
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to get authenticated Google Sheets client with private_key normalization
async function getGoogleSheetsClient() {
  // Option 1: GOOGLE_SERVICE_ACCOUNT_JSON env var
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
      let creds = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof creds === 'string') creds = JSON.parse(creds);
      
      if (creds && creds.private_key) {
        let cleanedKey = creds.private_key.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
        if (isValidPrivateKey(cleanedKey)) {
          creds.private_key = cleanedKey;
          const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
          });
          const authClient = await auth.getClient();
          return google.sheets({ version: 'v4', auth: authClient });
        } else {
          console.warn('[ZIPIT-SYNC] GOOGLE_SERVICE_ACCOUNT_JSON private_key is invalid according to OpenSSL. Falling back to credentials.json...');
        }
      }
    } catch (err) {
      console.warn('[ZIPIT-SYNC] Failed parsing GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }

  // Option 2: credentials.json physical file
  if (fs.existsSync(CREDENTIALS_PATH)) {
    try {
      const fileContent = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      if (fileContent.private_key) {
        fileContent.private_key = fileContent.private_key.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
      }
      if (isValidPrivateKey(fileContent.private_key)) {
        const auth = new google.auth.GoogleAuth({
          credentials: fileContent,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const authClient = await auth.getClient();
        return google.sheets({ version: 'v4', auth: authClient });
      } else {
        console.error('[ZIPIT-SYNC] credentials.json private_key is also invalid in OpenSSL.');
      }
    } catch (err) {
      console.error('[ZIPIT-SYNC] Failed using credentials file:', err.message);
    }
  }

  throw new Error('No valid Google Service Account credentials found (checked GOOGLE_SERVICE_ACCOUNT_JSON and credentials.json)');
}

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

// Helper to ensure tab exists in spreadsheet
async function ensureTabExists(sheets, tabName) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEETS_ID });
    const existingTabs = (meta.data.sheets || []).map(s => s.properties.title);
    if (!existingTabs.includes(tabName)) {
      console.log(`[ZIPIT-SYNC] Tab '${tabName}' does not exist. Creating it now...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEETS_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName }
              }
            }
          ]
        }
      });
      console.log(`[ZIPIT-SYNC] Created tab '${tabName}'.`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[ZIPIT-SYNC] Could not check/create tab '${tabName}':`, err.message);
    return false;
  }
}

// Clean address or name tags helper
function stripTags(text) {
  if (!text) return '';
  return String(text).replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').replace(/---[A-Z_]+---/g, '').trim();
}

// Helper to clear and write to a specific sheet tab starting cleanly at A1
async function updateSheet(sheets, tabName, values) {
  await ensureTabExists(sheets, tabName);

  // Clear existing content in sheet
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: `${tabName}!A1:Z5000`,
    });
  } catch (err) {
    console.warn(`[ZIPIT-SYNC] Clear warning for '${tabName}':`, err.message);
  }
  
  // Write fresh rows starting at A1 (prevents jumping to row 1000)
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEETS_ID,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
  
  console.log(`-> Successfully synced ${values.length - 1} data rows to '${tabName}' tab.`);
  return { tabName, rows: values.length - 1, updatedCells: res.data.updatedCells };
}

// ----------------------------------------------------
// 1. SYNC TO SHEETS (Supabase ➔ Google Sheets)
// ----------------------------------------------------
async function syncToSheets() {
  console.log(`[${new Date().toISOString()}] Starting sync TO Google Sheets...`);
  const sheets = await getGoogleSheetsClient();
  const results = {};

  // Profiles (Users)
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr) {
    console.error('[ZIPIT-SYNC] Profiles fetch error:', profErr.message);
    results.profiles = { error: profErr.message };
  } else {
    const profileRows = [['ID', 'Name', 'Phone', 'Email', 'Role', 'Primary Address', 'Village / Area', 'Lat', 'Lng', 'Created At']];
    (profiles || []).forEach(p => {
      profileRows.push([
        p.id || '',
        p.name || '',
        p.phone || '',
        p.email || '',
        p.is_admin ? 'Admin' : 'Customer',
        stripTags(p.address),
        p.gps_area || '',
        p.lat || '',
        p.lng || '',
        p.created_at || ''
      ]);
    });
    results.profiles = await updateSheet(sheets, 'Profiles', profileRows);
  }

  // Addresses
  const { data: addresses, error: addrErr } = await supabase.from('addresses').select('*');
  if (addrErr) {
    console.error('[ZIPIT-SYNC] Addresses fetch error:', addrErr.message);
    results.addresses = { error: addrErr.message };
  } else {
    const addressRows = [['ID', 'Profile ID', 'Type', 'Clean Address', 'Phone', 'Created At']];
    (addresses || []).forEach(a => {
      addressRows.push([
        a.id || '',
        a.profile_id || '',
        a.type || '',
        stripTags(a.details),
        a.phone || '',
        a.created_at || ''
      ]);
    });
    results.addresses = await updateSheet(sheets, 'Addresses', addressRows);
  }

  // Orders
  const { data: orders, error: ordErr } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (ordErr) {
    console.error('[ZIPIT-SYNC] Orders fetch error:', ordErr.message);
    results.orders = { error: ordErr.message };
  } else {
    const orderRows = [['Order ID', 'Profile ID', 'Total', 'Status', 'Payment Method', 'Payment Status', 'Created At']];
    (orders || []).forEach(o => {
      orderRows.push([
        o.id || '',
        o.profile_id || '',
        o.total || '',
        o.status || '',
        o.payment_method || '',
        o.payment_status || '',
        o.created_at || ''
      ]);
    });
    results.orders = await updateSheet(sheets, 'Orders', orderRows);
  }

  // Products (Inventory)
  const { data: products, error: prodErr } = await supabase.from('products').select('*').order('name');
  if (prodErr) {
    console.error('[ZIPIT-SYNC] Products fetch error:', prodErr.message);
    results.products = { error: prodErr.message };
  } else {
    const productsRows = [['ID', 'Name', 'Category ID', 'Price', 'Unit/Pack', 'Stock Count', 'Available', 'Created At']];
    (products || []).forEach(i => {
      const stock = i.stock_count != null ? i.stock_count : (i.is_out_of_stock ? 0 : 100);
      productsRows.push([
        i.id || '',
        stripTags(i.name),
        i.category_id || '',
        i.price || '',
        i.amount || '',
        stock,
        i.is_out_of_stock ? 'Out of Stock' : 'In Stock',
        i.created_at || ''
      ]);
    });
    results.products = await updateSheet(sheets, 'Inventory', productsRows);
  }

  console.log(`[${new Date().toISOString()}] Sync TO Sheets completed!`, results);
  return results;
}

// ----------------------------------------------------
// 2. SYNC FROM SHEETS (Google Sheets ➔ Supabase)
// ----------------------------------------------------
async function syncFromSheets() {
  console.log(`[${new Date().toISOString()}] Starting sync FROM Google Sheets...`);
  const sheets = await getGoogleSheetsClient();
  
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
        await supabase.from('orders').update({ status, payment_status }).eq('id', id);
        updatedOrders++;
      }
    }

    // Sync Inventory (Products)
    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: 'Inventory!A2:H',
    });
    
    const invRows = invRes.data.values || [];
    for (const row of invRows) {
      const [id, name, category_id, price, unit, stock_count] = row;
      if (id && price) {
        const updatePayload = { price: parseFloat(price) };
        if (stock_count !== undefined && stock_count !== '') {
          const s = parseInt(stock_count, 10);
          updatePayload.stock_count = isNaN(s) ? 100 : s;
          updatePayload.is_out_of_stock = isNaN(s) ? false : (s <= 0);
        }
        await supabase.from('products').update(updatePayload).eq('id', id);
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
    const details = await syncToSheets();
    const profCount = details.profiles?.rows ?? 0;
    const prodCount = details.products?.rows ?? 0;
    const ordCount = details.orders?.rows ?? 0;
    res.json({ 
      success: true, 
      message: `Pushed latest data to Google Sheets: ${profCount} Profiles, ${prodCount} Products, ${ordCount} Orders.`,
      details 
    });
  } catch (err) {
    console.error('[ZIPIT-SYNC] Push failed:', err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
};

const handleSyncFromSheets = async (req, res) => {
  try {
    const stats = await syncFromSheets();
    res.json({ 
      success: true, 
      message: `Pulled from Sheets. Updated ${stats.updatedOrders} Orders, ${stats.updatedProducts} Products.`,
      stats 
    });
  } catch (err) {
    console.error('[ZIPIT-SYNC] Pull failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.all(['/sync/to-sheets', '/api/syncToSheets'], handleSyncToSheets);
app.all(['/sync/from-sheets', '/api/syncFromSheets'], handleSyncFromSheets);

// Diagnostic Debug Route
app.get('/api/debug', async (req, res) => {
  const result = {
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    env: {
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_supabase_anon_key: !!process.env.SUPABASE_ANON_KEY,
      google_sheets_id: process.env.GOOGLE_SHEETS_ID,
      has_sa_json: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      has_credentials_file: require('fs').existsSync(CREDENTIALS_PATH),
    },
    supabase: {},
    sheets: {}
  };

  try {
    const { data: profs, error: prErr } = await supabase.from('profiles').select('id, name, is_admin').limit(5);
    result.supabase.profiles = { count: profs?.length, error: prErr?.message, sample: profs };

    const { data: prods, error: pErr } = await supabase.from('products').select('id, name, price, stock_count').limit(5);
    result.supabase.products = { count: prods?.length, error: pErr?.message, sample: prods };
  } catch (e) {
    result.supabase.error = e.message;
  }

  try {
    const sheets = await getGoogleSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEETS_ID });
    result.sheets.title = meta.data.properties.title;
    result.sheets.tabs = (meta.data.sheets || []).map(s => s.properties.title);
  } catch (e) {
    result.sheets.error = e.message;
    if (e.response && e.response.data) {
      result.sheets.details = e.response.data;
    }
  }

  res.json(result);
});

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

