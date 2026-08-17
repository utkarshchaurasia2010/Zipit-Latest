import React, { useState, useEffect } from 'react';
import { PackageCheck, ShoppingBag, ChevronLeft, Check, X, AlertCircle } from 'lucide-react';
import { db, supabase } from '../services/db';
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchOrders)
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
    return <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center'}}>Loading orders...</div>;
  }

  return (
    <div className="history-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 16px' }}>
        <button className="back-btn" onClick={() => navigate('/profile')} style={{ padding: '8px', margin: 0 }}>
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
                {orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').map(order => (
                  <div key={order.id} className="order-card active-order-card">
                    <div className="order-card-header">
                      <div className={`order-status ${order.status === 'Cancellation Requested' ? 'pending-cancel' : 'active-status'}`}>
                        <PackageCheck 
                          size={16} 
                          color={order.status === 'Cancellation Requested' ? '#F59E0B' : (order.status === 'Cancellation Rejected' ? '#E23744' : '#0c831f')} 
                        />
                        <span 
                          className="status-text" 
                          style={{color: order.status === 'Cancellation Requested' ? '#F59E0B' : (order.status === 'Cancellation Rejected' ? '#E23744' : '#0c831f')}}
                        >
                          {order.status}
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
                    
                    {order.status === 'Cancellation Requested' ? (
                      <div className="order-timeline" style={{justifyContent: 'center'}}>
                        <div className="timeline-step cancelled">
                           <div className="timeline-icon-container"><X size={14} /></div>
                           <span className="timeline-label" style={{maxWidth: '100%', marginTop: '4px'}}>Cancellation Pending</span>
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
                        {order.status === 'Cancellation Rejected' && (
                          <div className="cancellation-rejected-alert">
                            <AlertCircle size={16} />
                            Cancellation was denied by the store.
                          </div>
                        )}
                      </>
                    )}

                    <div className="order-footer">
                      <span style={{fontSize: 12, color: 'var(--color-text-light)', marginTop: 8}}>
                        Paid via {order.payment_method}
                      </span>
                      {order.status === 'Preparing' && (
                        <button 
                          onClick={async () => {
                            await db.orders.updateStatus(order.id, 'Cancellation Requested');
                            const refreshed = await db.orders.getAll();
                            setOrders(refreshed);
                          }}
                          style={{
                            background: '#FEF3F2',
                            color: '#B42318',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginTop: '8px'
                          }}
                        >
                          Request Cancellation
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
