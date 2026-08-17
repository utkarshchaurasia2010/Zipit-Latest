import React, { useState, useEffect } from 'react';
import { PackageCheck, ShoppingBag, ChevronLeft, RotateCcw, Download } from 'lucide-react';
import { db, supabase } from '../services/db';
import { downloadInvoice } from '../utils/invoice';
import { useToast } from '../context/ToastContext';
import './HistoryPage.css';

const PastOrdersPage = ({ navigate, updateCartQty }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const PAST_STATUSES = ['Delivered', 'Cancelled', 'Cancellation Rejected', 'Refunded'];

  useEffect(() => {
    const fetchOrders = async () => {
      const data = await db.orders.getAll();
      const past = (data || []).filter(o => PAST_STATUSES.includes(o.status));
      setOrders(past);
      setLoading(false);
    };
    fetchOrders();

    const channel = supabase.channel(`past-orders-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  const handleReorder = (order) => {
    order.items.forEach(item => {
      // Add each item's quantity to the cart. We assume updateCartQty(item, qty) handles new/existing properly if passed the absolute qty,
      // wait, `updateCartQty` takes `(product, qty)`. Usually qty is the absolute total, or maybe it replaces it.
      // If we just loop through and `updateCartQty(item, item.qty)`, it will set the cart qty to the past order's qty.
      updateCartQty(item, item.qty);
    });
    showToast(`Reordered ${order.items.length} items`);
    navigate('/checkout');
  };

  return (
    <div className="history-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', justifyContent: 'flex-start' }}>
        <button className="back-btn" onClick={() => navigate('/profile')} style={{ padding: '8px', margin: 0 }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '17px', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Order History</h2>
      </header>

      <div className="orders-list">
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-light)' }}>
            <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontWeight: 600 }}>No past orders yet.</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Your delivered and cancelled orders will appear here.</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="order-card past-order-card" style={{ opacity: 1 }}>
              <div className="order-card-header">
                <div className="order-status">
                  <PackageCheck
                    size={16}
                    color={order.status === 'Cancelled' || order.status === 'Cancellation Rejected' ? '#E23744' : 'var(--color-text-light)'}
                  />
                  <span
                    className="status-text"
                    style={{ color: order.status === 'Cancelled' || order.status === 'Cancellation Rejected' ? '#E23744' : 'var(--color-text-light)' }}
                  >
                    {order.status}
                  </span>
                </div>
                <span className="order-date">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="order-details">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="order-items" style={{ fontWeight: 700 }}>Order #{order.id.split('-')[0].toUpperCase()}</p>
                  <h4 className="order-amount">₹{order.total}</h4>
                </div>
                <div style={{ marginTop: 8 }}>
                  {order.items.map(item => (
                    <div key={item.id} style={{ fontSize: 13, color: 'var(--color-text-light)' }}>
                      {item.qty}x {item.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-light)' }}>Paid via {order.payment_method}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                {order.items && order.items.length > 0 ? (
                  <button 
                    onClick={() => downloadInvoice(order)}
                    style={{
                      background: 'rgba(150, 150, 150, 0.15)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(150, 150, 150, 0.2)',
                      color: 'var(--color-text)',
                      borderRadius: '12px',
                      padding: '10px 0',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <Download size={16} /> Invoice
                  </button>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(150, 150, 150, 0.05)', borderRadius: '12px', border: '1px dashed rgba(150,150,150,0.2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-light)', fontWeight: '500' }}>
                      Unavailable
                    </span>
                  </div>
                )}
                
                <button 
                  onClick={() => handleReorder(order)}
                  style={{
                    background: 'rgba(248, 203, 70, 0.2)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(248, 203, 70, 0.4)',
                    color: '#B47800', // Darker yellow/amber for contrast
                    borderRadius: '12px',
                    padding: '10px 0',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 16px rgba(248, 203, 70, 0.1)'
                  }}
                >
                  <RotateCcw size={16} /> Reorder
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PastOrdersPage;
