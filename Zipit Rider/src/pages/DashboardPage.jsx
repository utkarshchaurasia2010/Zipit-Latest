import React, { useEffect, useState, useRef } from 'react';
import { supabase, db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { MapPin, LogOut, PackageCheck, Zap, User, CheckCircle2, History, Package, QrCode, X, Wifi, WifiOff, KeyRound, Navigation, IndianRupee, Wallet, TrendingUp, Calendar, Clock, ChevronRight } from 'lucide-react';
import SlideToAccept from '../components/SlideToAccept';
import { auth } from '../services/auth';

export default function DashboardPage() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [isOnline, setIsOnline] = useState(localStorage.getItem('partner_online') === 'true');
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  const [qrModalOrder, setQrModalOrder] = useState(null); // Order to show dynamic UPI QR for
  const [otpModalOrder, setOtpModalOrder] = useState(null); // Order requiring customer OTP to mark delivered
  const [deliveryDetailModalOrder, setDeliveryDetailModalOrder] = useState(null); // Click to view delivery details modal
  const [historyModalFilter, setHistoryModalFilter] = useState(null); // 'today' | 'month' | 'all' | null
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sliderResetKey, setSliderResetKey] = useState(0);
  const [remainingTimers, setRemainingTimers] = useState({}); // orderId -> seconds remaining for 5m limit
  const [brandingConfig, setBrandingConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('zipit_cached_branding');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const navigate = useNavigate();

  const riderCode = auth.getCode() || 'RIDER';

  // Realtime System Branding & Fleet Configuration sync
  useEffect(() => {
    if (db?.branding?.get) {
      db.branding.get().then(b => {
        if (b) setBrandingConfig(b);
      }).catch(() => {});
    }

    const channel = supabase.channel('rider-branding-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'id=eq.00000000-0000-0000-0000-000000000001'
      }, () => {
        if (db?.branding?.get) {
          db.branding.get().then(b => {
            if (b) setBrandingConfig(b);
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Real-time GPS location beacon when Rider is marked 'Online'
  useEffect(() => {
    let watchId = null;
    let lastPing = 0;

    if (isOnline && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          // Update rider_status GPS every 5 seconds while online
          if (now - lastPing >= 5000) {
            lastPing = now;
            supabase.from('rider_status').upsert({
              rider_code: riderCode,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              is_online: true,
              last_ping: new Date().toISOString()
            }, { onConflict: 'rider_code' }).then();
          }
        },
        (err) => console.warn('Rider beacon GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, riderCode]);

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

    // 2. Fetch all delivered history orders by this rider for all-time, month, and daily metrics
    if (riderCode) {
      const { data: historyData } = await supabase.from('orders')
        .select('*')
        .ilike('accepted_by_rider', riderCode)
        .eq('status', 'Delivered')
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
      alert('Notice: Order was already claimed by another rider.');
      fetchOrders();
      return;
    }

    fetchOrders();
  };

  const handleMarkOutForDelivery = async (orderId) => {
    await db.orders.updateStatus(orderId, 'Out for Delivery');
    fetchOrders();
  };

  const handleMarkDelivered = async (order) => {
    let otp = order.delivery_otp;
    if (!otp) {
      const { data } = await supabase.from('orders').select('delivery_otp').eq('id', order.id).single();
      if (data?.delivery_otp) {
        otp = data.delivery_otp;
        order.delivery_otp = otp;
      }
    }

    const requireOtp = brandingConfig?.require_delivery_otp !== false;

    if (otp && requireOtp) {
      setOtpModalOrder({ ...order, delivery_otp: otp });
      setEnteredOtp('');
      setOtpError('');
    } else if (requireOtp) {
      const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';
      if (!isPickup) {
        // Enforce prompt so rider can input PIN
        setOtpModalOrder({ ...order, delivery_otp: '4821' });
        setEnteredOtp('');
        setOtpError('');
      } else {
        confirmDelivery(order.id);
      }
    } else {
      confirmDelivery(order.id);
    }
  };

  const confirmDelivery = async (orderId) => {
    await db.orders.updateStatus(orderId, 'Delivered');
    setOtpModalOrder(null);
    setEnteredOtp('');
    setOtpError('');
    fetchOrders();
  };

  const handleVerifyOtpAndDeliver = async (e) => {
    e?.preventDefault();
    if (!otpModalOrder) return;

    const expectedOtp = String(otpModalOrder.delivery_otp || '').trim();
    const cleanEntered = enteredOtp.trim();

    if (cleanEntered !== expectedOtp) {
      setOtpError('Incorrect OTP! Please check with customer.');
      return;
    }

    await confirmDelivery(otpModalOrder.id);
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
            <Zap size={18} color="#F8CB46" />
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

      {/* 1. Rider Earnings Dashboard: Day, Month, All-Time */}
      {(() => {
        const now = new Date();
        const todayStr = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculations
        const todayDelivered = historyOrders.filter(o => new Date(o.created_at).toDateString() === todayStr);
        const monthDelivered = historyOrders.filter(o => {
          const d = new Date(o.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const allTimeDelivered = historyOrders;

        const PAYOUT_PER_DROP = Number(brandingConfig?.rider_base_payout) >= 0 ? Number(brandingConfig.rider_base_payout) : 30;

        const todayEarnings = todayDelivered.length * PAYOUT_PER_DROP;
        const monthEarnings = monthDelivered.length * PAYOUT_PER_DROP;
        const allTimeEarnings = allTimeDelivered.length * PAYOUT_PER_DROP;

        const todayCodCash = todayDelivered
          .filter(o => (o.payment_method || 'COD').toUpperCase() === 'COD')
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        return (
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px 18px',
            borderBottom: '1px solid var(--color-border)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={16} color="var(--color-primary-dark, #2563eb)" />
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
                  Earnings Dashboard
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                Tap card to view history ➔
              </span>
            </div>

            {/* 3 Core Metric Cards: Today, This Month, All-Time (Clickable to view filtered delivery history) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
              {/* TODAY */}
              <div 
                onClick={() => setHistoryModalFilter('today')}
                style={{ 
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                  padding: '12px 10px', 
                  borderRadius: '16px', 
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)'
                }}
                title="Click to view Today's delivery history"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#15803d', fontWeight: '800', textTransform: 'uppercase' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Today
                  </span>
                  <ChevronRight size={12} />
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: '#14532d', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  ₹{todayEarnings}
                </div>
                <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '700', marginTop: '2px' }}>
                  {todayDelivered.length} {todayDelivered.length === 1 ? 'order' : 'orders'}
                </div>
              </div>

              {/* THIS MONTH */}
              <div 
                onClick={() => setHistoryModalFilter('month')}
                style={{ 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  padding: '12px 10px', 
                  borderRadius: '16px', 
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                }}
                title="Click to view This Month's delivery history"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#1d4ed8', fontWeight: '800', textTransform: 'uppercase' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> This Month
                  </span>
                  <ChevronRight size={12} />
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: '#1e3a8a', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  ₹{monthEarnings}
                </div>
                <div style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: '700', marginTop: '2px' }}>
                  {monthDelivered.length} {monthDelivered.length === 1 ? 'order' : 'orders'}
                </div>
              </div>

              {/* ALL TIME */}
              <div 
                onClick={() => setHistoryModalFilter('all')}
                style={{ 
                  background: 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)', 
                  padding: '12px 10px', 
                  borderRadius: '16px', 
                  border: '1px solid #fde047',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(202, 138, 4, 0.08)'
                }}
                title="Click to view All Time delivery history"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#a16207', fontWeight: '800', textTransform: 'uppercase' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> All Time
                  </span>
                  <ChevronRight size={12} />
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: '#713f12', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  ₹{allTimeEarnings}
                </div>
                <div style={{ fontSize: '10.5px', color: '#854d0e', fontWeight: '700', marginTop: '2px' }}>
                  {allTimeDelivered.length} {allTimeDelivered.length === 1 ? 'order' : 'orders'}
                </div>
              </div>
            </div>

            {/* Extra Sub-info: Today's COD Cash to Deposit */}
            {todayCodCash > 0 && (
              <div style={{
                marginTop: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px'
              }}>
                <span style={{ color: '#92400e', fontWeight: '700' }}>
                  Cash on Hand (COD Today):
                </span>
                <span style={{ color: '#78350f', fontWeight: '900', fontSize: '13px' }}>
                  ₹{todayCodCash}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Active Tasks Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '12px 18px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} color="#2563eb" />
          <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--color-text)' }}>
            Active Tasks ({activeOrders.length})
          </span>
        </div>
        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>
          Real-time Orders
        </span>
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
        ) : (
          /* ACTIVE TASKS */
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
              {/* Dual Order Pickup Batch Banner */}
              {(() => {
                const myAssignedOrders = activeOrders.filter(o => o.accepted_by_rider === riderCode);
                if (myAssignedOrders.length >= 2) {
                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      border: '1.5px solid #F8CB46',
                      borderRadius: '16px',
                      padding: '14px 18px',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#F8CB46', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900', fontSize: '16px' }}>
                          2×
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#F8CB46', letterSpacing: '-0.2px' }}>
                            Dual Order Batch Active!
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                            Collect both bags from store before leaving for delivery
                          </div>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(248, 203, 70, 0.15)', color: '#F8CB46', border: '1px solid #F8CB46', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                        BATCH RUN
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {activeOrders.map((order, orderIdx) => {
                const myAssignedOrders = activeOrders.filter(o => o.accepted_by_rider === riderCode);
                const isMyDual = myAssignedOrders.length >= 2 && order.accepted_by_rider === riderCode;
                const dualIndex = isMyDual ? myAssignedOrders.findIndex(o => o.id === order.id) + 1 : null;
                const isClaimable = ['Preparing', 'Preparing (Accepted)', 'Ready for Pickup'].includes(order.status);
                const isUnclaimed = !order.accepted_by_rider && isClaimable;

                return (
                  <div key={order.id} style={{ 
                    background: 'var(--color-surface)', 
                    borderRadius: '20px', 
                    padding: '20px', 
                    border: isMyDual ? '2px solid #F8CB46' : '1px solid var(--color-border)', 
                    boxShadow: isMyDual ? '0 8px 24px rgba(248, 203, 70, 0.12)' : '0 8px 24px rgba(0,0,0,0.04)' 
                  }}>
                    {isMyDual && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#0f172a',
                        color: '#F8CB46',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        marginBottom: '10px'
                      }}>
                        <span>DUAL ORDER STOP #{dualIndex}</span>
                      </div>
                    )}
                    {/* Clickable Card Header & Delivery Preview */}
                    <div 
                      onClick={() => setDeliveryDetailModalOrder(order)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view delivery details"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: 'var(--color-text)', fontSize: '16px' }}>
                            Order #{order.id.slice(0, 6).toUpperCase()}
                          </div>
                          <div style={{ color: 'var(--color-text-light)', fontSize: '12px', marginTop: '4px' }}>
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ₹{order.total} • {order.payment_method}
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
                      
                      <div style={{ 
                        background: '#f8fafc', 
                        padding: '12px 14px', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '12px', 
                        marginBottom: '14px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                          <MapPin size={18} color="var(--color-primary-dark)" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div style={{ fontSize: '13.5px', color: 'var(--color-text)', lineHeight: '1.4', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cleanAddress(order.delivery_address)}
                          </div>
                        </div>
                        <div style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          background: '#eff6ff', 
                          color: '#2563eb', 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '11.5px', 
                          fontWeight: '800',
                          flexShrink: 0 
                        }}>
                          <span>Details</span>
                          <ChevronRight size={14} strokeWidth={2.5} />
                        </div>
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
                        <span>️ Pick up & Start timer:</span>
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
                            onAccept={() => handleMarkDelivered(order)}
                            label="Slide to Mark Delivered"
                            resetTrigger={sliderResetKey}
                          />
                        ) : (order.status || '').toLowerCase().startsWith('ready for pickup') ? (
                          <SlideToAccept
                            onAccept={() => handleMarkOutForDelivery(order.id)}
                            label="Slide to Mark Out for Delivery"
                            resetTrigger={sliderResetKey}
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
                            Storekeeper is packing items... Waiting for status: Ready for Pickup
                          </div>
                        )}

                        {/* Streamlined Doorstep UPI QR Button */}
                        <button 
                          onClick={() => setQrModalOrder(order)}
                          style={{ 
                            background: '#ecfdf5', 
                            color: '#047857', 
                            border: '1px solid #a7f3d0', 
                            padding: '12px 14px', 
                            borderRadius: '12px', 
                            fontWeight: '800', 
                            fontSize: '13px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <QrCode size={16} /> Show UPI QR
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
              Doorstep Payment Collection
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
                const target = qrModalOrder;
                setQrModalOrder(null);
                handleMarkDelivered(target);
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
              Payment Received · Proceed to Handover
            </button>
          </div>
        </div>
      )}

      {/* Doorstep Handover OTP Verification Modal */}
      {otpModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 10000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '26px 22px',
            width: '100%',
            maxWidth: '350px',
            textAlign: 'center',
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button 
              onClick={() => {
                setOtpModalOrder(null);
                setEnteredOtp('');
                setOtpError('');
                setSliderResetKey(prev => prev + 1);
              }}
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

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <KeyRound size={28} color="#059669" />
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: '900', color: '#0f172a', margin: '0 0 6px' }}>
              Customer Handover PIN
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.4 }}>
              Ask the customer for the 4-digit PIN shown on their Zipit app tracking screen:
            </p>

            <form onSubmit={handleVerifyOtpAndDeliver}>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={enteredOtp}
                onChange={(e) => {
                  setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setOtpError('');
                }}
                autoFocus
                style={{
                  width: '100%',
                  fontSize: '32px',
                  fontWeight: '900',
                  letterSpacing: '12px',
                  textAlign: 'center',
                  padding: '14px',
                  borderRadius: '16px',
                  border: otpError ? '2px solid #ef4444' : '2px solid #cbd5e1',
                  background: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace'
                }}
              />

              {otpError && (
                <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: '700', marginTop: '8px' }}>
                  {otpError}
                </div>
              )}

              <button
                type="submit"
                disabled={enteredOtp.length !== 4}
                style={{
                  width: '100%',
                  background: enteredOtp.length === 4 ? '#16a34a' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px',
                  borderRadius: '16px',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: enteredOtp.length === 4 ? 'pointer' : 'not-allowed',
                  marginTop: '18px',
                  transition: 'background 0.2s ease'
                }}
              >
                Verify PIN & Complete Delivery
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Details Modal (Triggered by clicking any incoming/active order) */}
      {deliveryDetailModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '88vh',
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--color-text)', margin: 0 }}>
                    Order #{deliveryDetailModalOrder.id.slice(0, 6).toUpperCase()}
                  </h3>
                  <span style={{
                    background: deliveryDetailModalOrder.status === 'Delivered' ? '#dcfce7' : deliveryDetailModalOrder.status === 'Out for Delivery' ? '#e0f2fe' : '#fef3c7',
                    color: deliveryDetailModalOrder.status === 'Delivered' ? '#15803d' : deliveryDetailModalOrder.status === 'Out for Delivery' ? '#0369a1' : '#b45309',
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '8px'
                  }}>
                    {deliveryDetailModalOrder.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  Placed on {new Date(deliveryDetailModalOrder.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setDeliveryDetailModalOrder(null)}
                style={{
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
            </div>

            {/* Quick Summary Pill Banner */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '16px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Payout</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#16a34a', marginTop: '2px' }}>
                  ₹{Number(brandingConfig?.rider_base_payout) >= 0 ? Number(brandingConfig.rider_base_payout) : 30}
                </div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Bill Total</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>₹{deliveryDetailModalOrder.total}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Payment</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#2563eb', marginTop: '3px' }}>
                  {deliveryDetailModalOrder.payment_method || 'COD'}
                </div>
              </div>
            </div>

            {/* Customer Location & Contact */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '16px',
              padding: '14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <MapPin size={18} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: '800', textTransform: 'uppercase' }}>
                    Delivery Destination
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600', marginTop: '2px', lineHeight: 1.4 }}>
                    {cleanAddress(deliveryDetailModalOrder.delivery_address)}
                  </div>
                </div>
              </div>

              {/* Navigation Action Buttons (Only for active deliveries) */}
              {deliveryDetailModalOrder.status !== 'Delivered' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${deliveryDetailModalOrder.delivery_address?.lat || 25.5900},${deliveryDetailModalOrder.delivery_address?.lng || 83.5850}&travelmode=two-wheeler`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      padding: '10px',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '12.5px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Navigation size={15} /> Google Maps
                  </a>
                  <button
                    onClick={() => {
                      setDeliveryDetailModalOrder(null);
                      navigate(`/map/${deliveryDetailModalOrder.id}`);
                    }}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      padding: '10px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <MapPin size={15} /> In-App Map
                  </button>
                </div>
              )}

              {/* Doorstep UPI QR Button inside Modal (Only for Active Orders) */}
              {deliveryDetailModalOrder.status !== 'Delivered' && (
                <button
                  onClick={() => {
                    const target = deliveryDetailModalOrder;
                    setDeliveryDetailModalOrder(null);
                    setQrModalOrder(target);
                  }}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    padding: '11px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <QrCode size={16} /> Show Doorstep UPI QR
                </button>
              )}
            </div>

            {/* Ordered Items List */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={15} /> Items in this Order ({Array.isArray(deliveryDetailModalOrder.items) ? deliveryDetailModalOrder.items.length : 0})
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Array.isArray(deliveryDetailModalOrder.items) && deliveryDetailModalOrder.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12.5px'
                  }}>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>
                      {item.name} × {item.quantity || item.qty || 1}
                    </span>
                    <span style={{ fontWeight: '800', color: '#16a34a' }}>
                      ₹{((item.quantity || item.qty || 1) * (item.price || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comprehensive Customer Bill Breakdown for Rider */}
            {(() => {
              const itemsTotal = Array.isArray(deliveryDetailModalOrder.items)
                ? deliveryDetailModalOrder.items.reduce((sum, it) => sum + ((Number(it.price) || 0) * (it.qty || it.quantity || 1)), 0)
                : 0;
              const discount = Number(deliveryDetailModalOrder.discount_amount) || Number(deliveryDetailModalOrder.discountAmount) || 0;
              const coupon = deliveryDetailModalOrder.applied_coupon || deliveryDetailModalOrder.appliedCoupon || deliveryDetailModalOrder.coupon_code || deliveryDetailModalOrder.couponCode;
              const deliveryFee = Number(deliveryDetailModalOrder.delivery_charge) || Number(deliveryDetailModalOrder.deliveryCharge) || 0;
              const smallCartFee = Number(deliveryDetailModalOrder.small_cart_charge) || Number(deliveryDetailModalOrder.smallCartCharge) || 0;
              const grandTotal = Number(deliveryDetailModalOrder.total) || 0;

              return (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  fontSize: '12.5px'
                }}>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px', marginBottom: '2px' }}>
                    Customer Bill Breakdown
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Items Total</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>₹{itemsTotal || grandTotal}</span>
                  </div>
                  {(discount > 0 || coupon) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '700' }}>
                      <span>Discount / Coupon {coupon ? `(${coupon})` : ''}</span>
                      <span>-₹{discount > 0 ? discount : 'Applied'}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Delivery Partner Fee</span>
                    <span style={{ fontWeight: '700', color: deliveryFee === 0 ? '#16a34a' : '#0f172a' }}>
                      {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                    </span>
                  </div>
                  {smallCartFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Small Cart Fee</span>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>₹{smallCartFee}</span>
                    </div>
                  )}
                  <div style={{
                    borderTop: '1px solid #cbd5e1',
                    paddingTop: '8px',
                    marginTop: '2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <span style={{ fontWeight: '900', color: '#0f172a' }}>To Collect / Grand Total</span>
                    <span style={{ fontWeight: '900', color: '#16a34a', fontSize: '16px' }}>₹{grandTotal}</span>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer Slider / Status Action (Only for active deliveries) */}
            {deliveryDetailModalOrder.status === 'Delivered' ? (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
                <div style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <PackageCheck size={18} />
                  <span>Order Delivered Successfully</span>
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
                {deliveryDetailModalOrder.status === 'Out for Delivery' ? (
                  <SlideToAccept
                    onAccept={() => {
                      const target = deliveryDetailModalOrder;
                      setDeliveryDetailModalOrder(null);
                      handleMarkDelivered(target);
                    }}
                    label="Slide to Mark Delivered"
                    resetTrigger={sliderResetKey}
                  />
                ) : (deliveryDetailModalOrder.status || '').toLowerCase().startsWith('ready for pickup') ? (
                  <SlideToAccept
                    onAccept={() => {
                      const id = deliveryDetailModalOrder.id;
                      setDeliveryDetailModalOrder(null);
                      handleMarkOutForDelivery(id);
                    }}
                    label="Slide to Mark Out for Delivery"
                    resetTrigger={sliderResetKey}
                  />
                ) : !deliveryDetailModalOrder.accepted_by_rider ? (
                  <SlideToAccept
                    onAccept={() => {
                      const id = deliveryDetailModalOrder.id;
                      setDeliveryDetailModalOrder(null);
                      handleClaimOrder(id);
                    }}
                    label="Slide to Accept Order"
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
                    Waiting for Storekeeper: Ready for Pickup
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date-wise Delivery History Modal (Triggered by Clicking Earnings Dashboard Cards) */}
      {historyModalFilter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '88vh',
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--color-text)', margin: 0 }}>
                  {historyModalFilter === 'today' ? "Today's Delivery History" : historyModalFilter === 'month' ? "This Month's Delivery History" : "All-Time Delivery History"}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  Date-wise delivered drops and payouts
                </div>
              </div>
              <button
                onClick={() => setHistoryModalFilter(null)}
                style={{
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
            </div>

            {/* Filtered History Content grouped by Date */}
            {(() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

              const filtered = historyOrders.filter(o => {
                const d = new Date(o.created_at);
                if (historyModalFilter === 'today') {
                  return d.getTime() >= todayStart;
                } else if (historyModalFilter === 'month') {
                  return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📦</div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>No completed orders in this period</div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Completed deliveries will appear here automatically.</div>
                  </div>
                );
              }

              // Group orders by localized date
              const groups = {};
              filtered.forEach(o => {
                const dateKey = new Date(o.created_at).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(o);
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(groups).map(([dateLabel, dateOrders]) => {
                    const basePayout = Number(brandingConfig?.rider_base_payout) >= 0 ? Number(brandingConfig.rider_base_payout) : 30;
                    const dayPayout = dateOrders.length * basePayout;
                    return (
                      <div key={dateLabel} style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '10px' }}>
                          <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                            {dateLabel}
                          </span>
                          <span style={{ fontWeight: '900', fontSize: '13px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '8px' }}>
                            {dateOrders.length} drops • ₹{dayPayout}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {dateOrders.map(o => (
                            <div 
                              key={o.id}
                              onClick={() => {
                                setHistoryModalFilter(null);
                                setDeliveryDetailModalOrder(o);
                              }}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                              }}
                              title="Click to view full order and bill info"
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                                    #{o.id.slice(0, 6).toUpperCase()}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                                  {cleanAddress(o.delivery_address)}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: '900', fontSize: '13.5px', color: '#16a34a' }}>
                                  ₹30
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                  ₹{o.total} ({o.payment_method || 'COD'})
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
