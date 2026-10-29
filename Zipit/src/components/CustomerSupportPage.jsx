import React, { useState } from 'react';
import './CustomerSupportPage.css';
import { ChevronLeft, MessageCircle, PhoneCall, Clock, ShieldCheck, Mail, HelpCircle, ChevronDown, ChevronUp, PackageCheck, AlertCircle, Send } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/db';
import { canSendEmail, recordEmailSent, buildSupportConfirmationHtml } from '../services/resendMail';
import { triggerHaptic } from '../utils/haptics';

const FAQS = [
  {
    q: "How fast is delivery?",
    a: "We deliver within 10 to 15 minutes in our active service geofence directly to your doorstep."
  },
  {
    q: "How can I track my live order?",
    a: "Go to your active orders or past orders section to view live rider progress and status updates."
  },
  {
    q: "What if an item is damaged or missing?",
    a: "Reach out instantly via WhatsApp chat or phone call with your order number. We will replace or refund it immediately."
  },
  {
    q: "How do refunds work?",
    a: "Refunds for UPI payments are credited instantly back to your bank account. Cash on delivery cancellations require zero charge."
  }
];

const CustomerSupportPage = ({ navigate }) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [openFaq, setOpenFaq] = useState(null);

  // Quick Support Ticket State
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketName, setTicketName] = useState('');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketOrderNo, setTicketOrderNo] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleSendSupportTicket = async (e) => {
    e.preventDefault();
    if (!ticketEmail || !ticketMsg) return;

    setIsSubmittingTicket(true);
    triggerHaptic('medium');

    try {
      // 1. Dispatch auto-confirmation to customer if under free-tier quota
      const underQuotaCustomer = await canSendEmail();
      if (underQuotaCustomer) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: ticketEmail,
            subject: `Support Ticket Received: Quickly Care${ticketOrderNo ? ` [Order #${ticketOrderNo}]` : ''}`,
            html: buildSupportConfirmationHtml({
              name: ticketName,
              email: ticketEmail,
              orderNo: ticketOrderNo,
              issueMessage: ticketMsg
            })
          }
        });
        await recordEmailSent();

        // 2. Also forward to store hub desk if under quota
        const underQuotaStore = await canSendEmail();
        if (underQuotaStore) {
          supabase.functions.invoke('send-email', {
            body: {
              to: 'zipitrural@gmail.com',
              subject: `📩 Support Ticket from ${ticketName || 'Customer'} [${ticketEmail}]`,
              html: `
                <div style="font-family: sans-serif; padding: 16px;">
                  <h2>Support Request Submitted</h2>
                  <p><strong>Customer Name:</strong> ${ticketName}</p>
                  <p><strong>Customer Email:</strong> ${ticketEmail}</p>
                  <p><strong>Order No:</strong> ${ticketOrderNo || 'N/A'}</p>
                  <div style="background: #f1f5f9; padding: 12px; border-radius: 8px;">
                    ${ticketMsg}
                  </div>
                </div>
              `
            }
          }).then(() => recordEmailSent()).catch(() => {});
        }
      }

      showToast('Support ticket submitted! Confirmation sent to your email.', 'Ticket Submitted');
      triggerHaptic('success');
      setTicketMsg('');
      setShowTicketForm(false);
    } catch (err) {
      console.error(err);
      showToast('Ticket recorded. Our support desk will assist you shortly.', 'Received');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div className="customer-support-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '12px 16px' }}>
        <button className="back-btn" onClick={() => navigate(-1)} style={{ margin: 0, padding: '8px' }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800' }}>Customer Support</h2>
      </header>

      <div className="support-container">
        {/* Banner card */}
        <div className="support-hero-card">
          <div className="support-hero-badge">
            <span className="live-pulse-dot"></span>
            Live Support Active
          </div>
          <h3>We're here to help you</h3>
          <p>Available every day from 7:00 AM to 11:00 PM for all your delivery queries</p>
        </div>

        {/* Quick action contact channels */}
        <div className="support-actions-grid">
          <a
            href="https://wa.me/919999999999?text=Hi%20Quickly%20Support,%20I%20need%20help%20with%20my%20order."
            target="_blank"
            rel="noopener noreferrer"
            className="support-action-card whatsapp"
          >
            <div className="support-action-icon whatsapp-icon">
              <MessageCircle size={24} />
            </div>
            <div className="support-action-content">
              <h4>WhatsApp Chat</h4>
              <span>Fastest response • Under 2 mins</span>
            </div>
          </a>

          <a
            href="tel:+919999999999"
            className="support-action-card phone"
          >
            <div className="support-action-icon phone-icon">
              <PhoneCall size={24} />
            </div>
            <div className="support-action-content">
              <h4>Call Customer Care</h4>
              <span>Direct line with support executive</span>
            </div>
          </a>

          <div 
            className="support-action-card orders"
            onClick={() => navigate('/past-orders')}
          >
            <div className="support-action-icon orders-icon">
              <PackageCheck size={24} />
            </div>
            <div className="support-action-content">
              <h4>Order Issues &amp; Refunds</h4>
              <span>View status of items, replacements &amp; refunds</span>
            </div>
          </div>

          <div 
            className="support-action-card email"
            onClick={() => setShowTicketForm(!showTicketForm)}
          >
            <div className="support-action-icon email-icon">
              <Mail size={24} />
            </div>
            <div className="support-action-content" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>Send Support Message</h4>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>{showTicketForm ? 'Close' : 'Write Us'}</span>
              </div>
              <span>Submit inquiry and receive an instant email receipt</span>
            </div>
          </div>
        </div>

        {/* Quick Ticket Drawer Form */}
        {showTicketForm && (
          <form onSubmit={handleSendSupportTicket} className="support-ticket-form" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '16px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: 'var(--color-text)' }}>Write to Quickly Support</h4>
            <input 
              type="text" 
              placeholder="Your Name" 
              required
              value={ticketName} 
              onChange={e => setTicketName(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', fontSize: '13px' }}
            />
            <input 
              type="email" 
              placeholder="Your Email Address" 
              required
              value={ticketEmail} 
              onChange={e => setTicketEmail(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', fontSize: '13px' }}
            />
            <input 
              type="text" 
              placeholder="Order Number (optional)" 
              value={ticketOrderNo} 
              onChange={e => setTicketOrderNo(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', fontSize: '13px' }}
            />
            <textarea 
              placeholder="Describe your issue or feedback..." 
              required
              rows={3}
              value={ticketMsg} 
              onChange={e => setTicketMsg(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', fontSize: '13px', resize: 'none' }}
            />
            <button 
              type="submit" 
              disabled={isSubmittingTicket}
              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Send size={15} /> {isSubmittingTicket ? 'Sending Ticket...' : 'Submit Support Ticket'}
            </button>
          </form>
        )}

        {/* Frequently Asked Questions */}
        <div className="support-faq-section">
          <h4 className="support-faq-heading">Frequently Asked Questions</h4>
          <div className="faq-list">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className={`faq-item ${isOpen ? 'open' : ''}`} onClick={() => toggleFaq(idx)}>
                  <div className="faq-question">
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={18} color="var(--color-primary)" /> : <ChevronDown size={18} color="var(--color-text-light)" />}
                  </div>
                  {isOpen && (
                    <div className="faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Support hours footer pill */}
        <div className="support-footer-note">
          <Clock size={16} color="var(--color-text-light)" />
          <span>Operational Hours: 7:00 AM – 11:00 PM IST</span>
        </div>
      </div>
    </div>
  );
};

export default CustomerSupportPage;
