import React, { useEffect, useState } from 'react';
import { Bell, MapPin, Package, Phone, ShoppingBag, X, AlertTriangle, ShieldAlert, VolumeX } from 'lucide-react';
import SlideToAccept from './SlideToAccept';
import { startSiren, stopSiren } from '../utils/siren';
import { supabase } from '../services/db';
import { auth } from '../services/auth';
import { isPointInPolygon, getZoneForLocation, calculateDistanceKm, calculatePolygonCenter } from '../utils/geoZones';
import './OrderIncomingModal.css';

export default function OrderIncomingModal({ role, onOrderAccepted }) {
  const [incomingOrder, setIncomingOrder] = useState(null);
  const [orderZone, setOrderZone] = useState(null);
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const zonesCacheRef = React.useRef({ zones: [], lastFetched: 0 });

  // Subscribe to realtime orders
  useEffect(() => {
    const checkUnclaimedOrders = async (latestPayload = null) => {
      // Check online status: if rider profile is offline, DO NOT trigger sound or modal alert!
      const isOnline = localStorage.getItem('partner_online') !== 'false';
      if (role === 'rider' && !isOnline) {
        setIncomingOrder(null);
        stopSiren();
        return;
      }

      // If a realtime INSERT or UPDATE event brought an order, prioritize that immediately!
      if (latestPayload && latestPayload.new) {
        const newOrder = latestPayload.new;
        if (role === 'shopkeeper' && ['Placed', 'Payment Pending'].includes(newOrder.status) && !newOrder.accepted_by_shopkeeper) {
          setIncomingOrder(newOrder);
          setIsMuted(false);
          return;
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

          // Fetch active delivery zones (cached for 30 seconds)
          let activeZones = zonesCacheRef.current.zones;
          const now = Date.now();
          if (now - zonesCacheRef.current.lastFetched > 30000) {
            try {
              const { data: sysData } = await supabase.from('profiles').select('address').eq('id', '00000000-0000-0000-0000-000000000001').limit(1);
              if (sysData && sysData[0]?.address) {
                const parsed = JSON.parse(sysData[0].address);
                activeZones = (parsed.delivery_zones || []).filter(z => z.is_active !== false);
                zonesCacheRef.current = { zones: activeZones, lastFetched: now };
              }
            } catch (_) {}
          }

          // Fetch currently online riders from rider_status
          let onlineRiders = [];
          try {
            const { data: statusList } = await supabase
              .from('rider_status')
              .select('rider_code, is_online, current_lat, current_lng, last_ping')
              .eq('is_online', true);
            onlineRiders = (statusList || []).filter(r => r.is_online);
          } catch (_) {}

          let candidateOrder = null;
          let matchedZoneForOrder = null;

          if (activeZones.length > 0 && nonPickupOrders.length > 0) {
            const riderCode = localStorage.getItem('zipit_sales_code') || localStorage.getItem('partner_code');
            const riderLat = Number(localStorage.getItem('rider_lat') || 0);
            const riderLng = Number(localStorage.getItem('rider_lng') || 0);
            const hasRiderLocation = !isNaN(riderLat) && !isNaN(riderLng) && (riderLat !== 0 || riderLng !== 0);

            for (const order of nonPickupOrders) {
              const oLat = Number(order.delivery_address?.lat);
              const oLng = Number(order.delivery_address?.lng);
              const matchedZone = (!isNaN(oLat) && !isNaN(oLng)) 
                ? getZoneForLocation(oLat, oLng, activeZones) 
                : (order.delivery_zone_id ? activeZones.find(z => z.id === order.delivery_zone_id) : null);

              if (matchedZone) {
                const assignedRidersList = Array.isArray(matchedZone.assigned_riders) ? matchedZone.assigned_riders : [];
                // Check if any assigned rider is online
                const onlineAssignedRiders = onlineRiders.filter(r => assignedRidersList.includes(r.rider_code));

                if (onlineAssignedRiders.length > 0) {
                  // Assigned riders ARE online: dispatch exclusively to assigned rider or rider physically inside zone
                  const isAssigned = assignedRidersList.includes(riderCode);
                  const isInside = hasRiderLocation && isPointInPolygon([riderLat, riderLng], matchedZone.polygon);

                  if (isAssigned || isInside) {
                    candidateOrder = order;
                    matchedZoneForOrder = matchedZone;
                    break;
                  }
                } else {
                  // NO assigned rider online in this zone! Alert nearest rider of the zone
                  const zoneCenter = calculatePolygonCenter(matchedZone.polygon);
                  const targetLat = (!isNaN(oLat) && oLat !== 0) ? oLat : zoneCenter[0];
                  const targetLng = (!isNaN(oLng) && oLng !== 0) ? oLng : zoneCenter[1];

                  let nearestRiderCode = null;
                  let minDistance = Infinity;

                  if (onlineRiders.length > 0) {
                    for (const r of onlineRiders) {
                      const rLat = Number(r.current_lat);
                      const rLng = Number(r.current_lng);
                      if (!isNaN(rLat) && !isNaN(rLng) && (rLat !== 0 || rLng !== 0)) {
                        const dist = calculateDistanceKm(targetLat, targetLng, rLat, rLng);
                        if (dist < minDistance) {
                          minDistance = dist;
                          nearestRiderCode = r.rider_code;
                        }
                      }
                    }
                  }

                  // If this rider is the nearest online rider to the zone:
                  if (!nearestRiderCode || nearestRiderCode === riderCode) {
                    candidateOrder = order;
                    matchedZoneForOrder = {
                      ...matchedZone,
                      isNearestFallback: true,
                      distanceToZoneKm: minDistance !== Infinity ? Math.round(minDistance * 10) / 10 : null
                    };
                    break;
                  }
                }
              }
            }

            // Fallback: if order remains unclaimed for > 3 mins, allow broadcast to prevent customer delays
            if (!candidateOrder && nonPickupOrders.length > 0) {
              const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
              const urgentOrder = nonPickupOrders.find(o => o.created_at <= threeMinsAgo);
              if (urgentOrder) {
                candidateOrder = urgentOrder;
                const uLat = Number(urgentOrder.delivery_address?.lat);
                const uLng = Number(urgentOrder.delivery_address?.lng);
                matchedZoneForOrder = (!isNaN(uLat) && !isNaN(uLng)) ? getZoneForLocation(uLat, uLng, activeZones) : null;
              }
            }
          } else {
            candidateOrder = nonPickupOrders.length > 0 ? nonPickupOrders[0] : null;
          }

          setOrderZone(matchedZoneForOrder);
          setIncomingOrder(candidateOrder);
        } else {
          setIncomingOrder(recentOrders.length > 0 ? recentOrders[0] : null);
        }
      } else {
        setIncomingOrder(null);
        setOrderZone(null);
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
          status: 'Preparing (Accepted)'
        };
      } else if (role === 'rider') {
        updatePayload = {
          accepted_by_rider: userCode,
          accepted_at: new Date().toISOString()
        };
      }

      let query = supabase.from('orders').update(updatePayload).eq('id', orderId);
      if (role === 'shopkeeper') {
        query = query.or(`accepted_by_shopkeeper.is.null,accepted_by_shopkeeper.eq.${userCode}`);
      } else if (role === 'rider') {
        query = query.or(`accepted_by_rider.is.null,accepted_by_rider.eq.${userCode}`);
      }

      const { data, error } = await query.select().maybeSingle();

      if (error) throw error;

      if (!data) {
        setClaimError(role === 'rider' ? 'Order was already claimed by another rider!' : 'Order was already accepted by another shopkeeper!');
        setTimeout(() => setIncomingOrder(null), 3000);
        setClaiming(false);
        return;
      }

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
            {orderZone && (
              <div style={{
                background: orderZone.isNearestFallback ? '#fef3c7' : `${orderZone.color || '#0c831f'}18`,
                color: orderZone.isNearestFallback ? '#b45309' : (orderZone.color || '#0c831f'),
                border: `1px solid ${orderZone.isNearestFallback ? '#fde68a' : `${orderZone.color || '#0c831f'}40`}`,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800'
              }}>
                {orderZone.isNearestFallback ? `⚡ Nearest Rider to ${orderZone.name}` : `📍 ${orderZone.name}`}
              </div>
            )}
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
