import React, { useEffect, useState } from 'react';
import { supabase, db } from '../services/db';
import { ShoppingBag, Clock, CheckCircle2, MapPin, Phone, User, Package, AlertCircle, RefreshCw, Zap, Bike } from 'lucide-react';
import SlideToAccept from '../components/SlideToAccept';
import { auth } from '../services/auth';
import { useToast } from '../context/ToastContext';
import './ShopkeeperDashboard.css';

export default function ShopkeeperDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed' | 'all'
  const { showToast } = useToast();

  const shopkeeperCode = auth.getCode() || 'SHOPKEEPER';

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
      if (!selectedOrder && data.length > 0) {
        setSelectedOrder(data[0]);
      }
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchOrders(false);

    const channel = supabase
      .channel('shopkeeper-live-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAcceptOrder = async (orderId) => {
    try {
      // Atomic claim: only succeed if accepted_by_shopkeeper is currently null or already assigned to this shopkeeper
      const { data, error } = await supabase
        .from('orders')
        .update({
          accepted_by_shopkeeper: shopkeeperCode,
          status: 'Preparing'
        })
        .eq('id', orderId)
        .or(`accepted_by_shopkeeper.is.null,accepted_by_shopkeeper.eq.${shopkeeperCode}`)
        .select()
        .single();

      if (error || !data) {
        showToast('⚠️ Order was already accepted by another shopkeeper!', 'error');
        fetchOrders(true);
        return;
      }

      showToast('Order Accepted! Prepare items for delivery.', 'success');
      fetchOrders(true);
    } catch (err) {
      showToast(err.message || 'Failed to accept order', 'error');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      showToast(`Order status updated to ${newStatus}`, 'success');
      fetchOrders(true);
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const activeOrders = orders.filter(o => ['Placed', 'Preparing', 'Payment Pending', 'Preparing (Accepted)', 'Ready for Pickup', 'Out for Delivery'].includes(o.status));
  const completedOrders = orders.filter(o => ['Delivered', 'Cancelled'].includes(o.status));

  const displayOrdersList = activeTab === 'active' ? activeOrders : activeTab === 'completed' ? completedOrders : orders;

  useEffect(() => {
    if (selectedOrder) {
      const existsInCurrentTab = displayOrdersList.some(o => o.id === selectedOrder.id);
      if (!existsInCurrentTab) {
        setSelectedOrder(displayOrdersList.length > 0 ? displayOrdersList[0] : null);
      }
    } else if (displayOrdersList.length > 0) {
      setSelectedOrder(displayOrdersList[0]);
    }
  }, [orders, activeTab]);

  const cleanAddress = (addr) => {
    if (!addr) return 'Customer Address';
    if (typeof addr === 'string') return addr.split('\n---TAG:')[0];
    return addr.details?.split('\n---TAG:')[0] || addr.address || 'Customer Address';
  };

  const formatDateGroup = (dateString) => {
    if (!dateString) return 'Earlier Orders';
    const orderDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (orderDate.toDateString() === today.toDateString()) {
      return '⚡ Today\'s Orders';
    } else if (orderDate.toDateString() === yesterday.toDateString()) {
      return '📅 Yesterday\'s Orders';
    } else {
      return `📅 Orders from ${orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
  };

  const formatTimeOnly = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Group displayOrdersList by Date Classification
  const groupedOrders = displayOrdersList.reduce((acc, order) => {
    const groupKey = formatDateGroup(order.created_at);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(order);
    return acc;
  }, {});

  return (
    <div className="shopkeeper-dashboard-container">
      {/* Metrics Banner Bar */}
      <div className="shop-metrics-grid">
        <div className="metric-card active-card">
          <div className="metric-icon"><ShoppingBag size={22} /></div>
          <div>
            <span className="metric-num">{activeOrders.length}</span>
            <span className="metric-label">Active Orders</span>
          </div>
        </div>

        <div className="metric-card pending-card">
          <div className="metric-icon"><Clock size={22} /></div>
          <div>
            <span className="metric-num">{orders.filter(o => !o.accepted_by_shopkeeper && ['Placed', 'Preparing', 'Payment Pending'].includes(o.status)).length}</span>
            <span className="metric-label">Needs Acceptance</span>
          </div>
        </div>

        <div className="metric-card done-card">
          <div className="metric-icon"><CheckCircle2 size={22} /></div>
          <div>
            <span className="metric-num">{completedOrders.length}</span>
            <span className="metric-label">Completed Today</span>
          </div>
        </div>
      </div>

      {/* Tabs Filter Header */}
      <div className="dashboard-tabs-bar">
        <button className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
          ⚡ Active Queue ({activeOrders.length})
        </button>
        <button className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
          ✅ Completed ({completedOrders.length})
        </button>
        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          📋 All Orders ({orders.length})
        </button>
      </div>

      {/* Main Split Layout (Device Responsive) */}
      <div className="dashboard-responsive-split">
        {/* Orders Cards List */}
        <div className="orders-cards-column">
          {loading ? (
            <div className="loading-spinner">Loading store orders...</div>
          ) : displayOrdersList.length === 0 ? (
            <div className="empty-orders-box">
              <Package size={40} className="empty-icon" />
              <h3>No orders in this queue</h3>
              <p>New orders will appear here automatically with audio alert</p>
            </div>
          ) : (
            Object.keys(groupedOrders).map(groupHeader => (
              <div key={groupHeader} className="date-order-group" style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12.5px',
                  fontWeight: '800',
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  marginBottom: '10px',
                  display: 'inline-block',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}>
                  {groupHeader} ({groupedOrders[groupHeader].length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupedOrders[groupHeader].map(order => {
                    const isMine = order.accepted_by_shopkeeper === shopkeeperCode;
                    const isAcceptable = ['Placed', 'Preparing', 'Payment Pending'].includes(order.status);
                    const isUnclaimed = !order.accepted_by_shopkeeper && isAcceptable;

                    return (
                      <div 
                        key={order.id} 
                        className={`order-list-card ${selectedOrder?.id === order.id ? 'selected' : ''} ${isUnclaimed ? 'unclaimed' : ''}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="card-top-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="order-number">#{order.id.slice(0, 6).toUpperCase()}</span>
                            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700', background: '#f8fafc', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              ⏰ {formatTimeOnly(order.created_at)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                🛍️ STORE PICKUP
                              </span>
                            ) : (
                              <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                🛵 DELIVERY
                              </span>
                            )}
                            <span className={`status-pill ${order.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>

                        <div className="card-middle-info">
                          <div className="info-line">
                            <MapPin size={15} /> 
                            {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') 
                              ? `Pickup at Store: Rauza (${order.delivery_address?.pickup_time_estimate || '~1 hr'})` 
                              : cleanAddress(order.delivery_address)}
                          </div>
                          <div className="info-line-sub">
                            <span>Items: {Array.isArray(order.items) ? order.items.length : 1}</span>
                            <strong className="order-total-price">₹{order.total}</strong>
                          </div>
                        </div>

                        {/* Accept Action */}
                        {isUnclaimed ? (
                          <div className="card-accept-wrapper" onClick={(e) => e.stopPropagation()}>
                            <SlideToAccept
                              onAccept={() => handleAcceptOrder(order.id)}
                              label="Slide to Accept Order"
                            />
                          </div>
                        ) : (
                          <div className="card-accepted-by" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span>{isMine ? '✓ Accepted by You' : `Accepted by: ${order.accepted_by_shopkeeper}`}</span>
                            {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? (
                              <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                🛍️ Store Pickup (No Rider)
                              </span>
                            ) : order.accepted_by_rider ? (
                              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                                🛵 Rider: {order.accepted_by_rider}
                              </span>
                            ) : (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                ⌛ Waiting for Rider
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detailed Order Action Pane (Desktop View & Expanded Mobile View) */}
        {selectedOrder && (
          <div className="order-details-pane">
            <div className="details-pane-header">
              <h2>Order Details</h2>
              <span className="order-time">{new Date(selectedOrder.created_at).toLocaleString()}</span>
            </div>

            <div className="details-card-body">
              <div className="details-summary-bar">
                <div>
                  <span className="label">Order ID</span>
                  <p className="val">#{selectedOrder.id.toUpperCase()}</p>
                </div>
                <div>
                  <span className="label">Total Paid</span>
                  <p className="val total-val">₹{selectedOrder.total}</p>
                </div>
                <div>
                  <span className="label">Payment</span>
                  <p className="val">{selectedOrder.payment_method || 'COD'}</p>
                </div>
              </div>

              {/* Rider Pickup Status Box */}
              {!(selectedOrder.delivery_address?.is_pickup || selectedOrder.delivery_address?.order_type === 'PICKUP') && (
                <div style={{
                  background: selectedOrder.accepted_by_rider ? '#eff6ff' : '#fffbeb',
                  border: selectedOrder.accepted_by_rider ? '1.5px solid #bfdbfe' : '1.5px solid #fde68a',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  margin: '14px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ background: selectedOrder.accepted_by_rider ? '#dbeafe' : '#fef3c7', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bike size={24} color={selectedOrder.accepted_by_rider ? '#2563eb' : '#d97706'} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: selectedOrder.accepted_by_rider ? '#1e40af' : '#92400e', letterSpacing: '0.5px' }}>
                      Delivery Rider Pickup Info
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: '800', color: selectedOrder.accepted_by_rider ? '#1e3a8a' : '#78350f' }}>
                      {selectedOrder.accepted_by_rider 
                        ? `🛵 Claimed by Rider: ${selectedOrder.accepted_by_rider}` 
                        : '⌛ Waiting for a Delivery Rider to claim...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Details */}
              <div className="details-section">
                <h3>Customer & Fulfillment Information</h3>
                {(selectedOrder.delivery_address?.is_pickup || selectedOrder.delivery_address?.order_type === 'PICKUP') && (
                  <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', color: '#15803d', fontSize: '13px' }}>🛍️ STORE PICKUP ORDER</div>
                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                      Ready Time: <strong>{selectedOrder.delivery_address?.pickup_time_estimate || 'Ready in ~1 hour'}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#14532d', marginTop: '2px' }}>
                      Location: {selectedOrder.delivery_address?.store_location || 'Zipit Store, Rauza'} (No rider will be assigned)
                    </div>
                  </div>
                )}
                <div className="detail-info-row">
                  <User size={16} /> <span>{selectedOrder.profiles?.name || 'Customer'}</span>
                </div>
                <div className="detail-info-row">
                  <Phone size={16} /> <span>{selectedOrder.profiles?.phone || 'No Phone'}</span>
                </div>
                <div className="detail-info-row">
                  <MapPin size={16} /> <span>{cleanAddress(selectedOrder.delivery_address)}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="details-section">
                <h3>Ordered Products</h3>
                <div className="items-table">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, i) => (
                    <div key={i} className="item-row">
                      <span className="item-name">{item.name}</span>
                      <span className="item-qty">Qty: {item.quantity || 1}</span>
                      <span className="item-price">₹{(item.quantity || 1) * item.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Status Action Controls */}
              <div className="details-section actions-section">
                <h3>Status Actions</h3>
                <div className="status-buttons-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Preparing')}
                    className="status-btn preparing"
                  >
                    Packing Items
                  </button>
                  <button 
                    onClick={() => {
                      const isPickup = selectedOrder.delivery_address?.is_pickup || selectedOrder.delivery_address?.order_type === 'PICKUP';
                      handleUpdateStatus(selectedOrder.id, isPickup ? 'Delivered' : 'Ready for Pickup');
                    }}
                    className="status-btn ready"
                  >
                    {(selectedOrder.delivery_address?.is_pickup || selectedOrder.delivery_address?.order_type === 'PICKUP') 
                      ? 'Picked Up' 
                      : 'Mark Ready for Pickup'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
