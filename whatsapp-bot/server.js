import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// Supabase Connection
const SUPABASE_URL = 'https://bbaggauqnlcohrgvsios.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('----------------------------------------------------');
console.log('🚀 Starting Zipit WhatsApp Verification & AI Support Bot...');
console.log('----------------------------------------------------');

// Google Gemini AI Assistant Integration
async function askGeminiSupport(userText, userPhone, activeOrder, catalogSample) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) return null;

  const systemPrompt = `You are Zipit Bot, the 24/7 AI Customer Support Agent for Zipit (10-Minute Rural Grocery Delivery App in India).
Customer Phone: +91 ${userPhone}
Active Order: ${activeOrder ? `Order #${activeOrder.id.split('-')[0].toUpperCase()} - Status: ${activeOrder.status}, Total: ₹${activeOrder.total}` : 'No active order'}
Available Categories: Fruits, Vegetables, Dairy, Bakery, Snacks, Beverages, Household, Personal Care.

Customer Message: "${userText}"

Rules:
1. Respond warmly and concisely (2-4 sentences) in Hinglish / Hindi / English matching user tone.
2. Use WhatsApp formatting (*bold*, 📦, 🚚, ⚡ emojis).
3. If asking for order updates, use the exact Active Order details above.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply ? reply.trim() : null;
  } catch (err) {
    console.error('Gemini API Error:', err);
    return null;
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_session');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 SCAN THIS QR CODE WITH YOUR WHATSAPP TO LINK BOT:\n');
      qrcode.generate(qr, { small: true });
      console.log('(Open WhatsApp on your phone -> Linked Devices -> Link a Device -> Scan QR above)\n');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Zipit WhatsApp Bot is ONLINE and connected!');
      console.log('Listening for verification requests (ZIP-XXXX) & customer support chats...');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';
      let rawPhone = msg.key.participant || remoteJid;
      const senderPhone = rawPhone.split(':')[0].replace(/@.*$/, '').replace(/^91/, '').slice(-10);

      const text = (msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || '').trim();

      if (!text || !senderPhone || senderPhone.length < 10) continue;

      console.log(`📩 Incoming message from +91 ${senderPhone}: "${text}"`);

      // -------------------------------------------------------------
      // FLOW 1: WHATSAPP OTP VERIFICATION CHALLENGE (ZIP-XXXX)
      // -------------------------------------------------------------
      const tokenMatch = text.match(/ZIP-[A-Za-z0-9]+/i);
      if (tokenMatch) {
        const token = tokenMatch[0].toUpperCase();
        console.log(`🔍 Detected verification token: ${token} from +91 ${senderPhone}`);

        try {
          const { data: reqData, error: findErr } = await supabase
            .from('whatsapp_auth_requests')
            .select('*')
            .eq('token', token)
            .limit(1);

          if (findErr) console.error('Database query error:', findErr);

          if (!reqData || reqData.length === 0) {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ Verification code ${token} is invalid or expired. Please tap "Continue with WhatsApp" in the Zipit app to request a new OTP.`
            });
            continue;
          }

          let authOtp = reqData[0].status?.includes('OTP:') 
            ? reqData[0].status.split('OTP:')[1] 
            : Math.floor(100000 + Math.random() * 900000).toString();

          const { error: updateErr } = await supabase
            .from('whatsapp_auth_requests')
            .update({
              status: `OTP:${authOtp}`,
              phone: senderPhone
            })
            .eq('token', token);

          if (updateErr) console.error('Failed to update status in Supabase:', updateErr);

          await sock.sendMessage(remoteJid, {
            text: `👋 *Welcome to Zipit Delivery!*\n\nYour 6-digit Supabase Auth verification OTP is:\n\n👉 *${authOtp}*\n\n*(Valid for 5 minutes)*\n\nPlease enter this OTP in your Zipit App to complete login.`
          });
          console.log(`✅ Sent OTP ${authOtp} to +91 ${senderPhone} on WhatsApp.`);
          continue;

        } catch (err) {
          console.error('Error processing OTP verification message:', err);
          continue;
        }
      }

      // -------------------------------------------------------------
      // FLOW 2: AI CUSTOMER SUPPORT & LIVE ORDER ASSISTANT
      // -------------------------------------------------------------
      try {
        // Fetch user's active orders
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        const userOrders = (orders || []).filter(o => {
          const pPhone = o.delivery_address?.phone || '';
          return pPhone.includes(senderPhone);
        });

        const activeOrder = userOrders.length > 0 ? userOrders[0] : null;

        // Try Gemini AI response first
        const geminiReply = await askGeminiSupport(text, senderPhone, activeOrder, null);
        if (geminiReply) {
          await sock.sendMessage(remoteJid, { text: geminiReply });
          continue;
        }

        // Built-in intelligent fallback responder
        const lowerText = text.toLowerCase();
        if (lowerText.includes('order') || lowerText.includes('track') || lowerText.includes('status') || lowerText.includes('where') || lowerText.includes('kahan')) {
          if (activeOrder) {
            const orderCode = activeOrder.id.split('-')[0].toUpperCase();
            const itemsList = Array.isArray(activeOrder.items) 
              ? activeOrder.items.map(i => i.name).join(', ') 
              : 'Grocery Items';

            let statusEmoji = '⏳';
            if (activeOrder.status === 'Preparing') statusEmoji = '👨‍🍳 Packing in store';
            if (activeOrder.status === 'Out for delivery') statusEmoji = '🚚 Rider is on the way!';
            if (activeOrder.status === 'Delivered') statusEmoji = '🎉 Delivered!';

            await sock.sendMessage(remoteJid, {
              text: `📦 *Zipit Live Order Status*\n\n` +
                    `*Order ID:* #${orderCode}\n` +
                    `*Status:* ${activeOrder.status} ${statusEmoji}\n` +
                    `*Total:* ₹${activeOrder.total}\n` +
                    `*Items:* ${itemsList}\n\n` +
                    `Our delivery team is ensuring rapid 10-minute delivery to your doorstep!`
            });
          } else {
            await sock.sendMessage(remoteJid, {
              text: `📦 We couldn't find any active orders for mobile number *+91 ${senderPhone}*.\n\nOpen the Zipit App to browse fresh groceries with 10-minute delivery!`
            });
          }
          continue;
        }

        // Default Support Reply
        await sock.sendMessage(remoteJid, {
          text: `👋 *Hello from Zipit Customer Support!*\n\n` +
                `How can we help you today?\n\n` +
                `• Reply *\"order status\"* to track your latest delivery\n` +
                `• Open Zipit App to browse groceries with 10-minute delivery\n\n` +
                `Have questions? Our support team is always here for you!`
        });

      } catch (err) {
        console.error('Error handling customer support message:', err);
      }
    }
  });
}

startBot();
