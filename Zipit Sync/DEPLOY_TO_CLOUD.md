# How to Deploy Zipit Sync to Cloud (Free 24/7 Background Service)

Follow these simple steps to host `Zipit Sync` in the cloud on **Render.com** (100% Free tier, no credit card required).

---

### Step 1: Create a Free Account on Render
1. Go to [https://render.com](https://render.com) and Sign In with your GitHub account.

---

### Step 2: Create a New Web Service
1. In your Render Dashboard, click **New +** ➔ **Web Service**.
2. Select your repository: `utkarshchaurasia2010/Zipit-Latest`.
3. Configure the following fields:
   * **Name**: `zipit-sync`
   * **Root Directory**: `Zipit Sync`
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Instance Type**: `Free`

---

### Step 3: Add Environment Variables in Render
Under the **Environment Variables** tab on Render, add these 5 variables:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://bbaggauqnlcohrgvsios.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ` |
| `GOOGLE_SHEETS_ID` | `1nIK_sYkNurKoVkXch9WBuxT_TfLI_-R4s83uxrGL1is` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(Copy and paste the single line from `.env.example` in this folder)* |

---

### Step 4: Click "Deploy Web Service"
* Render will install dependencies and start the server.
* Once deployed, Render will give you a public URL (e.g. `https://zipit-sync.onrender.com`).
* Your server will now:
  1. Sync to Google Sheets **automatically on startup**.
  2. Run the cron job **every 3 hours continuously in the background**.
  3. Respond to manual push/pull webhook requests anytime.

---

### Step 5: Connect Admin Panel to Cloud Sync URL (Optional)
In `Zipit Admin/src/components/AdminLayout.jsx`, update the sync fetch URLs:
* Replace `/api/syncToSheets` with `https://zipit-sync.onrender.com/sync/to-sheets`
* Replace `/api/syncFromSheets` with `https://zipit-sync.onrender.com/sync/from-sheets`
