import React, { useEffect, useState, useRef } from 'react';
import { supabase, db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { MapPin, LogOut, PackageCheck, Zap, User, CheckCircle2, History, Package, QrCode, X, Wifi, WifiOff } from 'lucide-react';
import SlideToAccept from '../components/SlideToAccept';
import { auth } from '../services/auth';

export default function DashboardPage() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [isOnline, setIsOnline] = useState(localStorage.getItem('partner_online') === 'true');
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  const [qrModalOrder, setQrModalOrder] = useState(null); // Order to show dynamic UPI QR for
  const [remainingTimers, setRemainingTimers] = useState({}); // orderId -> seconds remaining for 5m limit
  const navigate = useNavigate();

  const riderCode = auth.getCode() || 'RIDER';

  // Listen to network online/offline events and auto-sync queue
  useEffect(() => {
    const handleOnline = async () => {
      setIsNetworkOnline(true);
      const synced = await db.orders.syncOfflineQueue();
      if (synced > 0) {
        fetchOrders();
      }
    };
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleOnline = async () => {
    const newState = !isOnline;
    setIsOnline(newState);
    localStorage.setItem('partner_online', String(newState));
    try {
      await supabase.from('rider_status').upsert({
        rider_code: riderCode,
        is_online: newState,
        last_ping: new Date().toISOString()
      }, { onConflict: 'rider_code' });
    } catch (err) {
      console.warn('Failed to sync rider online status to database:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('partner-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        fetchOrders();
      }).subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 5-Minute Timer check for orders accepted by this rider that are 'Ready for Pickup'
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const updatedTimers = {};

      for (const order of activeOrders) {
        const isMine = order.accepted_by_rider === riderCode;
        const isReady = (order.status || '').toLowerCase().startsWith('ready for pickup');
        
        if (isMine && isReady) {
          // Use accepted_at or fallback to order.updated_at or created_at
          const startTime = new Date(order.accepted_at || order.updated_at || order.created_at).getTime();
          const elapsedSec = Math.floor((now - startTime) / 1000);
          const maxSec = 5 * 60; // 5 minutes (300s)
          const leftSec = Math.max(0, maxSec - elapsedSec);

          updatedTimers[order.id] = leftSec;

          // If 5 minutes expired and rider still didn't mark "Out for Delivery"
          if (leftSec <= 0) {
            console.warn(`[Auto-Unclaim] Rider ${riderCode} exceeded 5 mins for order ${order.id}. Releasing back to pool.`);
            await supabase
              .from('orders')
              .update({
                accepted_by_rider: null,
                accepted_at: null
              })
              .eq('id', order.id)
              .eq('accepted_by_rider', riderCode);
            fetchOrders();
          }
        }
      }
      setRemainingTimers(updatedTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrders, riderCode]);

  const fetchOrders = async () => {
    // 1. Fetch active orders
    const { data: activeData } = await supabase.from('orders')
      .select('*')
      .in('status', ['Preparing', 'Payment Pending', 'Preparing (Accepted)', 'Ready for Pickup', 'Out for Delivery'])
      .order('created_at', { ascending: false });
    
    const activeDeliveryOnly = (activeData || []).filter(o => {
      const isPickup = o.delivery_address?.is_pickup === true || o.delivery_address?.order_type === 'PICKUP';
      return !isPickup;
    });
    setActiveOrders(activeDeliveryOnly);

    // 2. Fetch history orders delivered by this rider in last 30 days
    if (riderCode) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: historyData } = await supabase.from('orders')
        .select('*')
        .ilike('accepted_by_rider', riderCode)
        .eq('status', 'Delivered')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      setHistoryOrders(historyData || []);
    }
  };

  const handleClaimOrder = async (orderId) => {
    // Atomic update: only claim if accepted_by_rider is null or already this rider
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('orders')
      .update({
        accepted_by_rider: riderCode,
        accepted_at: nowIso
      })
      .eq('id', orderId)
      .or(`accepted_by_rider.is.null,accepted_by_rider.eq.${riderCode}`)
      .select()
      .single();
    
    if (error || !data) {
      alert('⚠️ Order was already claimed by another rider!');
      fetchOrders();
      return;
    }

    fetchOrders();
  };

  const handleMarkOutForDelivery = async (orderId) => {
    await db.orders.updateStatus(orderId, 'Out for Delivery');
    fetchOrders();
  };

  const handleMarkDelivered = async (orderId) => {
    await db.orders.updateStatus(orderId, 'Delivered');
    fetchOrders();
  };

  const handleLogout = async () => {
    auth.logout();
  };

  const cleanAddress = (addr) => {
    if (!addr) return 'Customer Address';
    if (typeof addr === 'string') return addr.split('\n---TAG:')[0];
    return addr.details?.split('\n---TAG:')[0] || addr.address || 'Customer Address';
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Header */}
      <header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 10,
        background: 'var(--color-surface)',
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#000', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>Rider Portal</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={toggleOnline}
            style={{
              padding: '8px 14px',
              borderRadius: '24px',
              border: 'none',
              background: isOnline ? 'var(--color-success-bg)' : '#f1f5f9',
              color: isOnline ? 'var(--color-success)' : 'var(--color-text-light)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? 'var(--color-success)' : 'var(--color-text-light)' }} />
            {isOnline ? 'Online' : 'Offline'}
          </button>

          <button onClick={() => navigate('/profile')} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }} title="Profile">
            <User size={18} />
          </button>

          <button onClick={handleLogout} style={{ background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: '#ef4444', display: 'flex' }} title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', gap: '10px' }}>
        <button 
          onClick={() => setActiveTab('active')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '12px',
            border: activeTab === 'active' ? '2px solid #2563eb' : '1px solid var(--color-border)',
            background: activeTab === 'active' ? '#eff6ff' : '#f8fafc',
            color: activeTab === 'active' ? '#1e40af' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          ⚡ Active Tasks ({activeOrders.length})
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '12px',
            border: activeTab === 'history' ? '2px solid #16a34a' : '1px solid var(--color-border)',
            background: activeTab === 'history' ? '#f0fdf4' : '#f8fafc',
            color: activeTab === 'history' ? '#15803d' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          ✅ History ({historyOrders.length})
        </button>
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '20px', flex: 1 }}>
        {!isOnline ? (
          <div style={{ 
            background: 'var(--color-surface)', 
            padding: '40px 20px', 
            borderRadius: '24px', 
            textAlign: 'center', 
            border: '1px dashed var(--color-border)',
            marginTop: '20px'
          }}>
            <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Zap size={28} color="var(--color-text-light)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You are Offline</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '14px', lineHeight: '1.5' }}>
              Toggle your status to "Online" to start receiving delivery assignments.
            </p>
          </div>
        ) : activeTab === 'active' ? (
          /* ACTIVE TASKS TAB */
          activeOrders.length === 0 ? (
            <div style={{ 
              background: 'var(--color-surface)', 
              padding: '40px 20px', 
              borderRadius: '24px', 
              textAlign: 'center', 
              border: '1px solid var(--color-border)',
              marginTop: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div style={{ width: '64px', height: '64px', background: 'var(--color-success-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <PackageCheck size={28} color="var(--color-success)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Waiting for orders</h3>
              <p style={{ color: 'var(--color-text-light)', fontSize: '14px', lineHeight: '1.5' }}>
                Stay nearby the store. New requests will appear here automatically.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeOrders.map(order => {
                const isClaimable = ['Preparing', 'Preparing (Accepted)', 'Ready for Pickup'].includes(order.status);
                const isUnclaimed = !order.accepted_by_rider && isClaimable;

                return (
                  <div key={order.id} style={{ 
                    background: 'var(--color-surface)', 
                    borderRadius: '20px', 
                    padding: '20px', 
                    border: '1px solid var(--color-border)', 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.04)' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontWeight: '800', color: 'var(--color-text)', fontSize: '16px' }}>Order #{order.id.slice(0,6).toUpperCase()}</div>
                        <div style={{ color: 'var(--color-text-light)', fontSize: '12px', marginTop: '4px' }}>
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ 
                        background: order.status === 'Out for Delivery' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                        color: order.status === 'Out for Delivery' ? 'var(--color-success)' : 'var(--color-warning)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {order.status}
                      </div>
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                      <MapPin size={18} color="var(--color-primary-dark)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: '1.5', fontWeight: '500' }}>
                        {cleanAddress(order.delivery_address)}
                      </div>
                    </div>
                    
                    {/* 5-Minute Unclaim Countdown Warning */}
                    {order.accepted_by_rider === riderCode && (order.status || '').toLowerCase().startsWith('ready for pickup') && remainingTimers[order.id] !== undefined && (
                      <div style={{
                        background: remainingTimers[order.id] < 60 ? '#fef2f2' : '#fffbeb',
                        border: remainingTimers[order.id] < 60 ? '1px solid #fecaca' : '1px solid #fde68a',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: remainingTimers[order.id] < 60 ? '#b91c1c' : '#92400e'
                      }}>
                        <span>⏱️ Pick up & Start timer:</span>
                        <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: '800' }}>
                          {Math.floor(remainingTimers[order.id] / 60)}:{(remainingTimers[order.id] % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    
                    {isUnclaimed ? (
                      <SlideToAccept
                        onAccept={() => handleClaimOrder(order.id)}
                        label="Slide to Accept Order"
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {order.status === 'Out for Delivery' ? (
                          <SlideToAccept
                            onAccept={() => handleMarkDelivered(order.id)}
                            label="Slide to Mark Delivered"
                          />
                        ) : (order.status || '').toLowerCase().startsWith('ready for pickup') ? (
                          <SlideToAccept
                            onAccept={() => handleMarkOutForDelivery(order.id)}
                            label="Slide to Mark Out for Delivery"
                          />
                        ) : (
                          <div style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            borderRadius: '12px',
                            padding: '12px',
                            textAlign: 'center',
                            fontSize: '13px',
                            fontWeight: '700'
                          }}>
                            ⌛ Shopkeeper is packing items... Waiting for status "Ready for Pickup"
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button 
                            onClick={() => navigate(`/map/${order.id}`)}
                            style={{ 
                              background: '#f1f5f9', 
                              color: '#0f172a', 
                              border: '1px solid #cbd5e1', 
                              padding: '11px', 
                              borderRadius: '12px', 
                              fontWeight: '700',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            🗺️ Map Route
                          </button>

                          <button 
                            onClick={() => setQrModalOrder(order)}
                            style={{ 
                              background: '#ecfdf5', 
                              color: '#047857', 
                              border: '1px solid #a7f3d0', 
                              padding: '11px', 
                              borderRadius: '12px', 
                              fontWeight: '700',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <QrCode size={16} /> Show UPI QR
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* DELIVERED HISTORY TAB */
          historyOrders.length === 0 ? (
            <div style={{ 
              background: 'var(--color-surface)', 
              padding: '40px 20px', 
              borderRadius: '24px', 
              textAlign: 'center', 
              border: '1px solid var(--color-border)',
              marginTop: '20px'
            }}>
              <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <History size={28} color="var(--color-text-light)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>No delivered orders yet</h3>
              <p style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>
                Orders completed by you will be listed here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                {historyOrders.length} Delivered Order{historyOrders.length > 1 ? 's' : ''}
              </h2>

              {historyOrders.map(order => (
                <div key={order.id} style={{ 
                  background: 'var(--color-surface)', 
                  borderRadius: '20px', 
                  padding: '20px', 
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: 'var(--color-text)', fontSize: '16px' }}>
                        Order #{order.id.slice(0, 6).toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--color-text-light)', fontSize: '12px', marginTop: '4px' }}>
                        Delivered on {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
                      ✅ Delivered
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={15} color="#2563eb" /> {cleanAddress(order.delivery_address)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-light)', fontWeight: '600' }}>
                      <Package size={14} style={{ display: 'inline', marginRight: 4 }} />
                      {Array.isArray(order.items) ? order.items.length : 1} item(s)
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#15803d' }}>
                      ₹{order.total} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>({order.payment_method || 'COD'})</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* Doorstep Dynamic UPI QR Modal */}
      {qrModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px 20px',
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setQrModalOrder(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} color="#475569" />
            </button>

            <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              ⚡ Doorstep Payment Collection
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px' }}>
              Order #{qrModalOrder.id.slice(0, 6).toUpperCase()}
            </h2>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', margin: '8px 0 16px' }}>
              ₹{qrModalOrder.total}
            </div>

            {/* Dynamic QR Image rendered with UPI Intent URL */}
            <div style={{
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'inline-block',
              marginBottom: '16px'
            }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(`upi://pay?pa=7290886111@ptyes&pn=Zipit%20Store&am=${qrModalOrder.total}&cu=INR&tn=Order%20${qrModalOrder.id.slice(0,6)}`)}`}
                alt="UPI QR Code"
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            </div>

            <p style={{ fontSize: '13px', color: '#475569', fontWeight: '600', margin: '0 0 16px', lineHeight: 1.4 }}>
              Ask customer to scan with any UPI App (GPay, PhonePe, Paytm)
            </p>

            <button
              onClick={() => {
                handleMarkDelivered(qrModalOrder.id);
                setQrModalOrder(null);
              }}
              style={{
                width: '100%',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '14px',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Payment Received · Mark Delivered
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
