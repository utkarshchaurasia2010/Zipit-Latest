import React, { useState, useEffect, useRef } from 'react';
import { PackageCheck, ShoppingBag, X, Check, AlertCircle, MapPin, Navigation, ChevronLeft, RefreshCw, ArrowRight, Phone, ShieldCheck, Package, Store, Clock, CheckCircle2 } from 'lucide-react';
import { db, supabase } from '../services/db';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { playBellSound } from '../utils/siren';
import './TrackOrderPage.css';

// Error boundary so a Leaflet crash never blanks the whole page
class MapErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: 'var(--color-surface-muted, #f1f5f9)', borderRadius: 12, padding: '16px', textAlign: 'center', color: 'var(--color-text-light)', fontSize: 13, margin: '8px 0' }}>
          Map unavailable — <strong>tracking your order</strong> is still active.
        </div>
      );
    }
    return this.props.children;
  }
}

// Custom crisp SVG Map Markers
const createSvgIcon = (svgContent, width = 36, height = 36) => {
  return new L.DivIcon({
    className: 'custom-map-icon',
    html: `<div style="width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25)); display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">${svgContent}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2]
  });
};

const storeIcon = createSvgIcon(`
  <div style="background: #0c831f; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
  </div>
`, 34, 34);

const destIcon = createSvgIcon(`
  <div style="background: #ef4444; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
`, 36, 36);

const driverIcon = createSvgIcon(`
  <div style="background: #2563eb; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6); animation: pulse-ring 2s infinite;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
  </div>
`, 38, 38);

// Auto-fit route bounds component
const MapBoundsFitter = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [map, JSON.stringify(positions)]);
  return null;
};

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
};

const DeliveryMap = ({ status, order }) => {
  const isOnTheWay = status === 'Out for Delivery';
  const isDelivered = status === 'Delivered';

  const storeLocation = [25.5788, 83.5780];
  const destLocation = [
    Number(order.delivery_address?.lat) || 25.5900, 
    Number(order.delivery_address?.lng) || 83.5850
  ];
  
  // Midpoint with curve for aesthetic polyline
  const midPoint = [
    (storeLocation[0] + destLocation[0]) / 2 + 0.0018,
    (storeLocation[1] + destLocation[1]) / 2 - 0.0018
  ];
  
  const routePositions = [storeLocation, midPoint, destLocation];
  const [animatedPos, setAnimatedPos] = useState(storeLocation);

  useEffect(() => {
    if (!isOnTheWay) {
      setAnimatedPos(storeLocation);
      return;
    }
    
    if (order.delivery_lat && order.delivery_lng) {
      setAnimatedPos([Number(order.delivery_lat), Number(order.delivery_lng)]);
      return; // use real GPS from delivery partner
    }
    
    let startTime = Date.now();
    const duration = 16000; // 16 seconds loop
    let animationFrame;
    
    const getBezierPoint = (t, p0, p1, p2) => {
      const u = 1 - t;
      return [
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
      ];
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      let progress = elapsed / duration;
      
      if (progress > 1) {
        startTime = Date.now();
        progress = 0;
      }
      
      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const newPos = getBezierPoint(easeProgress, storeLocation, midPoint, destLocation);
      setAnimatedPos(newPos);
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isOnTheWay, storeLocation[0], storeLocation[1], destLocation[0], destLocation[1]]);

  return (
    <div className="delivery-map-wrapper" style={{ height: '230px', position: 'relative', overflow: 'hidden', borderRadius: '16px', marginTop: '14px', zIndex: 0, border: '1px solid var(--color-border, #e2e8f0)' }}>
      <MapContainer center={storeLocation} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <TileLayer 
          url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
          subdomains={['0', '1', '2', '3']}
          maxZoom={20} 
        />
        
        {/* Route Line */}
        <Polyline positions={routePositions} color="#0c831f" weight={5} opacity={0.8} dashArray="6, 8" />
        
        <Marker position={storeLocation} icon={storeIcon} />
        <Marker position={destLocation} icon={destIcon} />
        
        {(isOnTheWay || status === 'Preparing') && (
          <Marker position={animatedPos} icon={driverIcon} />
        )}
        
        <MapBoundsFitter positions={routePositions} />
        <MapUpdater center={isOnTheWay ? animatedPos : null} />
      </MapContainer>

      {/* Floating Status Badge */}
      <div className="map-eta-badge" style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '8px 18px', borderRadius: '30px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: '13px', fontWeight: '700', color: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isDelivered ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} color="#15803d" /> Order Delivered</span>
        ) : isOnTheWay ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.5s infinite' }}></span>
            <span>{order.delivery_lat ? 'Live Rider Location' : 'Rider is on the way · ~8 mins'}</span>
          </>
        ) : status === 'Ready for Pickup' ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }}></span>
            <span>Items packed · Rider picking up package</span>
          </>
        ) : (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0c831f', animation: 'pulse 1.5s infinite' }}></span>
            <span>Store is packing your items</span>
          </>
        )}
      </div>
    </div>
  );
};

/* ───────── Main Page ───────── */
const ACTIVE_STATUSES = [
  'Payment Pending',
  'Preparing',
  'Preparing (Accepted)',
  'Ready for Pickup',
  'Out for Delivery',
  'Cancellation Requested',
  'Cancellation Rejected',
  'Refund Requested'
];

const TrackOrderPage = ({ navigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubstituteModalOrder, setActiveSubstituteModalOrder] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({});
  const [catalogPickerItemIndex, setCatalogPickerItemIndex] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [isSubmittingSubstitute, setIsSubmittingSubstitute] = useState(false);

  const fetchOrders = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const data = await db.orders.getAll();
    const active = (data || []).filter(o => ACTIVE_STATUSES.includes(o.status));
    
    // Ensure every active home delivery order has a 4-digit PIN
    for (const ord of active) {
      const isPickup = ord.delivery_address?.is_pickup || ord.delivery_address?.order_type === 'PICKUP';
      if (!isPickup && !ord.delivery_otp && ord.status !== 'Delivered' && ord.status !== 'Cancelled') {
        const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
        ord.delivery_otp = generatedPin;
        supabase.from('orders').update({ delivery_otp: generatedPin }).eq('id', ord.id).then();
      }
    }

    setOrders(active);
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    fetchOrders(false);

    const channel = supabase
      .channel(`track-orders-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        playBellSound();
        fetchOrders(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        playBellSound();
        fetchOrders(true);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => fetchOrders(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openSubstituteModal = async (order) => {
    try {
      const products = await db.products.getAll();
      const categories = await db.categories.getAll();
      setAvailableProducts(products || []);
      setAvailableCategories(categories || []);
      
      const initialChoices = {};
      (order.items || []).forEach((item, index) => {
        if (item.is_unavailable) {
          initialChoices[index] = { action: 'refund' };
        }
      });
      setSelectedSubstitutes(initialChoices);
      setActiveSubstituteModalOrder(order);
      setCatalogPickerItemIndex(null);
      setSelectedCategoryFilter('all');
    } catch (e) {
      console.error('Error opening substitute modal:', e);
    }
  };

  const handleConfirmSubstitutions = async () => {
    if (!activeSubstituteModalOrder) return;
    setIsSubmittingSubstitute(true);

    try {
      const currentItems = [...activeSubstituteModalOrder.items];
      let newTotal = activeSubstituteModalOrder.total || 0;

      const finalItems = currentItems.map((item, idx) => {
        if (!item.is_unavailable) return item;
        const choice = selectedSubstitutes[idx];

        if (!choice || choice.action === 'refund') {
          newTotal = Math.max(0, newTotal - (item.price * item.qty));
          return { ...item, status: 'REFUNDED_SUBSTITUTE', is_unavailable: true };
        } else if (choice.action === 'replace' && choice.replacementProduct) {
          const priceDiff = (choice.replacementProduct.price - item.price) * item.qty;
          newTotal += priceDiff;
          return {
            id: choice.replacementProduct.id,
            name: `${choice.replacementProduct.name} (Substituted for ${item.name})`,
            original_item_name: item.name,
            original_item_price: item.price,
            price: choice.replacementProduct.price,
            qty: item.qty,
            image_url: choice.replacementProduct.image_url,
            is_substituted: true,
            is_unavailable: false
          };
        }
        return item;
      });

      await supabase.from('orders').update({
        items: finalItems,
        total: Math.round(newTotal),
        substitution_status: 'RESOLVED'
      }).eq('id', activeSubstituteModalOrder.id);

      setActiveSubstituteModalOrder(null);
      setCatalogPickerItemIndex(null);
      await fetchOrders();
    } catch (err) {
      console.error('Failed to save substitutions:', err);
    } finally {
      setIsSubmittingSubstitute(false);
    }
  };

  const handleCancelRequest = async (orderId) => {
    await db.orders.updateStatus(orderId, 'Cancellation Requested');
    await fetchOrders();
  };

  const getStatusColor = (status) => {
    if (status === 'Cancellation Requested' || status === 'Refund Requested') return '#dc2626';
    if (status === 'Cancellation Rejected') return '#d97706';
    if (status === 'Refunded' || status === 'Cancelled') return '#64748b';
    if (status === 'Out for Delivery') return '#2563eb';
    return '#0c831f';
  };

  const getTimelineSteps = (status, order = null) => {
    const isPickup = order?.delivery_address?.is_pickup || order?.delivery_address?.order_type === 'PICKUP';

    if (status === 'Refund Requested' || status === 'Refunded') {
      return {
        steps: ['Refund Requested', 'Refunded'],
        currentIdx: status === 'Refund Requested' ? 0 : 1
      };
    }
    if (status === 'Cancellation Requested' || status === 'Cancelled') {
      return {
        steps: ['Cancellation Requested', 'Cancelled'],
        currentIdx: status === 'Cancellation Requested' ? 0 : 1
      };
    }

    if (isPickup) {
      const pickupSteps = ['Confirmed', 'Packing', 'Ready for Pickup', 'Picked Up'];
      let idx = 0; // Default to Confirmed when newly placed and not yet accepted
      if (status === 'Delivered') {
        idx = 3;
      } else if (status === 'Ready for Pickup' || status === 'Out for Delivery') {
        idx = 2;
      } else if (status === 'Preparing' && order?.accepted_by_shopkeeper) {
        idx = 1; // Only advance to Packing once accepted by a shopkeeper
      } else {
        idx = 0; // Order Confirmed, waiting for shopkeeper to accept
      }
      return { steps: pickupSteps, currentIdx: idx };
    }

    const defaultSteps = ['Confirmed', 'Packing', 'Ready for Rider', 'On the way', 'Delivered'];
    let idx = 1;
    if (status === 'Payment Pending') {
      idx = 0;
    } else if (status === 'Preparing') {
      idx = order?.accepted_by_shopkeeper ? 1 : 0;
    } else if (status === 'Ready for Pickup') {
      idx = 2; // Packed by store, waiting for rider to pick up & start delivery
    } else if (status === 'Out for Delivery') {
      idx = 3; // Rider picked up package and is en route to customer
    } else if (status === 'Delivered') {
      idx = 4;
    }

    return { steps: defaultSteps, currentIdx: idx };
  };

  if (loading) {
    return (
      <div className="track-page">
        <div className="track-header">
          <button className="back-btn" onClick={() => navigate('/')} style={{ padding: '8px', margin: 0 }}>
            <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
          </button>
          <h2>Track Orders</h2>
        </div>
        <div className="track-loading">Loading active orders…</div>
      </div>
    );
  }

  return (
    <div className="track-page">
      <div className="track-header">
        <button className="back-btn" onClick={() => navigate('/')} style={{ padding: '8px', margin: 0 }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <Navigation size={20} color="var(--color-primary)" />
        <h2>Track Orders</h2>
      </div>

      <div className="track-orders-list">
        {orders.length === 0 ? (
          <div className="track-empty">
            <Package size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <h3>No active orders</h3>
            <p>Your active orders will appear here in real time.</p>
            <button onClick={() => navigate('/')} style={{ marginTop: '24px', padding: '14px 32px', backgroundColor: 'var(--color-text)', color: 'var(--color-background)', border: 'none', borderRadius: '24px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              Order Something
            </button>
          </div>
        ) : (
          orders.map(order => {
            const isCancellationReq = order.status === 'Cancellation Requested';
            const isCancellationRej = order.status === 'Cancellation Rejected';
            const hasUnavailableItems = order.substitution_status === 'PENDING_CUSTOMER_ACTION';

            return (
              <div key={order.id} className="track-card">
                {/* Card Header */}
                <div className="track-card-header">
                  <div className="track-status-pill" style={{ background: `${getStatusColor(order.status)}18`, color: getStatusColor(order.status) }}>
                    <PackageCheck size={14} />
                    <span>{order.status}</span>
                  </div>
                  <span className="track-date">{new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                </div>

                {/* Order info */}
                <div className="track-order-info">
                  <span className="track-order-id">#{order.id.split('-')[0].toUpperCase()}</span>
                  <span className="track-order-total">₹{order.total}</span>
                </div>
                <div className="track-items">
                  {order.items.map((item, idx) => (
                    <span key={idx} className={`track-item-chip ${item.is_refund_chosen ? 'refund-chosen' : item.is_unavailable ? 'unavailable' : ''}`}>
                      {item.qty}× {item.name} {item.is_refund_chosen ? '(Refund Requested)' : item.is_unavailable ? '(Out of stock)' : ''}
                    </span>
                  ))}
                </div>

                {/* Interactive Map (Only for Home Delivery orders) */}
                {!(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') && 
                  (order.status === 'Out for Delivery' || order.status === 'Ready for Pickup' || order.status === 'Preparing' || order.status === 'Payment Pending') && 
                  order.delivery_address && (
                  <MapErrorBoundary key={order.id}>
                    <DeliveryMap status={order.status} order={order} />
                  </MapErrorBoundary>
                )}

                {/* Doorstep Handover OTP & Rider Contact Section (Home Delivery only) */}
                {!(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') && order.status !== 'Delivered' && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    margin: '12px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(12, 131, 31, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#dcfce7', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ShieldCheck size={22} color="#15803d" />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Delivery Handover PIN
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '2px', fontFamily: 'monospace' }}>
                          {order.delivery_otp || '••••'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475467', marginTop: '2px' }}>
                          Share with rider at doorstep to collect items
                        </div>
                      </div>
                    </div>

                    {/* Call Delivery Partner: ONLY visible when Ready for Pickup or Out for Delivery */}
                    {(order.status === 'Ready for Pickup' || order.status === 'Out for Delivery') && order.accepted_by_rider && (
                      <a 
                        href="tel:9651568829"
                        style={{
                          background: '#0c831f',
                          color: '#ffffff',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textDecoration: 'none',
                          fontWeight: '700',
                          fontSize: '12.5px',
                          boxShadow: '0 4px 12px rgba(12, 131, 31, 0.25)',
                          flexShrink: 0
                        }}
                      >
                        <Phone size={15} /> Call Rider
                      </a>
                    )}
                  </div>
                )}

                {/* Substitution Alert Banner */}
                {hasUnavailableItems && (
                  <div className="track-alert track-alert-warn" style={{ flexDirection: 'column', alignItems: 'flex-start', background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '16px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertCircle size={20} color="#D97706" />
                      <span style={{ fontWeight: '700', fontSize: '15px' }}>Item out of stock!</span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.4', color: '#78350F' }}>
                      The store reported that some items in your order are currently unavailable. Choose a replacement or get an instant refund.
                    </p>
                    <button 
                      onClick={() => navigate('/substitute-selection')} 
                      style={{ background: '#D97706', color: '#ffffff', border: 'none', padding: '12px 16px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)' }}>
                      <RefreshCw size={16} /> Choose Replacement / Refund
                    </button>
                  </div>
                )}

                {/* Cancellation alerts */}
                {isCancellationReq && (
                  <div className="track-alert track-alert-warn">
                    <AlertCircle size={16} />
                    <span>Cancellation request sent. Waiting for store confirmation…</span>
                  </div>
                )}
                {isCancellationRej && (
                  <div className="track-alert track-alert-danger">
                    <AlertCircle size={16} />
                    <span>Cancellation was rejected. Your order is still on its way!</span>
                  </div>
                )}

                {/* Store Pickup Notice */}
                {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '16px',
                    padding: '16px',
                    margin: '14px 0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ShoppingBag size={22} color="#15803d" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '800', color: '#166534', fontSize: '14px', letterSpacing: '0.3px' }}>
                          STORE PICKUP ORDER
                        </div>
                        <span style={{
                          background: order.status === 'Delivered' 
                            ? '#dcfce7' 
                            : (order.status === 'Ready for Pickup' || order.status === 'Out for Delivery') 
                            ? '#bbf7d0' 
                            : order.accepted_by_shopkeeper 
                            ? '#fef3c7' 
                            : '#e0f2fe',
                          color: order.status === 'Delivered' 
                            ? '#15803d' 
                            : (order.status === 'Ready for Pickup' || order.status === 'Out for Delivery') 
                            ? '#166534' 
                            : order.accepted_by_shopkeeper 
                            ? '#92400e' 
                            : '#0369a1',
                          fontWeight: '800',
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}>
                          {order.status === 'Delivered'
                            ? 'Order Picked Up'
                            : (order.status === 'Ready for Pickup' || order.status === 'Out for Delivery')
                            ? 'Ready at Pickup Counter'
                            : order.accepted_by_shopkeeper
                            ? 'Shopkeeper is Packing Items'
                            : 'Order Confirmed (Waiting for Store)'}
                        </span>
                      </div>

                      <div style={{ fontSize: '13.5px', color: '#1e293b', marginTop: '6px', fontWeight: '600', lineHeight: '1.4' }}>
                        Pickup Location: <strong style={{ color: '#0f172a' }}>{order.delivery_address?.store_location || 'Zipit Store, Rauza'}</strong>
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#475467', marginTop: '4px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="#64748b" />
                        <span>{order.delivery_address?.pickup_time_estimate || 'Ready in approximately 1 hour after order'}</span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#166534', marginTop: '6px', fontWeight: '600', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                        {order.accepted_by_shopkeeper 
                          ? `Accepted & Prepared by: ${order.accepted_by_shopkeeper}` 
                          : 'Store will start packing once accepted at the counter'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Timeline */}
                {(() => {
                  const { steps, currentIdx } = getTimelineSteps(order.status, order);
                  return (
                    <div className="track-timeline">
                      {steps.map((label, i) => (
                        <div key={i} className={`track-step ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}>
                          <div className="track-step-dot">
                            {i < currentIdx ? <Check size={12} /> : <span>{i + 1}</span>}
                          </div>
                          <span className="track-step-label">{label}</span>
                          {i < steps.length - 1 && <div className="track-step-line" />}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Footer */}
                <div className="track-footer">
                  <span className="track-payment">Paid via {order.payment_method}</span>
                  {order.status === 'Preparing' && (
                    <button className="track-cancel-btn" onClick={() => handleCancelRequest(order.id)}>
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrackOrderPage;

