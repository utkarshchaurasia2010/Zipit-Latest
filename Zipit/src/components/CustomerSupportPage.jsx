import React, { useState } from 'react';
import './CustomerSupportPage.css';
import { ChevronLeft, MessageCircle, PhoneCall, Clock, ShieldCheck, Mail, HelpCircle, ChevronDown, ChevronUp, PackageCheck, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
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
            href="https://wa.me/919999999999?text=Hi%20Zipit%20Support,%20I%20need%20help%20with%20my%20order."
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

          <a
            href="mailto:zipitrural@gmail.com"
            className="support-action-card email"
          >
            <div className="support-action-icon email-icon">
              <Mail size={24} />
            </div>
            <div className="support-action-content">
              <h4>Email Support</h4>
              <span>zipitrural@gmail.com</span>
            </div>
          </a>
        </div>

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
          <span>Operational Hours: 7:00 AM – 11:00 PM IST (Mon - Sun)</span>
        </div>
      </div>
    </div>
  );
};

export default CustomerSupportPage;
