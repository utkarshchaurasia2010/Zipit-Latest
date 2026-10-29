/**
 * Resend Free-Tier Safe Email Dispatcher & Rate-Limiter
 * Dedicated strictly to Support Ticket Confirmations & Inquiries (#6)
 * 
 * Free Tier Limits:
 * - 3,000 emails / month
 * - Max 100 emails / day (safety quota capped at 85/day)
 */

const RESEND_DAILY_QUOTA = 85; 
const QUOTA_STORAGE_KEY = 'quickly_resend_support_daily_tracker';
const SYSTEM_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Check if the total emails sent today across all users is under the 85 quota.
 * Checks Supabase centrally, with localStorage fast fallback.
 */
export const canSendEmail = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Central Check in Supabase System Profile (shared across all devices & users)
    const { supabase } = await import('./db');
    const { data } = await supabase
      .from('addresses')
      .select('id, details')
      .eq('profile_id', SYSTEM_PROFILE_ID)
      .eq('type', 'RESEND_QUOTA')
      .maybeSingle();

    if (data?.details) {
      try {
        const remoteTracker = JSON.parse(data.details);
        if (remoteTracker.date === today && remoteTracker.count >= RESEND_DAILY_QUOTA) {
          console.warn(`[Resend Guard] Global daily free support quota (${RESEND_DAILY_QUOTA}) reached for ${today}.`);
          return false;
        }
      } catch (_) {}
    }

    // 2. Local Fallback Check
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    let localTracker = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (localTracker.date === today && localTracker.count >= RESEND_DAILY_QUOTA) {
      return false;
    }

    return true;
  } catch (_) {
    return true;
  }
};

/**
 * Increment the global daily sent counter in Supabase so no device can bypass it.
 */
export const recordEmailSent = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Update localStorage
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    let tracker = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (tracker.date !== today) {
      tracker = { date: today, count: 0 };
    }
    tracker.count += 1;
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(tracker));

    // 2. Update Supabase Centrally
    const { supabase } = await import('./db');
    const { data: existing } = await supabase
      .from('addresses')
      .select('id, details')
      .eq('profile_id', SYSTEM_PROFILE_ID)
      .eq('type', 'RESEND_QUOTA')
      .maybeSingle();

    let remoteCount = 1;
    if (existing?.details) {
      try {
        const parsed = JSON.parse(existing.details);
        remoteCount = parsed.date === today ? (parsed.count + 1) : 1;
      } catch (_) {}
    }

    const payload = JSON.stringify({ date: today, count: remoteCount, updated_at: new Date().toISOString() });

    if (existing?.id) {
      await supabase.from('addresses').update({ details: payload }).eq('id', existing.id);
    } else {
      await supabase.from('addresses').insert([{
        profile_id: SYSTEM_PROFILE_ID,
        type: 'RESEND_QUOTA',
        details: payload,
        is_default: false
      }]);
    }
  } catch (err) {
    console.warn("Could not sync email quota to Supabase:", err);
  }
};

/**
 * Generate Customer Support Confirmation Email (#6)
 */
export const buildSupportConfirmationHtml = ({ name, email, orderNo, issueMessage }) => {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #0f172a; background: #ffffff;">
      <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="font-size: 20px; font-weight: 900; color: #0f172a;">Quickly Support</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">Customer Care Desk</span>
      </div>
      
      <p style="font-size: 14.5px; font-weight: 600;">Hi ${name || 'there'},</p>
      <p style="font-size: 13.5px; color: #334155; line-height: 1.5;">
        We have received your support request regarding <strong>${orderNo ? `Order #${orderNo}` : 'your inquiry'}</strong>.
      </p>
      
      <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #1e293b; border-radius: 0 8px 8px 0;">
        ${issueMessage || 'Inquiry submitted via customer portal'}
      </div>

      <p style="font-size: 13.5px; color: #334155; line-height: 1.5;">
        Our team is reviewing your message and will resolve it or reach out via WhatsApp/Call within <strong>15 minutes</strong>.
      </p>
      
      <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #94a3b8; text-align: center;">
        Quickly Rural Quick Commerce • Customer Care Desk (7:00 AM – 11:00 PM IST)
      </div>
    </div>
  `;
};
