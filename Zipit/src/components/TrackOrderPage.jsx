import React, { useState, useEffect, useRef } from 'react';
import { PackageCheck, ShoppingBag, X, Check, AlertCircle, MapPin, Navigation, ChevronLeft, RefreshCw, ArrowRight } from 'lucide-react';
import { db, supabase } from '../services/db';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TrackOrderPage.css';

// Error boundary so a Leaflet crash never blanks the whole page
class MapErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: 'var(--color-surface-muted, #f1f5f9)', borderRadius: 12, padding: '16px', textAlign: 'center', color: 'var(--color-text-light)', fontSize: 13, margin: '8px 0' }}>
          📍 Map unavailable — <strong>tracking your order</strong> is still active.
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
    <span style="font-size: 18px;">🏪</span>
  </div>
`, 34, 34);

const destIcon = createSvgIcon(`
  <div style="background: #ef4444; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff;">
    <div style="transform: rotate(45deg); font-size: 16px;">🏠</div>
  </div>
`, 36, 36);

const driverIcon = createSvgIcon(`
  <div style="background: #2563eb; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6); animation: pulse-ring 2s infinite;">
    <span style="font-size: 20px;">🛵</span>
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
        {/* High Definition Map Tiles */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" maxZoom={19} />
        
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
          <span>✅ Order Delivered</span>
        ) : isOnTheWay ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.5s infinite' }}></span>
            <span>Rider is on the way · ~8 mins</span>
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
const ACTIVE_STATUSES = ['Payment Pending', 'Preparing', 'Out for Delivery', 'Cancellation Requested', 'Cancellation Rejected', 'Refund Requested'];

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
    setOrders(active);
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    fetchOrders(false);

    const channel = supabase
      .channel(`track-orders-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchOrders(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders(true))
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

  const getTimelineSteps = (status) => {
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
    const defaultSteps = ['Confirmed', 'Preparing', 'On the way', 'Delivered'];
    let idx = 1;
    if (status === 'Payment Pending') idx = 0;
    else if (status === 'Preparing') idx = 1;
    else if (status === 'Out for Delivery') idx = 2;
    else if (status === 'Delivered') idx = 3;

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
            <div className="track-empty-icon">📦</div>
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

                {/* Interactive Map */}
                {(order.status === 'Out for Delivery' || order.status === 'Preparing' || order.status === 'Payment Pending') && order.delivery_address && (
                  <MapErrorBoundary key={order.id}>
                    <DeliveryMap status={order.status} order={order} />
                  </MapErrorBoundary>
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

                {/* Dynamic Timeline */}
                {(() => {
                  const { steps, currentIdx } = getTimelineSteps(order.status);
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

