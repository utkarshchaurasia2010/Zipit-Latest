import React from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import { stripAddressTags } from './SavedAddressesPage';
import './SavedAddressesPage.css';
import './CartModal.css';

const CheckoutAddressPage = ({ navigate, addresses, cart, updateCartQty }) => {
  return (
    <div className="addresses-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
        <h2>Select Delivery Address</h2>
      </header>
      <div className="addresses-container">
        
        {cart && cart.length > 0 && (
          <div className="cart-items-list" style={{marginBottom: 20, background: 'var(--color-surface)', padding: 16, borderRadius: 12}}>
            <h4 style={{marginBottom: 12, marginTop: 0}}>Order Items</h4>
            {cart.map((item) => (
              <div key={item.id} className="cart-item-row" style={{marginBottom: 12}}>
                <div className="cart-item-img" style={{position: 'relative'}}>
                  {item.sticker && <div className="wafer-sticker" style={{fontSize: '7px', padding: '2px 4px'}}>{item.sticker}</div>}
                  <img src={item.image_url} alt={item.name} />
                </div>
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-price">
                    {item.is_wafer ? (
                      <span className="wafer-price-tag" style={{fontSize: '11px', padding: '2px 6px'}}>₹{item.price}</span>
                    ) : (
                      <>₹{item.price}</>
                    )}
                  </span>
                </div>
                <div className="cart-item-qty-control">
                  <button onClick={() => updateCartQty(item, -1)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateCartQty(item, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h4 style={{marginBottom: 8, marginTop: 0, color: 'var(--color-text-light)'}}>Choose an address</h4>
        {addresses.map(addr => (
          <div 
            key={addr.id} 
            className="address-card"
            onClick={() => navigate('checkout-summary', { address: addr })}
          >
            <div className="address-card-content">
              <div className="address-icon-box">
                <div className={`icon-circle ${addr.is_default ? 'default-active' : ''}`}>
                  <MapPin size={20} color={addr.is_default ? "#FFF" : "#333"} />
                </div>
              </div>
              <div className="address-info-box">
                <div className="address-header">
                  <h4 style={{margin:0}}>{addr.type}</h4>
                </div>
                <p className="address-details" style={{margin: '4px 0'}}>{stripAddressTags(addr.details)}</p>
                {addr.landmark && (
                  <div style={{ fontSize: '12px', color: '#0c831f', fontWeight: 600, margin: '2px 0' }}>
                    🚩 Landmark: {addr.landmark}
                  </div>
                )}
                {addr.family_head && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text)', fontWeight: 500, margin: '2px 0' }}>
                    🏠 House: {addr.family_head}
                  </div>
                )}
                <p className="address-phone" style={{margin: 0}}>Phone number: <strong>{addr.phone || '9651568829'}</strong>{addr.alt_phone ? ` (Alt: ${addr.alt_phone})` : ''}</p>
              </div>
            </div>
          </div>
        ))}
        <button 
          className="btn-primary" 
          onClick={() => navigate('saved-addresses', { from: 'checkout-address' })}
          style={{marginTop: 16, width: '100%', borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 700}}
        >
          + Add New Address
        </button>
      </div>
    </div>
  );
};
export default CheckoutAddressPage;
