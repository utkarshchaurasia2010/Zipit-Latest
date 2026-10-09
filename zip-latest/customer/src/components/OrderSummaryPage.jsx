import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import './OrderSummaryPage.css';

const OrderSummaryPage = ({ navigate, cart, total, address }) => {
  if (!address) {
    navigate('checkout-address');
    return null;
  }

  const deliveryFee = 25;
  const grandTotal = total + deliveryFee;

  return (
    <div className="order-summary-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('checkout-address')}><ArrowLeft size={20} color="var(--color-text)" /></button>
        <h2>Order Summary</h2>
      </header>
      
      <div className="summary-content">
        <div className="delivery-card">
          <h4>Delivering to {address.type}</h4>
          <p>{address.details}</p>
        </div>

        <div className="items-card">
          <h4>Items in your cart</h4>
          {cart.map(item => (
            <div key={item.id} className="summary-item-row">
              <div className="summary-item-qty">{item.qty}x</div>
              <div className="summary-item-name">{item.name}</div>
              <div className="summary-item-price">
                {item.is_wafer ? (
                  <span className="wafer-price-tag" style={{fontSize: '11px', padding: '2px 6px'}}>₹{item.price * item.qty}</span>
                ) : (
                  <>₹{item.price * item.qty}</>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bill-card">
          <h4>Bill Details</h4>
          <div className="bill-row">
            <span>Item Total</span>
            <span>₹{total}</span>
          </div>
          <div className="bill-row">
            <span>Delivery Fee</span>
            <span>₹{deliveryFee}</span>
          </div>
          <div className="bill-row total-row">
            <span>Grand Total</span>
            <span>₹{grandTotal}</span>
          </div>
        </div>
      </div>

      <div className="bottom-pay-bar">
        <button className="pay-btn" onClick={() => navigate('payment', { address, total: grandTotal })}>
          Select Payment Method <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};
export default OrderSummaryPage;
