import React, { useState, useEffect, useRef } from 'react';
import { PackageCheck, ShoppingBag, X, Check, AlertCircle, MapPin, Navigation, ChevronLeft, RefreshCw, ArrowRight, Phone, ShieldCheck, Package, Store, Clock, CheckCircle2, Star, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { db, supabase } from '../services/db';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { playBellSound } from '../utils/siren';
import { PageSkeleton } from './SkeletonLoader';
import { useToast } from '../context/ToastContext';
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

// Custom crisp SVG Map Markers creator
const createSvgIcon = (svgContent, width = 36, height = 36) => {
  try {
    return new L.DivIcon({
      className: 'custom-map-icon',
      html: `<div style="width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25)); display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">${svgContent}</div>`,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2]
    });
  } catch (e) {
    return undefined;
  }
};

const STORE_ICON_HTML = `
  <div style="background: #0c831f; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
  </div>
`;

const DEST_ICON_HTML = `
  <div style="background: #ef4444; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
`;

const DRIVER_ICON_HTML = `
  <div style="background: #2563eb; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6); animation: pulse-ring 2s infinite;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
  </div>
`;

// Invalidate container dimensions so Leaflet renders smoothly without gray tiles
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (_) {}
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Auto-fit route bounds component
const MapBoundsFitter = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      try {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      } catch (_) {}
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

  const storeIcon = React.useMemo(() => createSvgIcon(STORE_ICON_HTML, 34, 34), []);
  const destIcon = React.useMemo(() => createSvgIcon(DEST_ICON_HTML, 36, 36), []);
  const driverIcon = React.useMemo(() => createSvgIcon(DRIVER_ICON_HTML, 38, 38), []);

  const [storeLocation, setStoreLocation] = useState([25.5788, 83.5780]);

  useEffect(() => {
    db.branding.get().then(b => {
      if (b && b.store_lat && b.store_lng) {
        const coords = [Number(b.store_lat), Number(b.store_lng)];
        setStoreLocation(coords);
        if (!order.delivery_lat || !order.delivery_lng) {
          setRiderPos(coords);
          targetPosRef.current = coords;
        }
      }
    }).catch(() => {});
  }, [order.delivery_lat, order.delivery_lng]);

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
  
  // Real rider position: initialized from DB order coords if present, else store
  const initialPos = (order.delivery_lat && order.delivery_lng) 
    ? [Number(order.delivery_lat), Number(order.delivery_lng)] 
    : storeLocation;

  const [riderPos, setRiderPos] = useState(initialPos);
  const [isLiveGpsActive, setIsLiveGpsActive] = useState(!!(order.delivery_lat && order.delivery_lng));
  const targetPosRef = useRef(initialPos);
  const animFrameRef = useRef(null);

  // Smooth lerp interpolation from current position to newly arrived GPS broadcast
  const lerp = (start, end, factor) => start + (end - start) * factor;

  // 1. In-memory Realtime Broadcast Listener (0 Egress / 0 DB writes)
  useEffect(() => {
    if (!order?.id) return;

    const channel = supabase.channel(`tracking_order_${order.id}`)
      .on('broadcast', { event: 'rider_location' }, ({ payload }) => {
        if (payload?.lat && payload?.lng) {
          const newTarget = [Number(payload.lat), Number(payload.lng)];
          targetPosRef.current = newTarget;
          setIsLiveGpsActive(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id]);

  // 2. Smooth marker interpolation towards targetPosRef
  useEffect(() => {
    let active = true;

    const step = () => {
      if (!active) return;
      setRiderPos(current => {
        const target = targetPosRef.current;
        if (!target) return current;
        const dLat = Math.abs(target[0] - current[0]);
        const dLng = Math.abs(target[1] - current[1]);
        if (dLat < 0.00002 && dLng < 0.00002) return target;
        return [
          lerp(current[0], target[0], 0.15),
          lerp(current[1], target[1], 0.15)
        ];
      });
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 3. Fallback when order.delivery_lat/lng updates via DB (e.g., initial fetch)
  useEffect(() => {
    if (order.delivery_lat && order.delivery_lng) {
      const dbTarget = [Number(order.delivery_lat), Number(order.delivery_lng)];
      targetPosRef.current = dbTarget;
      setIsLiveGpsActive(true);
    }
  }, [order.delivery_lat, order.delivery_lng]);

  const showRiderMarker = !isDelivered && (isOnTheWay || status === 'Ready for Pickup' || status === 'Preparing' || status === 'Preparing (Accepted)' || isLiveGpsActive);

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
        
        {storeIcon && <Marker position={storeLocation} icon={storeIcon} />}
        {destIcon && <Marker position={destLocation} icon={destIcon} />}
        
        {showRiderMarker && driverIcon && (
          <Marker position={riderPos} icon={driverIcon} />
        )}
        
        <MapResizer />
        <MapBoundsFitter positions={routePositions} />
        <MapUpdater center={isOnTheWay ? riderPos : null} />
      </MapContainer>

      {/* Floating Status Badge */}
      <div className="map-eta-badge" style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '8px 18px', borderRadius: '30px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: '13px', fontWeight: '700', color: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isDelivered ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} color="#15803d" /> Order Delivered</span>
        ) : isOnTheWay ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isLiveGpsActive ? '#10b981' : '#2563eb', animation: 'pulse 1.5s infinite' }}></span>
            <span>{isLiveGpsActive ? 'Live Rider GPS Tracking' : 'Rider is on the way · ~8 mins'}</span>
          </>
        ) : status === 'Ready for Pickup' ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }}></span>
            <span>Items packed · Rider picking up package</span>
          </>
        ) : status === 'Placed' ? (
          <>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }}></span>
            <span>Order confirmed · Waiting for store packing</span>
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
  'Placed',
  'Payment Pending',
  'Preparing',
  'Preparing (Accepted)',
  'Ready for Pickup',
  'Out for Delivery',
  'Cancellation requested',
  'Cancellation Requested',
  'Cancellation Rejected',
  'Refund Requested',
  'Refund Initiated'
];

const TrackOrderPage = ({ navigate }) => {
  const { showToast } = useToast();
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

    // 1. Supabase Realtime channel with immediate payload application
    const channel = supabase
      .channel(`track-orders-realtime-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        playBellSound();
        if (payload?.new && ACTIVE_STATUSES.includes(payload.new.status)) {
          setOrders(prev => {
            if (prev.some(o => o.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
        fetchOrders(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (payload?.new) {
          setOrders(prev => {
            const exists = prev.some(o => o.id === payload.new.id);
            if (!exists) {
              if (ACTIVE_STATUSES.includes(payload.new.status)) {
                return [payload.new, ...prev];
              }
              return prev;
            }
            if (!ACTIVE_STATUSES.includes(payload.new.status)) {
              return prev.filter(o => o.id !== payload.new.id);
            }
            return prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o);
          });
        }
        playBellSound();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        if (payload?.old?.id) {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
        fetchOrders(true);
      })
      .subscribe();

    // 2. Resilient polling fallback (every 5.0s) to guarantee updates while WebSocket handles instantaneous events
    const pollInterval = setInterval(() => {
      fetchOrders(true);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
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

  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  const handleCancelRequest = async (orderOrId) => {
    const orderObj = typeof orderOrId === 'object' ? orderOrId : orders.find(o => o.id === orderOrId);
    const orderId = typeof orderOrId === 'object' ? orderOrId.id : orderOrId;
    if (!orderId || cancellingOrderId) return;

    // Check if cancellation is allowed (before Out for Delivery)
    if (orderObj && (orderObj.status === 'Out for Delivery' || orderObj.status === 'Delivered' || orderObj.status === 'Cancelled')) {
      showToast(`Order cannot be cancelled once it is ${orderObj.status}.`, 'Cancellation Restricted');
      return;
    }

    const isEarlyStage = orderObj?.status === 'Placed' || orderObj?.status === 'Payment Pending';
    const confirmPrompt = isEarlyStage 
      ? 'Do you want to cancel this order?' 
      : 'Order is being prepared. Submit a cancellation request for admin review?';

    if (!window.confirm(confirmPrompt)) return;

    setCancellingOrderId(orderId);
    try {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancellation requested', substitution_status: 'CANCELLATION_REQUESTED' } : o));
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'Cancellation requested',
          substitution_status: 'CANCELLATION_REQUESTED'
        })
        .eq('id', orderId);

      if (error && error.code === '23514') {
        // Fallback for strict database check constraint until migration SQL is executed
        await supabase
          .from('orders')
          .update({ 
            substitution_status: 'CANCELLATION_REQUESTED'
          })
          .eq('id', orderId);
      }

      showToast('Your order is requested for cancellation.', 'Cancellation Requested');
      await fetchOrders(true);
    } catch (err) {
      console.warn('Cancellation request notice:', err);
      showToast('Your order is requested for cancellation.', 'Cancellation Requested');
      await fetchOrders(true);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Cancellation Requested' || status === 'Cancellation requested' || status === 'Refund Requested' || status === 'Refund Initiated') return '#dc2626';
    if (status === 'Cancellation Rejected') return '#d97706';
    if (status === 'Refunded' || status === 'Cancelled') return '#64748b';
    if (status === 'Out for Delivery') return '#2563eb';
    if (status === 'Placed') return '#10b981';
    return '#0c831f';
  };

  const getTimelineSteps = (status, order = null) => {
    const isPickup = order?.delivery_address?.is_pickup || order?.delivery_address?.order_type === 'PICKUP';

    if (status === 'Refund Requested' || status === 'Refund Initiated' || status === 'Refunded') {
      return {
        steps: ['Refund Initiated', 'Refunded'],
        currentIdx: (status === 'Refund Requested' || status === 'Refund Initiated') ? 0 : 1
      };
    }
    if (status === 'Cancellation Requested' || status === 'Cancellation requested' || status === 'Cancelled') {
      return {
        steps: ['Cancellation requested', 'Cancelled'],
        currentIdx: (status === 'Cancellation Requested' || status === 'Cancellation requested') ? 0 : 1
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
        idx = 0; // Order Confirmed / Placed, waiting for shopkeeper to accept
      }
      return { steps: pickupSteps, currentIdx: idx };
    }

    const defaultSteps = ['Confirmed', 'Packing', 'Ready for Rider', 'On the way', 'Delivered'];
    let idx = 0;
    if (status === 'Placed' || status === 'Payment Pending') {
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
    return <PageSkeleton type="track" />;
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
            const isExplicitRefund = order.status === 'Refund Initiated' || order.status === 'Refund Requested' || order.status === 'Refunded';
            const isExplicitCancelled = order.status === 'Cancelled';
            const isExplicitRejected = order.status === 'Cancellation Rejected';
            const isExplicitCancelReq = order.status === 'Cancellation Requested' || order.status === 'Cancellation requested';

            const isCancellationReq = !isExplicitRefund && !isExplicitCancelled && !isExplicitRejected && (isExplicitCancelReq || order.substitution_status === 'CANCELLATION_REQUESTED');
            const isCancellationRej = !isExplicitRefund && !isExplicitCancelled && (isExplicitRejected || order.substitution_status === 'CANCELLATION_REJECTED');
            const isRefundInit = isExplicitRefund || order.substitution_status === 'REFUND_PENDING' || order.substitution_status === 'REFUND_INITIATED';
            const hasUnavailableItems = order.substitution_status === 'PENDING_CUSTOMER_ACTION';

            const displayStatus = isRefundInit 
              ? (order.status === 'Refunded' ? 'Refunded' : 'Refund Initiated')
              : isCancellationReq 
                ? 'Cancellation requested' 
                : isCancellationRej 
                  ? 'Cancellation Rejected' 
                  : order.status;

            return (
              <div key={order.id} className="track-card modern-track-card">
                {/* 1. Header with Live Status & Date */}
                <div className="track-card-header">
                  <div className="track-header-left">
                    <span className="track-order-id">#{order.id.split('-')[0].toUpperCase()}</span>
                    <span className="track-date">{new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="track-status-pill" style={{ background: `${getStatusColor(displayStatus)}18`, color: getStatusColor(displayStatus) }}>
                    <span className="live-status-dot" style={{ background: getStatusColor(displayStatus) }} />
                    <span className="track-status-text">{displayStatus}</span>
                  </div>
                </div>

                {/* 2. Interactive Map with top-level container */}
                {!(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') && 
                  (order.status === 'Placed' || order.status === 'Out for Delivery' || order.status === 'Ready for Pickup' || order.status === 'Preparing' || order.status === 'Payment Pending') && 
                  order.delivery_address && (
                  <MapErrorBoundary key={order.id}>
                    <DeliveryMap status={order.status} order={order} />
                  </MapErrorBoundary>
                )}

                {/* 3. Modern Progress Stepper Bar */}
                {(() => {
                  const { steps, currentIdx } = getTimelineSteps(order.status, order);
                  return (
                    <div className="modern-stepper-container">
                      <div className="modern-stepper-progress-track">
                        {steps.map((label, i) => {
                          const isDone = i < currentIdx;
                          const isActive = i === currentIdx;
                          return (
                            <div key={i} className={`modern-step-node ${isDone ? 'is-done' : isActive ? 'is-active' : 'is-pending'}`}>
                              <div className="modern-step-circle-wrapper">
                                <div className={`modern-step-circle ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                                  {isDone ? (
                                    <Check size={14} strokeWidth={3} />
                                  ) : (
                                    <span className="step-inner-dot" />
                                  )}
                                </div>
                              </div>
                              <span className={`modern-step-text ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Delivery Partner & Handover Card (Home Delivery) */}
                {!(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') && order.status !== 'Delivered' && (
                  <div className="modern-partner-card">
                    <div className="partner-avatar-wrapper">
                      <div className="partner-avatar-circle">
                        {order.accepted_by_rider ? order.accepted_by_rider.charAt(0).toUpperCase() : 'R'}
                      </div>
                    </div>
                    <div className="partner-details">
                      <div className="partner-role-label">Delivery Partner</div>
                      <div className="partner-name-row">
                        <span className="partner-name">{order.accepted_by_rider || 'Assigning Rider...'}</span>
                        <span className="partner-rating-badge">
                          <Star size={11} fill="#F59E0B" color="#F59E0B" /> 4.9
                        </span>
                      </div>
                    </div>
                    <div className="partner-actions">
                      {(order.status === 'Ready for Pickup' || order.status === 'Out for Delivery') && order.accepted_by_rider ? (
                        <a href="tel:9651568829" className="modern-call-btn">
                          <Phone size={14} />
                          <span>Call</span>
                        </a>
                      ) : null}
                      <div className="modern-otp-pill" title="Doorstep Handover OTP">
                        <span className="otp-lbl">OTP</span>
                        <span className="otp-val">{order.delivery_otp || '••••'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Comprehensive Bill Info & Item Summary */}
                <div className="modern-order-summary-box" style={{
                  background: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  padding: '16px',
                  margin: '16px 0',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShoppingBag size={18} color="var(--color-primary-dark, #16a34a)" />
                      <span style={{ fontWeight: '800', fontSize: '14.5px', color: 'var(--color-text)' }}>
                        Bill & Order Details
                      </span>
                    </div>
                    <span style={{
                      background: 'var(--color-surface-muted, #f1f5f9)',
                      color: 'var(--color-text-light, #64748b)',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {Array.isArray(order.items) ? order.items.length : 0} items
                    </span>
                  </div>

                  {/* Items List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    borderBottom: '1px dashed var(--color-border)',
                    paddingBottom: '12px',
                    marginBottom: '12px'
                  }}>
                    {Array.isArray(order.items) && order.items.map((item, idx) => {
                      const qty = item.qty || item.quantity || 1;
                      const price = Number(item.price) || 0;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>
                            <strong style={{ color: 'var(--color-primary-dark, #16a34a)', marginRight: '4px' }}>{qty}×</strong> {item.name}
                          </span>
                          <span style={{ fontWeight: '700', color: 'var(--color-text)' }}>
                            ₹{price * qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bill Calculation Breakdown */}
                  {(() => {
                    const itemsTotal = Array.isArray(order.items)
                      ? order.items.reduce((sum, it) => sum + ((Number(it.price) || 0) * (it.qty || it.quantity || 1)), 0)
                      : 0;
                    const discount = Number(order.discount_amount) || Number(order.discountAmount) || 0;
                    const coupon = order.applied_coupon || order.appliedCoupon || order.coupon_code || order.couponCode;
                    const deliveryFee = Number(order.delivery_charge) || Number(order.deliveryCharge) || 0;
                    const smallCartFee = Number(order.small_cart_charge) || Number(order.smallCartCharge) || 0;
                    const grandTotal = Number(order.total) || 0;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light, #64748b)' }}>
                          <span>Items Total</span>
                          <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>₹{itemsTotal || grandTotal}</span>
                        </div>

                        {/* Applied Coupon / Discount Row */}
                        {(discount > 0 || coupon) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '700' }}>
                            <span>Discount / Coupon {coupon ? `(${coupon})` : ''}</span>
                            <span>-₹{discount > 0 ? discount : 'Applied'}</span>
                          </div>
                        )}

                        {/* Delivery Partner Fee */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light, #64748b)' }}>
                          <span>Delivery Fee</span>
                          <span style={{ fontWeight: '600', color: deliveryFee === 0 ? '#16a34a' : 'var(--color-text)' }}>
                            {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                          </span>
                        </div>

                        {/* Small Cart Fee */}
                        {smallCartFee > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light, #64748b)' }}>
                            <span>Small Cart Convenience</span>
                            <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>₹{smallCartFee}</span>
                          </div>
                        )}

                        {/* Grand Total Divider & Row */}
                        <div style={{
                          borderTop: '1.5px solid var(--color-border)',
                          paddingTop: '10px',
                          marginTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '15px'
                        }}>
                          <span style={{ fontWeight: '900', color: 'var(--color-text)' }}>Grand Total</span>
                          <span style={{ fontWeight: '900', color: '#16a34a', fontSize: '17px' }}>₹{grandTotal}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

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
                          background: order.status === 'Delivered' ? '#dcfce7' : '#bbf7d0',
                          color: '#166534',
                          fontWeight: '800',
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}>
                          {order.status === 'Delivered' ? 'Order Picked Up' : 'Ready at Pickup Counter'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13.5px', color: '#1e293b', marginTop: '6px', fontWeight: '600' }}>
                        Pickup Location: <strong style={{ color: '#0f172a' }}>{order.delivery_address?.store_location || 'Quickly Store Hubs'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="track-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px' }}>
                  <span className="track-payment" style={{ fontSize: '12.5px', color: 'var(--color-text-light)' }}>Paid via {order.payment_method}</span>
                  {/* Cancel Button logic: Available before order is Out for Delivery and not already requested */}
                  {order.status !== 'Out for Delivery' && order.status !== 'Delivered' && order.status !== 'Cancelled' && !isCancellationReq && !isCancellationRej && !isRefundInit && (
                    <button 
                      className="track-cancel-btn" 
                      onClick={() => handleCancelRequest(order)}
                      disabled={cancellingOrderId === order.id}
                      style={{ 
                        opacity: cancellingOrderId === order.id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                        background: '#FEF2F2',
                        color: '#B42318',
                        border: '1px solid #FCA5A5',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {cancellingOrderId === order.id ? 'Processing...' : 'Request Cancellation'}
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

