import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Share2, Plus, Minus, Trash2, Clock, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';
import { getCartDeliveryTime } from '../utils/time';
import './CartDrawer.css';

const CartDrawer = ({ 
  isOpen, 
  onClose, 
  cart, 
  updateCartQty, 
  itemTotal, 
  smallCartCharge = 0, 
  deliveryCharge = 0, 
  discountAmount = 0, 
  grandTotal = 0, 
  navigate,
  onProceedToCheckout
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalItems = cart ? cart.reduce((s, i) => s + (i.qty || 1), 0) : 0;
  const deliveryMinutes = getCartDeliveryTime(cart) || 9;
  const calculatedSavings = discountAmount > 0 ? discountAmount : 25; // Blinkit style savings badge

  const handleProceed = () => {
    onClose();
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else if (navigate) {
      navigate('/checkout');
    }
  };

  return createPortal(
    <div className="cart-drawer-overlay" onClick={onClose}>
      <aside className="cart-drawer-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header (Blinkit style: Back arrow, "My Cart", Share button) */}
        <div className="cart-drawer-header">
          <button className="cart-drawer-back-btn" onClick={onClose} title="Close cart">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="cart-drawer-title-box">
            <h2 className="cart-drawer-title">My Cart</h2>
            {totalItems > 0 && <span className="cart-drawer-subtitle">{totalItems} item{totalItems > 1 ? 's' : ''}</span>}
          </div>
          <button className="cart-drawer-share-btn" onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'My Zipit Cart', text: `Check out my order with ${totalItems} items!` });
            }
          }}>
            <Share2 size={16} />
            <span>Share</span>
          </button>
        </div>

        {/* Total Savings Pill (Blinkit blue bar) */}
        <div className="cart-drawer-savings-banner">
          <span>Your total savings</span>
          <strong>₹{calculatedSavings}</strong>
        </div>

        {/* Scrollable Content */}
        <div className="cart-drawer-content">
          
          {/* Delivery ETA Card */}
          <div className="cart-drawer-eta-card">
            <div className="cart-drawer-eta-icon">
              <Clock size={20} color="#0F172A" />
            </div>
            <div className="cart-drawer-eta-info">
              <h4>Delivery in {deliveryMinutes} minutes</h4>
              <p>Shipment of {totalItems} item{totalItems > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="cart-drawer-items-list">
            {cart.map((item) => {
              const qty = item.qty || 1;
              const originalPrice = Math.round(item.price * 1.25);
              return (
                <div key={item.id} className="cart-drawer-item-row">
                  <div className="cart-drawer-item-img">
                    <img src={item.image_url} alt={item.name} />
                  </div>
                  
                  <div className="cart-drawer-item-details">
                    <h5 className="cart-drawer-item-name">{item.name}</h5>
                    <span className="cart-drawer-item-unit">{item.amount || '1 unit'}</span>
                    <div className="cart-drawer-item-prices">
                      <span className="cart-drawer-price-current">₹{item.price}</span>
                      <span className="cart-drawer-price-mrp">₹{originalPrice}</span>
                    </div>
                  </div>

                  {/* Quantity Control Pill (Blinkit green) */}
                  <div className="cart-drawer-qty-pill">
                    <button 
                      type="button" 
                      onClick={() => updateCartQty(item, -1)}
                      className="cart-drawer-qty-btn"
                    >
                      <Minus size={14} strokeWidth={2.8} />
                    </button>
                    <span className="cart-drawer-qty-count">{qty}</span>
                    <button 
                      type="button" 
                      onClick={() => updateCartQty(item, 1)}
                      className="cart-drawer-qty-btn"
                    >
                      <Plus size={14} strokeWidth={2.8} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bill Details Section (Blinkit style breakdown) */}
          <div className="cart-drawer-bill-section">
            <h4 className="cart-drawer-bill-heading">Bill details</h4>
            
            <div className="cart-drawer-bill-row">
              <span className="cart-drawer-bill-label">
                Items total
                <span className="cart-drawer-saved-badge">Saved ₹{calculatedSavings}</span>
              </span>
              <span className="cart-drawer-bill-val">
                <span className="cart-drawer-val-strike">₹{itemTotal + calculatedSavings}</span> ₹{itemTotal}
              </span>
            </div>

            <div className="cart-drawer-bill-row">
              <span className="cart-drawer-bill-label">Delivery charge</span>
              <span className="cart-drawer-bill-val">
                {deliveryCharge === 0 ? <strong style={{ color: '#0C831F' }}>FREE</strong> : `₹${deliveryCharge}`}
              </span>
            </div>

            <div className="cart-drawer-bill-row">
              <span className="cart-drawer-bill-label">Handling charge</span>
              <span className="cart-drawer-bill-val">₹{smallCartCharge > 0 ? smallCartCharge : 2}</span>
            </div>

            <div className="cart-drawer-bill-divider" />

            <div className="cart-drawer-bill-row grand-total-row">
              <strong>Grand total</strong>
              <strong className="cart-drawer-grand-val">₹{grandTotal}</strong>
            </div>
          </div>

          {/* Additional Savings prompt banner */}
          <div className="cart-drawer-bottom-savings-pill">
            <div className="cart-drawer-savings-sub">
              <span>Your total savings</span>
              <strong>₹{calculatedSavings}</strong>
            </div>
            <p className="cart-drawer-free-subtext">Shop for ₹24 more to <strong>save ₹25 on delivery charge</strong></p>
          </div>

          {/* Safe & Hygienic badge */}
          <div className="cart-drawer-safety-pill">
            <ShieldCheck size={16} color="#059669" />
            <span>100% contactless & tamper-proof delivery</span>
          </div>

        </div>

        {/* Sticky Action Footer Bar (Blinkit style green bar with Total + Login to Proceed / Proceed to Checkout) */}
        <div className="cart-drawer-footer">
          <button 
            type="button" 
            className="cart-drawer-proceed-btn"
            onClick={handleProceed}
          >
            <div className="cart-drawer-btn-left">
              <span className="cart-drawer-btn-total">₹{grandTotal}</span>
              <span className="cart-drawer-btn-sub">TOTAL</span>
            </div>
            <div className="cart-drawer-btn-right">
              <span>Proceed to Checkout</span>
              <ChevronRight size={18} strokeWidth={2.8} />
            </div>
          </button>
        </div>

      </aside>
    </div>,
    document.body
  );
};

export default CartDrawer;
