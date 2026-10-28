import React, { useState, useEffect } from 'react';
import { PackageCheck, ShoppingBag, ChevronLeft, Check, X, AlertCircle } from 'lucide-react';
import { db, supabase } from '../services/db';
import { playBellSound } from '../utils/siren';
import { PageSkeleton } from './SkeletonLoader';
import { useToast } from '../context/ToastContext';
import './HistoryPage.css';

const PlacedOrdersPage = ({ navigate }) => {
  const { showToast } = useToast();
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

    // Fallback polling every 5 seconds to guarantee sync while WebSocket handles instantaneous events
    const interval = setInterval(fetchOrders, 5000);

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
            {orders.filter(o => !['Delivered', 'Cancelled', 'Refunded'].includes(o.status) || o.substitution_status === 'CANCELLATION_REQUESTED').length > 0 && (
              <div className="orders-section">
                <h3 className="section-title">Active Orders</h3>
                {orders.filter(o => !['Delivered', 'Cancelled', 'Refunded'].includes(o.status) || o.substitution_status === 'CANCELLATION_REQUESTED').map(order => {
                  const isExplicitRefund = order.status === 'Refund Initiated' || order.status === 'Refund Requested' || order.status === 'Refunded';
                  const isExplicitCancelled = order.status === 'Cancelled';
                  const isExplicitRejected = order.status === 'Cancellation Rejected';
                  const isExplicitCancelReq = order.status === 'Cancellation Requested' || order.status === 'Cancellation requested';

                  const isCancellationReq = !isExplicitRefund && !isExplicitCancelled && !isExplicitRejected && (isExplicitCancelReq || order.substitution_status === 'CANCELLATION_REQUESTED');
                  const isCancellationRej = !isExplicitRefund && !isExplicitCancelled && (isExplicitRejected || order.substitution_status === 'CANCELLATION_REJECTED');
                  const isRefundInit = isExplicitRefund || order.substitution_status === 'REFUND_PENDING' || order.substitution_status === 'REFUND_INITIATED';
                  const isCancelled = order.status === 'Cancelled' || order.substitution_status === 'CANCELLED';
                  const isRefunded = order.status === 'Refunded' || order.substitution_status === 'REFUNDED';

                  const displayStatus = isRefundInit 
                    ? (order.status === 'Refunded' ? 'Refunded' : 'Refund Initiated')
                    : isCancellationReq 
                      ? 'Cancellation requested' 
                      : isCancellationRej 
                        ? 'Cancellation Rejected' 
                        : order.status;

                  return (
                    <div key={order.id} className="order-card active-order-card">
                      <div className="order-card-header">
                        <div className={`order-status ${isCancellationReq ? 'pending-cancel' : 'active-status'}`}>
                          <PackageCheck 
                            size={16} 
                            color={isCancellationReq ? '#F59E0B' : (isCancellationRej || isCancelled ? '#E23744' : isRefundInit ? '#10B981' : '#0c831f')} 
                          />
                          <span 
                            className="status-text" 
                            style={{color: isCancellationReq ? '#F59E0B' : (isCancellationRej || isCancelled ? '#E23744' : isRefundInit ? '#10B981' : '#0c831f')}}
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

                                showToast('Your order is requested for cancellation.', 'Cancellation Requested');
                                const refreshed = await db.orders.getAll();
                                setOrders(refreshed);
                              } catch (e) {
                                showToast('Your order is requested for cancellation.', 'Cancellation Requested');
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

                      {/* Info Alert Notes */}
                      {isRefunded && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#059669',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Check size={15} style={{ flexShrink: 0 }} />
                          <span>Refund Completed: The amount has been successfully refunded.</span>
                        </div>
                      )}

                      {isRefundInit && !isRefunded && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#059669',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>
                            {/upi|online/i.test(order.payment_method || '')
                              ? 'Refund Initiated: The amount will be credited to your original payment method shortly.'
                              : 'Refund Initiated: Please share your UPI ID / Account details on our Support WhatsApp to receive your refund.'}
                          </span>
                        </div>
                      )}

                      {isCancelled && !isRefundInit && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#b91c1c',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>
                            {/upi|online/i.test(order.payment_method || '')
                              ? 'Order Cancelled: Your refund will be initiated shortly.'
                              : 'Order Cancelled: Your refund will be initiated if you share your UPI Id/Account Details on our Support Whatsapp.'}
                          </span>
                        </div>
                      )}

                      {isCancellationReq && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#d97706',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>Cancellation request submitted. Waiting for store confirmation.</span>
                        </div>
                      )}

                      {isCancellationRej && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#b91c1c',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>Cancellation was denied by the store. Your order is being processed.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {orders.filter(o => ['Delivered', 'Cancelled', 'Refunded'].includes(o.status) && o.substitution_status !== 'CANCELLATION_REQUESTED').length > 0 && (
              <div className="orders-section" style={{marginTop: 24}}>
                <h3 className="section-title" style={{fontSize: 14, color: 'var(--color-text-light)'}}>Past Orders</h3>
                {orders.filter(o => ['Delivered', 'Cancelled', 'Refunded'].includes(o.status) && o.substitution_status !== 'CANCELLATION_REQUESTED').map(order => {
                  const isRefunded = order.status === 'Refunded' || order.substitution_status === 'REFUNDED';
                  const isRefundInit = order.status === 'Refund Initiated' || order.status === 'Refund Requested' || order.substitution_status === 'REFUND_INITIATED' || order.substitution_status === 'REFUND_PENDING';
                  const isCancelled = order.status === 'Cancelled' || order.substitution_status === 'CANCELLED';
                  const pastStatusColor = isRefunded || isRefundInit ? '#10B981' : isCancelled ? '#E23744' : 'var(--color-text-light)';
                  const pastStatusLabel = isRefunded ? 'Refunded' : isRefundInit ? 'Refund Initiated' : order.status;

                  return (
                    <div key={order.id} className="order-card past-order-card">
                      <div className="order-card-header">
                        <div className="order-status">
                          <PackageCheck size={16} color={pastStatusColor} />
                          <span className="status-text" style={{color: pastStatusColor}}>{pastStatusLabel}</span>
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

                      {/* Info Alert Notes in Past Orders */}
                      {isRefunded && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#059669',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Check size={15} style={{ flexShrink: 0 }} />
                          <span>Refund Completed: The amount has been credited to your account.</span>
                        </div>
                      )}

                      {isRefundInit && !isRefunded && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#059669',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>
                            {/upi|online/i.test(order.payment_method || '')
                              ? 'Refund Initiated: The amount will be credited to your original payment method shortly.'
                              : 'Refund Initiated: Please share your UPI ID / Account details on our Support WhatsApp to receive your refund.'}
                          </span>
                        </div>
                      )}

                      {isCancelled && !isRefundInit && !isRefunded && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#b91c1c',
                          lineHeight: '1.4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0 }} />
                          <span>
                            {/upi|online/i.test(order.payment_method || '')
                              ? 'Order Cancelled: Your refund will be initiated shortly.'
                              : 'Order Cancelled: Your refund will be initiated if you share your UPI Id/Account Details on our Support Whatsapp.'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default PlacedOrdersPage;
