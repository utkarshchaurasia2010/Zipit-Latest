import React, { useState, useEffect } from 'react';
import { PackageCheck, ShoppingBag, ChevronLeft, Check, X, AlertCircle } from 'lucide-react';
import { db, supabase } from '../services/db';
import { playBellSound } from '../utils/siren';
import { PageSkeleton } from './SkeletonLoader';
import './HistoryPage.css';

const PlacedOrdersPage = ({ navigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await db.orders.getAll();
        setOrders(data || []);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    };
    
    fetchOrders();

    const channel = supabase.channel(`customer-orders-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        playBellSound();
        fetchOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        playBellSound();
        fetchOrders();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    // Fallback polling every 2 seconds to guarantee realtime sync if Supabase Realtime is not fully enabled in the DB
    const interval = setInterval(fetchOrders, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <PageSkeleton type="orders" />;
  }

  return (
    <div className="history-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 16px' }}>
        <button className="back-btn" onClick={() => navigate(-1)} style={{ padding: '8px', margin: 0 }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Your Orders</h2>
      </header>
      <div className="orders-list">
        {error && <div style={{color:'red', padding: 20}}>Error: Did you run the SQL script? {error}</div>}
        {orders.length === 0 && !error ? (
          <div style={{textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-light)'}}>
            <ShoppingBag size={48} style={{opacity: 0.2, marginBottom: 16}} />
            <p>No orders placed yet.</p>
          </div>
        ) : (
          <>
            {orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length > 0 && (
              <div className="orders-section">
                <h3 className="section-title">Active Orders</h3>
                {orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').map(order => {
                  const isCancellationReq = order.status === 'Cancellation Requested' || order.status === 'Cancellation requested' || order.substitution_status === 'CANCELLATION_REQUESTED';
                  const isCancellationRej = order.status === 'Cancellation Rejected' || order.substitution_status === 'CANCELLATION_REJECTED';
                  const isRefundInit = order.status === 'Refund Requested' || order.status === 'Refund Initiated' || order.substitution_status === 'REFUND_PENDING';
                  const displayStatus = isCancellationReq ? 'Cancellation requested' : isCancellationRej ? 'Cancellation Rejected' : isRefundInit ? 'Refund Initiated' : order.status;

                  return (
                    <div key={order.id} className="order-card active-order-card">
                      <div className="order-card-header">
                        <div className={`order-status ${isCancellationReq ? 'pending-cancel' : 'active-status'}`}>
                          <PackageCheck 
                            size={16} 
                            color={isCancellationReq ? '#F59E0B' : (isCancellationRej ? '#E23744' : '#0c831f')} 
                          />
                          <span 
                            className="status-text" 
                            style={{color: isCancellationReq ? '#F59E0B' : (isCancellationRej ? '#E23744' : '#0c831f')}}
                          >
                            {displayStatus}
                          </span>
                        </div>
                        <span className="order-date">{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                      <div className="order-details">
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <p className="order-items" style={{fontWeight: 700}}>Order ID: {order.id.split('-')[0]}</p>
                          <h4 className="order-amount">₹{order.total}</h4>
                        </div>
                        <div style={{marginTop: 8}}>
                          {order.items.map(item => (
                            <div key={item.id} style={{fontSize: 13, color: 'var(--color-text-light)'}}>
                              {item.qty}x {item.name}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {isCancellationReq ? (
                        <div className="order-timeline" style={{justifyContent: 'center'}}>
                          <div className="timeline-step cancelled">
                             <div className="timeline-icon-container"><X size={14} /></div>
                             <span className="timeline-label" style={{maxWidth: '100%', marginTop: '4px'}}>Cancellation Pending Admin Review</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="order-timeline">
                            <div className="timeline-step completed">
                               <div className="timeline-icon-container"><Check size={14} /></div>
                               <span className="timeline-label">Preparing</span>
                            </div>
                            <div className={`timeline-step ${['Out for Delivery', 'Delivered'].includes(order.status) ? 'completed' : ''}`}>
                               <div className="timeline-icon-container"><Check size={14} /></div>
                               <span className="timeline-label">On the way</span>
                            </div>
                            <div className={`timeline-step ${order.status === 'Delivered' ? 'completed' : ''}`}>
                               <div className="timeline-icon-container"><Check size={14} /></div>
                               <span className="timeline-label">Delivered</span>
                            </div>
                          </div>
                          {isCancellationRej && (
                            <div className="cancellation-rejected-alert">
                              <AlertCircle size={16} />
                              Cancellation was denied by the store.
                            </div>
                          )}
                        </>
                      )}

                      <div className="order-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                        <span style={{fontSize: 12, color: 'var(--color-text-light)'}}>
                          Paid via {order.payment_method}
                        </span>
                        {(order.status === 'Placed' || order.status === 'Payment Pending' || order.status === 'Preparing') && !isCancellationReq && !isCancellationRej && !isRefundInit && (
                          <button 
                            onClick={async () => {
                              if (!window.confirm('Do you want to request cancellation for this order?')) return;

                              try {
                                const res = await supabase.from('orders').update({
                                  status: 'Cancellation requested',
                                  substitution_status: 'CANCELLATION_REQUESTED'
                                }).eq('id', order.id);

                                if (res.error && res.error.code === '23514') {
                                  await supabase.from('orders').update({
                                    substitution_status: 'CANCELLATION_REQUESTED'
                                  }).eq('id', order.id);
                                }

                                alert('Your order is requested for cancellation.');
                                const refreshed = await db.orders.getAll();
                                setOrders(refreshed);
                              } catch (e) {
                                alert('Your order is requested for cancellation.');
                              }
                            }}
                            style={{
                              background: '#FEF3F2',
                              color: '#B42318',
                              border: '1px solid #FCA5A5',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '12px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Request Cancellation
                          </button>
                        )}
                      </div>

                      {order.status === 'Cancelled' && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#b91c1c',
                          lineHeight: '1.4'
                        }}>
                          {/upi|online/i.test(order.payment_method || '')
                            ? 'Your refund will be initiated shortly.'
                            : 'Your refund will be initiated if you share your UPI Id/Account Details on our Support Whatsapp'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled').length > 0 && (
              <div className="orders-section" style={{marginTop: 24}}>
                <h3 className="section-title" style={{fontSize: 14, color: 'var(--color-text-light)'}}>Past Orders</h3>
                {orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled').map(order => (
                  <div key={order.id} className="order-card past-order-card">
                    <div className="order-card-header">
                      <div className="order-status">
                        <PackageCheck size={16} color={order.status === 'Cancelled' ? '#E23744' : 'var(--color-text-light)'} />
                        <span className="status-text" style={{color: order.status === 'Cancelled' ? '#E23744' : 'var(--color-text-light)'}}>{order.status}</span>
                      </div>
                      <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="order-details">
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <p className="order-items" style={{fontWeight: 700}}>Order ID: {order.id.split('-')[0]}</p>
                        <h4 className="order-amount">₹{order.total}</h4>
                      </div>
                      <div style={{marginTop: 8}}>
                        {order.items.map(item => (
                          <div key={item.id} style={{fontSize: 13, color: 'var(--color-text-light)'}}>
                            {item.qty}x {item.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.status === 'Cancelled' && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#b91c1c',
                        lineHeight: '1.4'
                      }}>
                        {/upi|online/i.test(order.payment_method || '')
                          ? 'Your refund will be initiated shortly.'
                          : 'Your refund will be initiated if you share your UPI Id/Account Details on our Support Whatsapp'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default PlacedOrdersPage;
