# Quickly Supermarket: Commissions & Partner Payouts Guide

This guide details the newly added **Commissions & Payouts Engine** and recent operational enhancements across the Quickly Admin, Rider, Shopkeeper, and Customer applications.

---

## 1. Database Setup (Supabase Migration)

Run the SQL migration script located at [`supabase_commissions_migration.sql`](file:///D:/Projects/Zipit%20All/supabase_commissions_migration.sql) inside your **Supabase SQL Editor**:

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** from the left navigation bar.
3. Paste the contents of `supabase_commissions_migration.sql` and click **Run**.

### What this migration creates:
- `products.cost_price`: Adds a wholesale procurement cost column (`NUMERIC(10, 2) DEFAULT 0.00`) to calculate net platform margins.
- `order_commissions`: Stores an immutable rate snapshot and breakdown per delivered order (`order_id`, `subtotal`, `wholesale_cost`, `delivery_fee`, `shop_share`, `rider_share`, `platform_share`, `rates_snapshot`, `status`, `payout_id`).
- `partner_payouts`: Records financial disbursements to riders and dark-store shopkeepers (`partner_type`, `partner_id`, `period_start`, `period_end`, `total_amount`, `payment_mode`, `reference_note`, `paid_at`).
- `admin_audit_logs`: Audits setting adjustments and financial settlements.
- **Row-Level Security (RLS)**: Enforces that commission and payout records are strictly visible to admins and cannot be read or tampered with by regular customers.

---

## 2. Admin Settings Configuration

Navigate to **Admin Panel > Settings** (`/settings`):
Under the **Commissions & Payouts Engine** card, you can configure:
- **Shopkeeper Commission %**: e.g. `7.0%`
- **Shop Commission Cap (₹)**: e.g. `₹20` per order (`0` = uncapped)
- **Rider Calculation Mode**: `percent` or `flat`
- **Rider Commission % / Min / Max**: e.g. `4.0%`, min `₹10`, max `₹20` (in percent mode)
- **Rider Flat Fee (₹)**: e.g. `₹12` (in flat mode)
- **Distance Add-on (3 - 6 km)**: e.g. `+₹3`
- **Distance Add-on (6 - 8 km)**: e.g. `+₹6`
- **Min Order Value (₹)**: e.g. `₹199`
- **Small Order Fee (₹)**: e.g. `₹35` (applied if customer chooses to pay delivery on small carts)

*Note: Changes only apply to future order calculations. Each order retains a snapshot of the rates active when its commission was calculated.*

---

## 3. Orders Section: Commission Calculation

Navigate to **Admin Panel > Orders** (`/orders`):
1. **Bulk Calculation**: Click **"Calculate for all delivered orders"** in the top toolbar to process all delivered orders that do not yet have an active commission.
2. **Per-Order Calculation**: On any order marked **Delivered**, click **"Calculate Commission"** (or **"Recalculate"**).
3. **Commission Breakdown Card**: Displays:
   - **Basket Subtotal**: Item total excluding delivery and surge fees.
   - **Wholesale Cost**: Sum of item `cost_price * qty`. If any item lacks a cost price, it displays *"Cost Missing"*.
   - **Delivery Fee**: Customer delivery fee collected.
   - **Shop Share**: Dark store commission based on percentage and cap.
   - **Rider Share**: Rider payout based on percent/flat rule + distance add-on (0 for Store Pickup).
   - **Platform Share**: Net store profit. If negative, it is highlighted in **red** with a `⚠️ Loss` warning.
4. **Idempotency & Cancellations**: Re-calculating updates the existing row without creating duplicates. If an order is marked **Cancelled** or **Refunded**, its commission is automatically marked `status = 'void'` and omitted from payout settlements.

---

## 4. Payouts & Settlements Page

Navigate to **Admin Panel > Payouts** (`/payouts`):
- **Tabs**: Switch between **Riders** (suggested daily cycle) and **Dark Store Shopkeepers** (suggested weekly cycle).
- **Date Presets**: Today, Yesterday, This Week, Last Week, This Month, or custom date ranges.
- **Settlement Dialog**: Click **"Mark as Paid"** to disburse balance. Choose payment method (`UPI`, `Cash`, `Bank Transfer`) and enter the transaction reference / UTR number.
- **Exporting**:
  - Click **"Export All Commissions (CSV)"** for raw bookkeeping.
  - Click **"Statement (CSV)"** on a partner card for an itemized partner breakdown.
  - Click **"Print / PDF Statement"** to generate a clean, branded statement to share with the partner.

---

## 5. Summary of Operational Enhancements

1. **Button Styling**: All buttons across Admin have minimal rounded corners (`border-radius: 8px`) and rectangular structure, strictly avoiding pill shapes.
2. **Mobile Settings Access**: Quick settings gear button is pinned to the Admin topbar right next to the mobile menu hamburger.
3. **Delivery Zones Map**: Online riders assigned to a zone remain anchored within their assigned polygon centroid without being pushed to the hub center.
4. **Order Concurrency**: Rider and shopkeeper acceptance queries are executed with atomic Postgres checks (`.or('accepted_by_rider.is.null,accepted_by_rider.eq.' + userCode)`) preventing race conditions and double claims.
5. **Pickup SLA Timer**: Reduced from 5 to 3 minutes. If timer expires without rider pickup, order auto-releases back to the pool.
6. **Live Refresh Buttons**: Both Rider and Shopkeeper apps feature spinning sync buttons to manually fetch incoming orders on demand.
7. **Small Order Confirmation Modal**: If cart is below minimum order value (₹199), customer is prompted to either add items for free delivery or pay the ₹35 small order fee.
8. **Cart Clearing**: Cart state, `localStorage`, and the Supabase `carts` table are completely wiped upon placing an order.
