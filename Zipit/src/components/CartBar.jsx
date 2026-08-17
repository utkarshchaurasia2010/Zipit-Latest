import React from 'react';
import { ChevronRight } from 'lucide-react';
import './CartBar.css';

const CartBar = ({ count, total, cart, onOpen, isNavHidden }) => {
  if (count === 0) return null;

  const displayItem = cart && cart.length > 0 ? cart[cart.length - 1] : null;

  return (
    <div className={`cart-bar-container ${isNavHidden ? 'nav-hidden' : ''}`}>
      <div className="cart-bar-pill" onClick={onOpen}>
        
        <div className="cart-bar-pill-left">
          <div className="cart-bar-image-stack">
            {cart.slice(0, 3).map((item, idx) => (
              <div key={item.id || idx} className="cart-bar-image-circle" style={{ zIndex: 3 - idx }}>
                <img src={item.image_url} alt="cart item" />
              </div>
            ))}
          </div>
        </div>

        <div className="cart-bar-pill-middle">
          <span className="cart-bar-title">View cart</span>
          <span className="cart-bar-subtitle">{count} item{count > 1 ? 's' : ''}</span>
        </div>

        <div className="cart-bar-pill-right">
          <div className="cart-bar-chevron-circle">
            <ChevronRight size={20} color="#FFF" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default CartBar;
