import React from 'react';
import { X, ChevronRight, Package, Trash2, ShoppingCart } from 'lucide-react';
import './CartModal.css';

const CartModal = ({ isOpen, onClose, cart, updateCartQty, total, onProceed }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Your Cart</h3>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        
        <div className="modal-body">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={64} color="var(--color-text-light)" style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item-row">
                  <div className="cart-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', position: 'relative' }}>
                    {item.sticker && <div className="wafer-sticker" style={{fontSize: '7px', padding: '2px 4px'}}>{item.sticker}</div>}
                    <Package size={24} color="#888" />
                  </div>
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-amount" style={{ fontSize: '12px', color: '#666' }}>{item.amount}</span>
                    <span className="cart-item-price">
                      {item.is_wafer ? (
                        <span className="wafer-price-tag" style={{fontSize: '11px', padding: '2px 6px'}}>₹{item.price}</span>
                      ) : (
                        <>₹{item.price}</>
                      )}
                    </span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <div className="cart-item-qty-control">
                      <button onClick={() => updateCartQty(item, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateCartQty(item, 1)}>+</button>
                    </div>
                    <button onClick={() => updateCartQty(item, -item.qty)} style={{background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'}}>
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="modal-footer">
            <div className="bill-details">
              <span>Item Total</span>
              <span>₹{total}</span>
            </div>
            <button className="pay-btn" onClick={onProceed}>
              Proceed to Pay <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartModal;
