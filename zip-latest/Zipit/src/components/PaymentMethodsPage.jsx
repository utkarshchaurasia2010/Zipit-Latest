import React from 'react';
import { ChevronLeft, Smartphone, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import './PaymentMethodsPage.css';

const PaymentMethodsPage = ({ navigate }) => {
  return (
    <div className="payment-methods-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '12px 16px' }}>
        <button className="back-btn" onClick={() => navigate(-1)} style={{ margin: 0, padding: '8px' }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800' }}>Payment Methods</h2>
      </header>

      <div className="payment-methods-container">
        {/* UPI Apps Card */}
        <div className="payment-method-card">
          <div className="payment-method-icon-box upi">
            <Smartphone size={24} />
          </div>
          <div className="payment-method-info">
            <div className="payment-method-title">
              <span>UPI Apps</span>
              <span className="payment-badge">Instant</span>
            </div>
            <p className="payment-method-sub">Google Pay, PhonePe, Paytm, BHIM &amp; CRED</p>
          </div>
        </div>

        {/* Cards & Netbanking */}
        <div className="payment-method-card">
          <div className="payment-method-icon-box card">
            <CreditCard size={24} />
          </div>
          <div className="payment-method-info">
            <div className="payment-method-title">
              <span>Cards &amp; Netbanking</span>
            </div>
            <p className="payment-method-sub">Visa, Mastercard, RuPay &amp; Net Banking</p>
          </div>
        </div>

        {/* Cash on Delivery */}
        <div className="payment-method-card">
          <div className="payment-method-icon-box cod">
            <Banknote size={24} />
          </div>
          <div className="payment-method-info">
            <div className="payment-method-title">
              <span>Cash on Delivery</span>
            </div>
            <p className="payment-method-sub">Pay via cash or UPI scan when your order arrives at your doorstep</p>
          </div>
        </div>

        {/* Security badge note */}
        <div className="payment-secure-pill">
          <ShieldCheck size={16} color="#10b981" />
          <span>100% RBI Compliant &amp; 256-bit Encrypted Checkout</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsPage;
