import React from 'react';
import { ChevronLeft, CreditCard } from 'lucide-react';
import { db } from '../services/db';

const PaymentMethodsPage = ({ navigate }) => {
  const methods = db.paymentMethods.getAll();

  return (
    <div className="payment-methods-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '4px 16px' }}>
        <button className="back-btn" onClick={() => navigate('/profile')} style={{ margin: 0, padding: '8px' }}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Payment Methods</h2>
      </header>
      <div className="addresses-container">
        <div className="address-card">
          <div className="address-type">
            <CreditCard size={20} color="var(--color-success)" />
            <h4>UPI Apps</h4>
          </div>
          <p className="address-details">GPay, PhonePe, Paytm, Amazon Pay</p>
        </div>
        
        <div className="address-card">
          <div className="address-type">
            <CreditCard size={20} color="var(--color-text-light)" />
            <h4>Cash on Delivery</h4>
          </div>
          <p className="address-details">Pay when your order arrives</p>
        </div>
      </div>
    </div>
  );
};
export default PaymentMethodsPage;
