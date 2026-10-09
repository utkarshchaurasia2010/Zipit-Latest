import React, { useEffect, useState } from 'react';
import { Bell, MapPin, Package, Phone, ShoppingBag, X, AlertTriangle, ShieldAlert, VolumeX } from 'lucide-react';
import SlideToAccept from './SlideToAccept';
import { startSiren, stopSiren } from '../utils/siren';
import { supabase } from '../services/db';
import { auth } from '../services/auth';
import './OrderIncomingModal.css';

export default function OrderIncomingModal({ role, onOrderAccepted }) {
  const [incomingOrder, setIncomingOrder] = useState(null);
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Subscribe to realtime orders
  useEffect(() => {
    const checkUnclaimedOrders = async (latestPayload = null) => {
      // If a realtime INSERT or UPDATE event brought an order, prioritize that immediately!
      if (latestPayload && latestPayload.new) {
        const newOrder = latestPayload.new;
        if (role === 'shopkeeper' && ['Placed', 'Payment Pending'].includes(newOrder.status) && !newOrder.accepted_by_shopkeeper) {
          setIncomingOrder(newOrder);
          setIsMuted(false);
          return;
        }
        if (role === 'rider' && !newOrder.accepted_by_rider) {
          const isPreparingOrReady = ['Preparing', 'Preparing (Accepted)', 'Ready for Pickup'].includes(newOrder.status);
          const isStorePickup = newOrder.delivery_type === 'STORE_PICKUP' || newOrder.order_type === 'STORE_PICKUP' || newOrder.delivery_address?.is_pickup === true || newOrder.delivery_address?.order_type === 'PICKUP';
          if (isPreparingOrReady && !isStorePickup) {
            setIncomingOrder(newOrder);
            setIsMuted(false);
            return;
          }
        }
      }

      let query = supabase.from('orders').select('*, profiles(name, phone)');
      if (role === 'shopkeeper') {
        // Unclaimed shopkeeper orders (status = Placed or Payment Pending, accepted_by_shopkeeper is null)
        query = query.in('status', ['Placed', 'Payment Pending']).is('accepted_by_shopkeeper', null);
      } else if (role === 'rider') {
        // Rider gets alerted when shopkeeper marks order as Preparing / Ready for Pickup
        query = query.in('status', ['Preparing', 'Preparing (Accepted)', 'Ready for Pickup']).is('accepted_by_rider', null);
      }

      const { data } = await query.order('created_at', { ascending: false }).limit(5);
      if (data && data.length > 0) {
        // Only trigger alert for orders created in the last 60 minutes
        const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentOrders = data.filter(o => o.created_at >= sixtyMinsAgo);

        if (role === 'rider') {
          // RIDER: EXCLUDE store pickup orders completely!
          const nonPickupOrders = recentOrders.filter(o => {
            const isStorePickup = o.delivery_type === 'STORE_PICKUP' || o.order_type === 'STORE_PICKUP' || o.delivery_address?.is_pickup === true || o.delivery_address?.order_type === 'PICKUP';
            return !isStorePickup;
          });
          setIncomingOrder(nonPickupOrders.length > 0 ? nonPickupOrders[0] : null);
        } else {
          setIncomingOrder(recentOrders.length > 0 ? recentOrders[0] : null);
        }
      } else {
        setIncomingOrder(null);
      }
    };

    checkUnclaimedOrders();

    const channel = supabase
      .channel(`incoming-orders-${role}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        checkUnclaimedOrders(payload);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        checkUnclaimedOrders(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopSiren();
    };
  }, [role]);

  // Handle siren playing while modal is active
  useEffect(() => {
    if (incomingOrder && !isMuted) {
      startSiren();
    } else {
      stopSiren();
    }
    return () => stopSiren();
  }, [incomingOrder, isMuted]);

  if (!incomingOrder) return null;

  const handleMuteToggle = () => {
    setIsMuted(true);
    stopSiren();
  };

  const handleAccept = async () => {
    setClaiming(true);
    setClaimError('');
    stopSiren();

    const userCode = auth.getCode() || 'USER';
    const orderId = incomingOrder.id;

    try {
      let updatePayload = {};

      if (role === 'shopkeeper') {
        updatePayload = {
          accepted_by_shopkeeper: userCode,
          status: 'Preparing'
        };
        // Verify it was not already claimed
        const { data: checkData } = await supabase.from('orders').select('accepted_by_shopkeeper').eq('id', orderId).single();
        if (checkData?.accepted_by_shopkeeper && checkData.accepted_by_shopkeeper !== userCode) {
          setClaimError('Notice: Order was already accepted by another shopkeeper.');
          setTimeout(() => setIncomingOrder(null), 3000);
          setClaiming(false);
          return;
        }
      } else if (role === 'rider') {
        updatePayload = {
          accepted_by_rider: userCode
        };
        // Verify it was not already claimed
        const { data: checkData } = await supabase.from('orders').select('accepted_by_rider').eq('id', orderId).single();
        if (checkData?.accepted_by_rider && checkData.accepted_by_rider !== userCode) {
          setClaimError('Notice: Order was already claimed by another rider.');
          setTimeout(() => setIncomingOrder(null), 3000);
          setClaiming(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      if (onOrderAccepted) onOrderAccepted(data);
      setIncomingOrder(null);
    } catch (err) {
      console.error('Claim order error:', err);
      setClaimError(err.message || 'Failed to claim order');
    } finally {
      setClaiming(false);
    }
  };

  const cleanAddress = (addr) => {
    if (!addr) return 'Customer Address';
    if (typeof addr === 'string') return addr.split('\n---TAG:')[0];
    return addr.details?.split('\n---TAG:')[0] || addr.address || 'Customer Address';
  };

  const itemsList = Array.isArray(incomingOrder.items) ? incomingOrder.items : [];

  return (
    <div className="order-incoming-overlay">
      <div className="order-incoming-modal">
        {/* Animated Pulsing Header */}
        <div className="incoming-header">
          <div className="bell-ring-icon">
            <Bell size={32} color="#ffffff" className="ring-pulse" />
          </div>
          <div style={{ flex: 1 }}>
            <h2>NEW ORDER RECEIVED!</h2>
            <p className="incoming-sub">
              {role === 'shopkeeper' ? 'First Shopkeeper to slide gets this order' : 'First Rider to slide gets this delivery'}
            </p>
          </div>
          <button onClick={handleMuteToggle} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <VolumeX size={16} /> Mute
          </button>
        </div>

        {/* Claim Error Alert */}
        {claimError && (
          <div className="claim-error-banner">
            <ShieldAlert size={20} />
            <span>{claimError}</span>
          </div>
        )}

        {/* Order Info Body */}
        <div className="incoming-body">
          <div className="incoming-row-top">
            <div className="order-id-badge">
              Order #{incomingOrder.id.slice(0, 6).toUpperCase()}
            </div>
            {(incomingOrder.delivery_address?.is_pickup || incomingOrder.delivery_address?.order_type === 'PICKUP') && (
              <div style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                Store Pickup
              </div>
            )}
            <div className="order-amount-badge">
              ₹{incomingOrder.total}
            </div>
          </div>

          {/* Customer Address & Phone */}
          <div className="incoming-info-box">
            <div className="info-box-item">
              <MapPin size={18} className="info-icon" />
              <div>
                <span className="info-label">Delivery Location</span>
                <p className="info-val">{cleanAddress(incomingOrder.delivery_address)}</p>
              </div>
            </div>
            {incomingOrder.profiles?.phone && (
              <div className="info-box-item">
                <Phone size={18} className="info-icon" />
                <div>
                  <span className="info-label">Customer Contact</span>
                  <p className="info-val">{incomingOrder.profiles.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Products Summary List */}
          <div className="incoming-products-section">
            <div className="section-title">
              <Package size={16} /> Products ({itemsList.length} items)
            </div>
            <div className="products-scroll-list">
              {itemsList.map((item, idx) => (
                <div key={idx} className="product-item-chip">
                  {item.image_url && <img src={item.image_url} alt={item.name} className="product-thumb" />}
                  <div className="product-details">
                    <span className="product-name">{item.name}</span>
                    <span className="product-qty">Qty: {item.quantity || 1} × ₹{item.price}</span>
                  </div>
                  <span className="product-total">₹{(item.quantity || 1) * item.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slider Action Footer */}
        <div className="incoming-footer">
          <SlideToAccept
            onAccept={handleAccept}
            label={role === 'shopkeeper' ? 'Slide to Accept Order' : 'Slide to Claim Delivery'}
            disabled={claiming}
          />
        </div>
      </div>
    </div>
  );
}
