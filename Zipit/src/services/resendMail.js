/**
 * Resend Free-Tier Safe Email Dispatcher & Rate-Limiter
 * 
 * Free Tier Limits:
 * - 3,000 emails / month
 * - Max 100 emails / day (safety quota capped at 85/day)
 * - Max 2 requests / sec rate-limit
 */

const RESEND_DAILY_QUOTA = 85; // Conservative cap under the 100/day limit
const QUOTA_STORAGE_KEY = 'quickly_resend_daily_tracker';

// Checks and increments the client-side daily quota tracker to safeguard against overages
export const canSendEmail = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    let tracker = raw ? JSON.parse(raw) : { date: today, count: 0 };

    if (tracker.date !== today) {
      tracker = { date: today, count: 0 };
    }

    if (tracker.count >= RESEND_DAILY_QUOTA) {
      console.warn(`[Resend Guard] Daily free quota (${RESEND_DAILY_QUOTA}) reached for ${today}. Email withheld.`);
      return false;
    }

    return true;
  } catch (_) {
    return true;
  }
};

export const recordEmailSent = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    let tracker = raw ? JSON.parse(raw) : { date: today, count: 0 };

    if (tracker.date !== today) {
      tracker = { date: today, count: 0 };
    }

    tracker.count += 1;
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(tracker));
  } catch (_) {}
};

/**
 * 1. Generate Order Confirmation Email HTML for Customer (#1)
 */
export const buildCustomerOrderEmailHtml = (order) => {
  const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';
  const orderId = order.id ? order.id.slice(0, 8).toUpperCase() : 'N/A';
  const items = Array.isArray(order.items) ? order.items : [];

  const itemsListHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 0; color: #0f172a; font-size: 13.5px; font-weight: 600;">
        <span style="color: #10b981; margin-right: 6px;">${item.qty}×</span> ${item.name}
      </td>
      <td style="padding: 10px 0; color: #0f172a; font-size: 13.5px; font-weight: 700; text-align: right;">
        ₹${(Number(item.price) || 0) * (Number(item.qty) || 1)}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px 28px; color: #ffffff;">
            <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">Quickly</div>
            <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">India's Rural Delivery App</div>
            <h1 style="font-size: 20px; margin: 16px 0 4px 0; font-weight: 800;">Order Confirmed! 🎉</h1>
            <p style="font-size: 13px; margin: 0; opacity: 0.95;">Order #${orderId} • ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>

          <!-- Content -->
          <div style="padding: 24px 28px;">
            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;">
              <div style="font-weight: 800; color: #166534; font-size: 13.5px;">
                ${isPickup ? '🛍️ Ready at Pickup Counter in ~1 hr' : '⚡ Delivering in 10–15 Minutes'}
              </div>
              <div style="font-size: 12px; color: #15803d; margin-top: 2px;">
                ${isPickup ? 'Pickup at Quickly Store Hubs' : (order.delivery_address?.details?.split('\n---TAG:')[0] || 'Selected Address')}
              </div>
            </div>

            <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 8px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              ${itemsListHtml}
            </table>

            <div style="border-top: 2px solid #0f172a; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 15px; font-weight: 800;">Total Paid</span>
              <span style="font-size: 20px; font-weight: 900; color: #0f172a;">₹${order.total || 0}</span>
            </div>

            <div style="margin-top: 24px; text-align: center;">
              <a href="https://quickly.app/track" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 28px; border-radius: 30px; font-size: 14px; font-weight: 800; text-decoration: none;">
                Track Live Order
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 16px 28px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #94a3b8; text-align: center;">
            Need help with your order? Reach our support team at <a href="mailto:zipitrural@gmail.com" style="color: #10b981; text-decoration: none;">zipitrural@gmail.com</a>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * 2. Generate Store Hub / Admin Alert Email HTML (#2)
 */
export const buildAdminNewOrderAlertHtml = (order) => {
  const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';
  const orderId = order.id ? order.id.slice(0, 8).toUpperCase() : 'N/A';
  const customerPhone = order.delivery_address?.phone || order.profiles?.phone || 'Not provided';
  const customerName = order.delivery_address?.name || order.profiles?.name || 'Customer';
  const items = Array.isArray(order.items) ? order.items : [];

  const itemsRows = items.map(i => `
    <li><strong>${i.qty}×</strong> ${i.name} — ₹${(Number(i.price) || 0) * (Number(i.qty) || 1)}</li>
  `).join('');

  return `
    <div style="font-family: sans-serif; padding: 16px; color: #1e293b;">
      <h2 style="color: #0f172a; margin-top: 0;">🚨 New Order Received: #${orderId}</h2>
      <p style="font-size: 15px; font-weight: bold; color: #15803d;">
        Type: ${isPickup ? 'STORE PICKUP (~1 HR)' : 'HOME DELIVERY (10-15 MINS)'}
      </p>
      <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0 0 6px 0;"><strong>Customer:</strong> ${customerName}</p>
        <p style="margin: 0 0 6px 0;"><strong>Phone:</strong> ${customerPhone}</p>
        <p style="margin: 0;"><strong>Address:</strong> ${order.delivery_address?.details?.split('\n---TAG:')[0] || 'Store Pickup'}</p>
      </div>

      <h3>Packing List:</h3>
      <ul>
        ${itemsRows}
      </ul>

      <p style="font-size: 16px;"><strong>Grand Total:</strong> ₹${order.total} (${order.payment_method || 'Online'})</p>
      <p style="font-size: 12px; color: #64748b;">Quickly Hub Automated Alert</p>
    </div>
  `;
};

/**
 * 3. Generate Customer Support Confirmation Email (#6)
 */
export const buildSupportConfirmationHtml = ({ name, email, orderNo, issueMessage }) => {
  return `
    <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      <h2 style="color: #10b981; margin-top: 0;">Quickly Support Desk</h2>
      <p>Hi ${name || 'there'},</p>
      <p>We have received your support request regarding <strong>${orderNo ? `Order #${orderNo}` : 'your inquiry'}</strong>.</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 10px 14px; margin: 16px 0; font-size: 13.5px;">
        ${issueMessage || 'Inquiry submitted via customer portal'}
      </div>

      <p>Our team is reviewing your message and will resolve it or reach out via WhatsApp/Call within <strong>15 minutes</strong>.</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Quickly Rural Quick Commerce • Customer Care</p>
    </div>
  `;
};
