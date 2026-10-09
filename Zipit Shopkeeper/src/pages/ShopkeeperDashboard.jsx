import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, db } from '../services/db';
import { ShoppingBag, Clock, CheckCircle2, MapPin, Phone, User, Package, Bike, ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import SlideToAccept from '../components/SlideToAccept';
import { auth } from '../services/auth';
import { useToast } from '../context/ToastContext';
import './ShopkeeperDashboard.css';

export default function ShopkeeperDashboard() {
  const location = useLocation();
  const isOrdersRoute = location.pathname === '/orders';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewingDetailOrder, setViewingDetailOrder] = useState(null);
  const [ordersTab, setOrdersTab] = useState('completed'); // 'completed' | 'all'
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
        showToast('Notice: Order was already accepted by another shopkeeper.', 'error');
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

  useEffect(() => {
    if (activeOrders.length > 0 && !selectedOrder) {
      setSelectedOrder(activeOrders[0]);
    }
  }, [activeOrders, selectedOrder]);

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
      return "Today's Orders";
    } else if (orderDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday's Orders";
    } else {
      return `Orders from ${orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
  };

  const formatTimeOnly = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Group active orders for Overview
  const groupedActiveOrders = activeOrders.reduce((acc, order) => {
    const groupKey = formatDateGroup(order.created_at);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(order);
    return acc;
  }, {});

  // Group historical orders for Orders Section
  const historicalList = ordersTab === 'completed' ? completedOrders : orders;
  const groupedHistoricalOrders = historicalList.reduce((acc, order) => {
    const groupKey = formatDateGroup(order.created_at);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(order);
    return acc;
  }, {});

  useEffect(() => {
    if (activeOrders.length > 0 && !selectedOrder) {
      setSelectedOrder(activeOrders[0]);
    }
  }, [activeOrders]);

  // -------------------------------------------------------------
  // VIEW: FULL ORDER DETAILS PAGE (Opened when card is clicked)
  // -------------------------------------------------------------
  if (viewingDetailOrder) {
    const order = viewingDetailOrder;
    const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';

    return (
      <div className="shopkeeper-dashboard-container">
        {/* Top Back Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <button 
            onClick={() => setViewingDetailOrder(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Orders</span>
          </button>

          <span className={`status-pill ${order.status?.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            {order.status}
          </span>
        </div>

        {/* Order Details Body */}
        <div style={{
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </h1>
                {isPickup ? (
                  <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                    STORE PICKUP
                  </span>
                ) : (
                  <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                    HOME DELIVERY
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
                <Calendar size={14} />
                <span>Placed on {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Amount</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#15803d' }}>₹{order.total}</div>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Via {order.payment_method || 'COD'}</span>
            </div>
          </div>

          {/* Fulfillment & Rider Info */}
          {!isPickup && (
            <div style={{
              background: order.accepted_by_rider ? '#eff6ff' : '#fffbeb',
              border: order.accepted_by_rider ? '1.5px solid #bfdbfe' : '1.5px solid #fde68a',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ background: order.accepted_by_rider ? '#dbeafe' : '#fef3c7', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bike size={24} color={order.accepted_by_rider ? '#2563eb' : '#d97706'} />
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: order.accepted_by_rider ? '#1e40af' : '#92400e', letterSpacing: '0.5px' }}>
                  Delivery Partner Information
                </span>
                <p style={{ margin: '3px 0 0', fontSize: '16px', fontWeight: 800, color: order.accepted_by_rider ? '#1e3a8a' : '#78350f' }}>
                  {order.accepted_by_rider 
                    ? `Assigned Rider: ${order.accepted_by_rider}` 
                    : 'Awaiting rider acceptance / dispatch'}
                </p>
              </div>
            </div>
          )}

          {/* Customer & Address Details */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#334155' }}>
              Customer Details & Address
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={18} color="#64748b" />
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Customer Name</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{order.profiles?.name || 'Customer'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={18} color="#64748b" />
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Contact Phone</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{order.profiles?.phone || 'Not available'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={18} color="#64748b" />
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Delivery Location</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{cleanAddress(order.delivery_address)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Ordered Products List */}
          <div>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Ordered Items ({Array.isArray(order.items) ? order.items.length : 1})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.isArray(order.items) && order.items.map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={20} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                      {item.amount && <div style={{ fontSize: '12px', color: '#64748b' }}>{item.amount}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', marginRight: '14px' }}>Qty: <strong>{item.quantity || item.qty || 1}</strong></span>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>₹{(item.quantity || item.qty || 1) * item.price}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Calculation Summary */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
              <span>Items Total</span>
              <span>₹{order.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
              <span>Delivery / Packing</span>
              <span>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a', borderTop: '1px dashed #cbd5e1', paddingTop: '10px', marginTop: '4px' }}>
              <span>Total Paid Amount</span>
              <span style={{ color: '#15803d' }}>₹{order.total}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: OVERVIEW PAGE ('/') -> ONLY ACTIVE ORDERS QUEUE
  // -------------------------------------------------------------
  if (!isOrdersRoute) {
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

        {/* Section Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Live Active Queue</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Recent orders that need packing, preparation, or pickup</p>
          </div>
          <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '12px', fontWeight: 800, padding: '4px 12px', borderRadius: '14px' }}>
            {activeOrders.length} In Progress
          </span>
        </div>

        {/* Responsive Split View for Active Orders */}
        <div className="dashboard-responsive-split">
          {/* Active Orders List */}
          <div className="orders-cards-column">
            {loading ? (
              <div className="loading-spinner">Loading store orders...</div>
            ) : activeOrders.length === 0 ? (
              <div className="empty-orders-box">
                <Package size={40} className="empty-icon" />
                <h3>No active orders in queue</h3>
                <p>New orders will appear here automatically with instant audio alert</p>
              </div>
            ) : (
              Object.keys(groupedActiveOrders).map(groupHeader => (
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
                    {groupHeader} ({groupedActiveOrders[groupHeader].length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {groupedActiveOrders[groupHeader].map(order => {
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
                                {formatTimeOnly(order.created_at)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? (
                                <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                  STORE PICKUP
                                </span>
                              ) : (
                                <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                  DELIVERY
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
                              <span>{isMine ? 'Accepted by You' : `Accepted by: ${order.accepted_by_shopkeeper}`}</span>
                              {(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? (
                                <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                  Store Pickup (No Rider)
                                </span>
                              ) : order.accepted_by_rider ? (
                                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                                  Rider: {order.accepted_by_rider}
                                </span>
                              ) : (
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                  Waiting for Rider
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

          {/* Action Pane for Selected Active Order */}
          {selectedOrder && (
            <div className="order-details-pane">
              <div className="details-pane-header">
                <h2>Order Actions & Details</h2>
                <span className="order-time">{new Date(selectedOrder.created_at).toLocaleString()}</span>
              </div>

              <div className="details-card-body">
                <div className="details-summary-bar">
                  <div>
                    <span className="label">Order ID</span>
                    <p className="val">#{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
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
                          ? `Claimed by Rider: ${selectedOrder.accepted_by_rider}` 
                          : 'Waiting for a Delivery Rider to claim...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Customer Details */}
                <div className="details-section">
                  <h3>Customer & Fulfillment Information</h3>
                  {(selectedOrder.delivery_address?.is_pickup || selectedOrder.delivery_address?.order_type === 'PICKUP') && (
                    <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px' }}>
                      <div style={{ fontWeight: '800', color: '#15803d', fontSize: '13px' }}>STORE PICKUP ORDER</div>
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
                        <span className="item-qty">Qty: {item.quantity || item.qty || 1}</span>
                        <span className="item-price">₹{(item.quantity || item.qty || 1) * item.price}</span>
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

  // -------------------------------------------------------------
  // VIEW 2: ORDERS SECTION ('/orders') -> COMPLETED & ALL ORDERS
  // -------------------------------------------------------------
  return (
    <div className="shopkeeper-dashboard-container">
      {/* Header and Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Orders Management</h2>
          <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>Browse all completed and historical orders</p>
        </div>

        <div className="dashboard-tabs-bar" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <button 
            className={`tab-btn ${ordersTab === 'completed' ? 'active' : ''}`} 
            onClick={() => setOrdersTab('completed')}
          >
            Completed Orders ({completedOrders.length})
          </button>
          <button 
            className={`tab-btn ${ordersTab === 'all' ? 'active' : ''}`} 
            onClick={() => setOrdersTab('all')}
          >
            All Orders ({orders.length})
          </button>
        </div>
      </div>

      {/* Orders Cards Grid */}
      {loading ? (
        <div className="loading-spinner">Loading orders archive...</div>
      ) : historicalList.length === 0 ? (
        <div className="empty-orders-box">
          <Package size={40} className="empty-icon" />
          <h3>No orders found</h3>
          <p>Orders will show here once completed</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.keys(groupedHistoricalOrders).map(groupHeader => (
            <div key={groupHeader} className="date-order-group">
              <div style={{
                fontSize: '12.5px',
                fontWeight: '800',
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '6px 14px',
                borderRadius: '12px',
                marginBottom: '12px',
                display: 'inline-block',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}>
                {groupHeader} ({groupedHistoricalOrders[groupHeader].length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {groupedHistoricalOrders[groupHeader].map(order => {
                  const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';

                  return (
                    <div 
                      key={order.id} 
                      className="order-list-card"
                      onClick={() => setViewingDetailOrder(order)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <div className="card-top-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="order-number">#{order.id.slice(0, 6).toUpperCase()}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', background: '#f8fafc', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {formatTimeOnly(order.created_at)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {isPickup ? (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>
                              PICKUP
                            </span>
                          ) : (
                            <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>
                              DELIVERY
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
                          {isPickup ? 'Store Pickup: Rauza' : cleanAddress(order.delivery_address)}
                        </div>
                        <div className="info-line-sub">
                          <span>{Array.isArray(order.items) ? order.items.length : 1} Items</span>
                          <strong className="order-total-price">₹{order.total}</strong>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '10px',
                        borderTop: '1px solid #f1f5f9',
                        marginTop: '4px',
                        color: '#2563eb',
                        fontSize: '12.5px',
                        fontWeight: 700
                      }}>
                        <span>Click to view full receipt</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
