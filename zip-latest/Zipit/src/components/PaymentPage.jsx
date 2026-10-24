import React, { useState } from 'react';
import { ChevronLeft, CreditCard, Banknote } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import { triggerConfetti } from '../utils/confetti';
import { playBellSound } from '../utils/siren';
import './SavedAddressesPage.css';

const PaymentPage = ({ navigate, cart, total, deliveryCharge, smallCartCharge, address, clearCart, appliedCoupon, setAppliedCoupon, discountAmount }) => {
  const [processing, setProcessing] = useState(false);
  const [isUpiOpen, setIsUpiOpen] = useState(false);
  const { showToast } = useToast();

  const handlePayment = async (method) => {
    setProcessing(true);
    try {
      await db.orders.add({
        items: cart,
        total: total,
        deliveryCharge: deliveryCharge,
        smallCartCharge: smallCartCharge,
        address: address,
        status: 'Preparing',
        paymentMethod: method,
        discountAmount: discountAmount || 0,
        couponCode: appliedCoupon ? appliedCoupon.code : null
      });
      playBellSound();
      triggerConfetti();
      // Clear cart in both React state and database
      clearCart();
      await db.carts.clear();
      if (setAppliedCoupon) setAppliedCoupon(null);
      showToast(`Order Placed! Your order via ${method} was placed successfully.`, 'Order Placed 🎉');
      navigate('/track');   // Go directly to live order tracking
    } catch (e) {
      console.error(e);
      showToast('Something went wrong. Please try again.', 'Payment Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpiClick = () => {
    setIsUpiOpen(true);
    window.location.href = `upi://pay?pa=7290886111@ptyes&pn=Zipit%20Store&am=${total}&cu=INR&tn=Order%20Payment`;
  };

  return (
    <div className="addresses-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 16px' }}>
        <button className="back-btn" onClick={() => navigate('/checkout')} style={{ margin: 0, padding: '8px' }}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Payment</h2>
      </header>
      <div className="addresses-container">
        <div style={{background: 'var(--color-surface)', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid var(--color-border)', textAlign: 'center'}}>
          <h3 style={{margin: 0, fontSize: 16}}>Amount to Pay: <strong>₹{total}</strong></h3>
        </div>
        
        {processing && <div style={{textAlign:'center', fontSize: 12}}>Processing Payment...</div>}
        
        {isUpiOpen ? (
          <div style={{background: 'var(--color-surface)', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid var(--color-border)', textAlign: 'center'}}>
            <h4 style={{marginTop: 0}}>Waiting for payment...</h4>
            <p style={{fontSize: 14, color: 'var(--color-text-light)', marginBottom: 16}}>Please complete the payment in your UPI app. Once done, click the button below to verify.</p>
            <button 
              className="checkout-place-order-btn" 
              style={{width: '100%', display: 'block', textAlign: 'center'}}
              onClick={() => handlePayment('UPI')}
              disabled={processing}
            >
              I Have Paid
            </button>
          </div>
        ) : (
          <div className="address-card" onClick={() => {
            if (!processing) {
              window.location.href = `upi://pay?pa=9651568829@upi&pn=Utkarsh%20Chaurasia&am=${total}&cu=INR`;
              setIsUpiOpen(true);
            }
          }} style={{opacity: processing ? 0.5 : 1}}>
            <div className="address-type">
              <CreditCard size={20} color="var(--color-success)" />
              <h4>Pay via UPI Apps</h4>
            </div>
            <p className="address-details">Opens GPay, PhonePe, Paytm automatically</p>
          </div>
        )}
        
        <div className="address-card" onClick={() => !processing && handlePayment('Cash on Delivery')} style={{opacity: processing ? 0.5 : 1}}>
          <div className="address-type">
            <Banknote size={20} color="var(--color-text-light)" />
            <h4>Cash on Delivery (COD)</h4>
          </div>
          <p className="address-details">Pay when your order arrives</p>
        </div>
      </div>
    </div>
  );
};
export default PaymentPage;
