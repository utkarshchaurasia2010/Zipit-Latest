import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Clock, MapPin, ChevronRight, Tag, X, Check, Trash2, Package, Search, Share2, QrCode, Banknote, CheckCircle, FileText, ShoppingBag, ShoppingCart, Bike, Store, Sparkles } from 'lucide-react';
import { db } from '../services/db';
import { getCartDeliveryTime, getProductDeliveryTime } from '../utils/time';
import { triggerConfetti, triggerMoneyConfetti } from '../utils/confetti';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import './CheckoutPage.css';
import './ProductListPage.css'; // For the bestseller-card style

const CheckoutPage = ({ navigate, cart, updateCartQty, itemTotal, smallCartCharge, deliveryCharge, grandTotal, address, onAddressClick, appliedCoupon, setAppliedCoupon, discountAmount, clearCart }) => {
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [pickupPhone, setPickupPhone] = useState(address?.phone || '');
  const { showToast } = useToast();
  const { toggleWishlist } = useWishlist();

  useEffect(() => {
    // If address has phone, prefill pickup phone
    if (address?.phone) {
      setPickupPhone(address.phone);
    } else {
      // Attempt to load from profile
      db.user.get().then(p => {
        if (p?.phone) setPickupPhone(p.phone);
      }).catch(() => {});
    }
  }, [address]);

  useEffect(() => {
    const fetchSuggested = async () => {
      const allProducts = await db.products.getAll();
      const cartIds = cart.map(c => c.id);
      
      // Filter out products already in the cart
      const available = allProducts.filter(p => !cartIds.includes(p.id));
      
      // Shuffle array
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      
      // Select 10
      setSuggestedProducts(available.slice(0, 10));
    };
    
    fetchSuggested();
  }, [cart]);

  const [fulfillmentMode, setFulfillmentMode] = useState('delivery'); // 'delivery' | 'pickup'
  const isPickup = fulfillmentMode === 'pickup';

  // For pickup: delivery and handling charges are 0
  const effectiveDeliveryCharge = isPickup ? 0 : deliveryCharge;
  const effectiveSmallCartCharge = isPickup ? 0 : smallCartCharge;
  const effectiveGrandTotal = Math.max(0, itemTotal + effectiveDeliveryCharge + effectiveSmallCartCharge - (discountAmount || 0));

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  if (cart.length === 0) {
    return (
      <div className="checkout-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-background)' }}>
        <header className="checkout-header">
          <div className="checkout-header-left">
            <button className="back-btn" onClick={() => navigate('/')}>
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <h1>Your Cart</h1>
          </div>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)' }}>
          <ShoppingCart size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Your cart is empty.</p>
          <button onClick={() => navigate('/')} style={{ marginTop: '24px', padding: '14px 32px', backgroundColor: 'var(--color-text)', color: 'var(--color-background)', border: 'none', borderRadius: '24px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplying(true);
    setCouponError('');

    try {
      const coupon = await db.coupons.getByCode(couponCode);
      if (!coupon) {
        setCouponError('Invalid coupon code');
      } else if (!coupon.is_active) {
        setCouponError('This coupon is no longer active');
      } else if (itemTotal < coupon.min_order_amount) {
        setCouponError(`Minimum order amount of ₹${coupon.min_order_amount} required`);
      } else {
        setAppliedCoupon(coupon);
        setCouponCode('');
        triggerMoneyConfetti();
        setIsCouponModalOpen(false);
      }
    } catch (err) {
      setCouponError('Error applying coupon');
    }
    setIsApplying(false);
  };
  
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  const handlePlaceOrder = async () => {
    if (!isPickup && !address) {
      showToast('Please select a delivery address', 'Address Required');
      return;
    }

    setProcessing(true);
    try {
      // 1. Automatically fetch customer profile for contact phone number
      let customerPhone = (address?.phone || pickupPhone || '').trim();
      if (!customerPhone) {
        try {
          const userProf = await db.user.get();
          if (userProf?.phone) customerPhone = userProf.phone.trim();
        } catch (_) {}
      }

      if (selectedPayment === 'UPI') {
        // Option to trigger intent if needed, otherwise just assume flow
        window.location.href = `upi://pay?pa=9651568829@upi&pn=Zipit%20Store&am=${effectiveGrandTotal}&cu=INR&tn=Order%20Payment`;
        // We'll pause briefly to let intent fire
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Compute ready pickup time (~1 hour later)
      const pickupTimeObj = new Date(Date.now() + 60 * 60 * 1000);
      const formattedPickupTime = pickupTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const finalAddress = isPickup ? {
        is_pickup: true,
        order_type: 'PICKUP',
        type: 'STORE PICKUP',
        details: `Store Pickup at Zipit Hub, Rauza (Ready around ${formattedPickupTime})`,
        store_location: 'Zipit Hub & Store, Main Market, Rauza',
        pickup_time_estimate: `Ready around ${formattedPickupTime} (~1 hr)`,
        phone: customerPhone
      } : {
        ...address,
        is_pickup: false,
        order_type: 'DELIVERY'
      };

      await db.orders.add({
        items: cart,
        total: effectiveGrandTotal,
        deliveryCharge: effectiveDeliveryCharge,
        smallCartCharge: effectiveSmallCartCharge,
        address: finalAddress,
        status: 'Preparing',
        paymentMethod: selectedPayment,
        discountAmount: discountAmount || 0,
        couponCode: appliedCoupon ? appliedCoupon.code : null
      });
      triggerConfetti();
      clearCart();
      await db.carts.clear();
      if (setAppliedCoupon) setAppliedCoupon(null);
      showToast(
        isPickup 
          ? `Store Pickup Order Placed! Ready around ${formattedPickupTime}.` 
          : `Order Placed successfully via ${selectedPayment}!`, 
        isPickup ? 'Store Pickup Confirmed 🛍️' : 'Order Placed 🎉'
      );
      navigate('/track');
    } catch (e) {
      console.error(e);
      showToast('Something went wrong. Please try again.', 'Order Failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <div className="checkout-header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1>Checkout</h1>
        </div>
        <div className="checkout-header-right">
          <button className="share-btn">
            <Share2 size={16} /> Share
          </button>
        </div>
      </header>

      {/* FULFILLMENT MODE SELECTOR (HOME DELIVERY VS STORE PICKUP) */}
      <section className="checkout-section fulfillment-selector-section">
        <div className="fulfillment-section-header">
          <span className="fulfillment-section-label">SELECT FULFILLMENT OPTION</span>
          <span className="fulfillment-guarantee-pill">
            <Sparkles size={11} /> 100% Fresh & Safe
          </span>
        </div>

        <div className="fulfillment-cards-grid">
          {/* Home Delivery Card */}
          <div 
            className={`fulfillment-card ${!isPickup ? 'selected' : ''}`}
            onClick={() => setFulfillmentMode('delivery')}
            role="button"
            tabIndex={0}
          >
            <div className="fulfillment-card-top">
              <div className="fulfillment-icon-bubble delivery">
                <Bike size={20} strokeWidth={2.4} />
              </div>
              <div className="fulfillment-radio-dot">
                <div className="radio-inner" />
              </div>
            </div>

            <div className="fulfillment-card-body">
              <h3 className="fulfillment-card-title">Home Delivery</h3>
              <p className="fulfillment-card-desc">At your doorstep in {getCartDeliveryTime(cart)} mins</p>
            </div>

            <div className="fulfillment-card-footer">
              <span className="card-badge regular">
                {appliedCoupon?.discount_type === 'FREE_DELIVERY' || deliveryCharge === 0 ? 'FREE DELIVERY' : `₹${deliveryCharge} delivery`}
              </span>
            </div>
          </div>

          {/* Store Pickup Card */}
          <div 
            className={`fulfillment-card ${isPickup ? 'selected' : ''}`}
            onClick={() => setFulfillmentMode('pickup')}
            role="button"
            tabIndex={0}
          >
            <div className="fulfillment-card-top">
              <div className="fulfillment-icon-bubble pickup">
                <Store size={20} strokeWidth={2.4} />
              </div>
              <div className="fulfillment-radio-dot">
                <div className="radio-inner" />
              </div>
            </div>

            <div className="fulfillment-card-body">
              <h3 className="fulfillment-card-title">Store Pickup</h3>
              <p className="fulfillment-card-desc">Pack & ready in ~1 hr at Rauza hub</p>
            </div>

            <div className="fulfillment-card-footer">
              <span className="card-badge savings">
                SAVE ₹{(deliveryCharge || 0) + (smallCartCharge || 0)} • FREE
              </span>
            </div>
          </div>
        </div>

        {isPickup && (
          <div className="pickup-notice-banner">
            <div className="pickup-notice-icon">
              <Store size={18} color="#15803d" />
            </div>
            <div className="pickup-notice-text" style={{ width: '100%' }}>
              <div className="pickup-notice-title-row">
                <strong>Zipit Store & Hub, Rauza</strong>
                <span className="pickup-ready-pill">Ready in ~1 hr</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#166534', margin: '4px 0 0 0' }}>
                Skip the queue! Your order will be packed and waiting for you on the pickup counter with zero delivery or handling fees.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* COMBINED DELIVERY / PICKUP TIME & ORDERED ITEMS CARD */}
      <section className="checkout-section delivery-time-card">
        <div className="delivery-time-header">
          <div className="delivery-time-icon">
            <Clock size={20} />
          </div>
          <div className="delivery-time-info">
            <h2>{isPickup ? 'Ready for Pickup in ~1 hour' : `Delivery in ${getCartDeliveryTime(cart)} minutes`}</h2>
            <p>{isPickup ? `Store pickup at Zipit Hub • ${totalItems} item${totalItems > 1 ? 's' : ''}` : `Shipment of ${totalItems} item${totalItems > 1 ? 's' : ''}`}</p>
          </div>
        </div>

        {/* Product Details List inside the Card */}
        <div className="checkout-cart-list">
          {cart.map(item => (
            <div key={item.id} className="checkout-cart-item">
              <div className="checkout-item-img">
                {item.sticker && <div className="wafer-sticker" style={{fontSize: '7px', padding: '2px 4px'}}>{item.sticker}</div>}
                <img src={item.image_url} alt={item.name} />
              </div>
              <div className="checkout-item-info">
                <h3 className="checkout-item-name">{item.name}</h3>
                <div className="checkout-item-amount">{item.amount || '1 pack'}</div>
                <div 
                  className="move-to-wishlist"
                  onClick={() => {
                    toggleWishlist(item.id);
                    updateCartQty(item, -item.qty);
                    showToast(`${item.name} moved to wishlist`, 'Moved');
                  }}
                  style={{cursor: 'pointer'}}
                >
                  Move to wishlist
                </div>
              </div>
              <div className="checkout-item-actions">
                <div className="checkout-qty-control">
                  <button onClick={() => updateCartQty(item, -1)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateCartQty(item, 1)}>+</button>
                </div>
                <div className="checkout-item-price-stack">
                  {item.price * 1.2 && (
                    <span className="price-old">₹{Math.round(item.price * 1.2)}</span>
                  )}
                  <span className="price-new">₹{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMBINED OFFERS & FREE DELIVERY CARD */}
      <section className="checkout-section offers-card-modern">
        <div className={`offers-delivery-block ${itemTotal >= 149 || appliedCoupon?.discount_type === 'FREE_DELIVERY' ? 'unlocked' : 'locked'}`}>
          <div className="offers-delivery-content">
            <div className="offers-scooter-icon">
               <Package size={20} color="#1d4ed8" />
            </div>
            <div className="offers-delivery-text">
              <h4>{appliedCoupon?.discount_type === 'FREE_DELIVERY' ? 'Free delivery applied' : (itemTotal >= 149 ? 'FREE delivery Unlocked' : 'Get FREE delivery')}</h4>
              <p>{itemTotal >= 149 || appliedCoupon?.discount_type === 'FREE_DELIVERY' ? 'No delivery charges on this order' : `Add products worth ₹${149 - itemTotal} more`} <ChevronRight size={12} /></p>
            </div>
          </div>
          <div className="offers-delivery-track">
            <div className="offers-delivery-progress" style={{ width: `${appliedCoupon?.discount_type === 'FREE_DELIVERY' ? 100 : Math.min(100, (itemTotal / 149) * 100)}%` }} />
          </div>
        </div>
        <div className="offers-coupon-block" onClick={() => setIsCouponModalOpen(true)}>
          {appliedCoupon ? (
            <div className="offers-coupon-applied">
              <span className="offers-coupon-success"><CheckCircle size={14}/> 1 Coupon applied</span>
              <span className="offers-coupon-saved">-₹{Math.round(discountAmount)} <ChevronRight size={16} /></span>
            </div>
          ) : (
            <div className="offers-coupon-unapplied">
              See all coupons <ChevronRight size={16} />
            </div>
          )}
        </div>
      </section>

      {suggestedProducts.length > 0 && (
        <section className="checkout-section suggested-section">
          <h2>You might also like</h2>
          <div className="pinnacle-grid">
            {suggestedProducts.slice(0, 6).map(prod => {
              const qty = cart.find(c => c.id === prod.id)?.qty || 0;
              return (
                <div key={prod.id} className="bestseller-card">
                  <div className="bestseller-img-wrapper">
                    <div className="bestseller-img" style={{cursor: 'pointer'}} onClick={() => navigate(`/category/${prod.category_id}`)}>
                      {prod.sticker && <div className="wafer-sticker">{prod.sticker}</div>}
                      <img src={prod.image_url} alt={prod.name} />
                    </div>
                    <div className="img-footer-row" onClick={(e) => e.stopPropagation()}>
                      <span className="item-amount-text">{prod.amount}</span>
                      {qty === 0 ? (
                        <button className="add-btn-small" onClick={() => updateCartQty(prod, 1)}>ADD</button>
                      ) : (
                        <div className="qty-control">
                          <button onClick={() => updateCartQty(prod, -1)}>-</button>
                          <span>{qty}</span>
                          <button onClick={() => updateCartQty(prod, 1)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bestseller-info">
                    <div className="item-price">
                      {prod.is_wafer ? (
                        <span className="wafer-price-tag">₹{prod.price}</span>
                      ) : (
                        <>₹{prod.price}</>
                      )}
                    </div>
                    <h3 className="item-name">{prod.name}</h3>
                    <div className="time-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> {getProductDeliveryTime(prod.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* NEW BILL DETAILS SECTION */}
      <section className="checkout-section bill-details-modern">
        <h2>Bill details</h2>
        
        <div className="bill-row-modern">
          <div className="bill-label-modern">
            <FileText size={16} color="var(--color-text-light)" />
            <span>Items total</span>
            {discountAmount > 0 && <span className="bill-saved-pill">Saved ₹{Math.round(discountAmount)}</span>}
          </div>
          <div className="bill-value-modern">
            {discountAmount > 0 && <span className="bill-strikethrough">₹{itemTotal + Math.round(discountAmount)}</span>}
            ₹{itemTotal}
          </div>
        </div>

        {/* Handling charge: 0 if pickup */}
        {isPickup ? (
          <div className="bill-row-modern">
            <div className="bill-label-modern">
              <ShoppingBag size={16} color="var(--color-text-light)" />
              <span className="dotted-underline">Handling charge</span>
            </div>
            <div className="bill-value-modern">
              <span style={{ color: '#15803d', fontWeight: 800 }}>FREE (Store Pickup)</span>
            </div>
          </div>
        ) : smallCartCharge > 0 ? (
          <div className="bill-row-modern">
            <div className="bill-label-modern">
              <ShoppingBag size={16} color="var(--color-text-light)" />
              <span className="dotted-underline">Handling charge</span>
            </div>
            <div className="bill-value-modern">
              ₹{smallCartCharge}
            </div>
          </div>
        ) : null}

        <div className="bill-row-modern delivery-charge-row">
          <div className="bill-label-modern">
            <Package size={16} color="var(--color-text-light)" />
            <span className="dotted-underline">Delivery charge</span>
          </div>
          <div className="bill-value-modern">
            {isPickup ? (
              <span style={{ color: '#15803d', fontWeight: 800 }}>FREE (Store Pickup)</span>
            ) : appliedCoupon?.discount_type === 'FREE_DELIVERY' && deliveryCharge > 0 ? (
              <>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-light)', marginRight: '6px', fontSize: '12px' }}>₹{deliveryCharge}</span>
                <span style={{ color: '#15803d', fontWeight: 800 }}>FREE</span>
              </>
            ) : deliveryCharge === 0 ? (
              <span style={{ color: '#15803d', fontWeight: 800 }}>FREE</span>
            ) : (
              `₹${deliveryCharge}`
            )}
          </div>
        </div>
        {!isPickup && (itemTotal < 149 && appliedCoupon?.discount_type !== 'FREE_DELIVERY') && (
          <div className="bill-subtext-orange">
            Shop for ₹{149 - itemTotal} more to get FREE delivery
          </div>
        )}

        <div className="bill-divider" />

        <div className="bill-row-modern grand-total-row">
          <div className="bill-label-modern">
            <span className="dotted-underline">Grand total</span>
          </div>
          <div className="bill-value-modern">
            ₹{effectiveGrandTotal}
          </div>
        </div>
      </section>

      {/* Floating Bottom Bar using Portal */}
      {createPortal(
        <div className="checkout-bottom-bar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'var(--color-surface)' }}>
          {/* Address Banner Above the Buttons */}
          <div className="checkout-address-area" onClick={!isPickup ? onAddressClick : undefined} style={{ cursor: isPickup ? 'default' : 'pointer' }}>
            <div className="address-icon-bg">
              <MapPin size={14} />
            </div>
            <div className="checkout-address-text">
              <h3 className="checkout-address-title">
                {isPickup ? (
                  <span>Pickup from: <strong>Zipit Store, Rauza (~1 hr)</strong></span>
                ) : (
                  <>
                    <span>Delivering to <strong>{address ? (address.type || 'Rauza') : 'Rauza'}</strong></span>
                    <span className="address-change-btn">Change</span>
                  </>
                )}
              </h3>
            </div>
          </div>

          {/* Action Row */}
          <div className="checkout-action-row">
            <div className="pay-using-block" onClick={() => setIsPaymentSheetOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="pay-using-label">
                <div className="bhim-logo" style={{ padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedPayment === 'UPI' ? <QrCode size={12} color="#000" strokeWidth={2.5} /> : <Banknote size={12} color="#000" strokeWidth={2.5} />}
                </div>
                PAY USING <ChevronRight size={12} />
              </div>
              <div className="pay-using-value">{selectedPayment}</div>
            </div>
            
            <button className="checkout-place-order-btn" onClick={handlePlaceOrder} disabled={processing}>
              <div className="btn-price-col">
                <span className="btn-total">₹{effectiveGrandTotal}</span>
                <span className="btn-sub">TOTAL</span>
              </div>
              <div className="btn-action-col">
                {processing ? 'Processing...' : isPickup ? 'Place Pickup Order' : 'Place Order'} <ChevronRight size={20} strokeWidth={3} />
              </div>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Payment Selection Bottom Sheet */}
      {isPaymentSheetOpen && createPortal(
        <div className="payment-sheet-overlay" onClick={() => setIsPaymentSheetOpen(false)}>
          <div className="payment-sheet-content" onClick={e => e.stopPropagation()}>
            <div className="payment-sheet-header">
              <h3>Select Payment Method</h3>
              <button onClick={() => setIsPaymentSheetOpen(false)}><X size={20} /></button>
            </div>
            <div className="payment-options-list">
              {['UPI', 'Cash on Delivery'].map(method => (
                <div 
                  key={method} 
                  className={`payment-option-item ${selectedPayment === method ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPayment(method);
                    setIsPaymentSheetOpen(false);
                  }}
                >
                  <div className="payment-option-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {method === 'UPI' ? <QrCode size={18} color="var(--color-text-light)" /> : <Banknote size={18} color="var(--color-text-light)" />}
                    {method}
                  </div>
                  {selectedPayment === method && <Check size={18} color="#0c831f" />}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Full Page Coupon Modal */}
      {isCouponModalOpen && createPortal(
        <div className="coupon-modal-full" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-surface)', zIndex: 2000, overflow: 'auto' }}>
          <header className="checkout-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <div className="checkout-header-left">
              <button className="back-btn" onClick={() => setIsCouponModalOpen(false)}>
                <ChevronLeft size={24} strokeWidth={2.5} />
              </button>
              <h1>Apply Coupon</h1>
            </div>
          </header>
          
          <div className="coupon-modal-body" style={{ padding: '24px 16px' }}>
            <div className="coupon-input-wrapper">
              <div className="coupon-input-group">
                <input 
                  type="text" 
                  className="coupon-input"
                  placeholder="Enter coupon code" 
                  value={couponCode}
                  onChange={e => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError('');
                  }}
                  autoFocus
                />
                <button 
                  className={`coupon-apply-btn ${couponCode.trim() && !isApplying ? 'active' : ''}`}
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || isApplying}
                >
                  {isApplying ? '...' : 'APPLY'}
                </button>
              </div>
              {couponError && (
                <div className="coupon-error-text" style={{ marginTop: '8px', color: '#ef4444', fontSize: '13px' }}>
                  {couponError}
                </div>
              )}
            </div>

            {appliedCoupon && (
              <div className="coupon-applied-box" style={{ marginTop: '24px' }}>
                <div className="coupon-applied-info">
                  <div className="coupon-code-badge">
                    {appliedCoupon.code} <Check size={14} />
                  </div>
                  <div className="coupon-saved-text">
                    You saved ₹{Math.round(discountAmount)}
                  </div>
                </div>
                <button onClick={handleRemoveCoupon} className="coupon-remove-btn">
                  REMOVE
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CheckoutPage;
