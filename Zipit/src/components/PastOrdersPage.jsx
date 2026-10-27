import React, { useState, useEffect } from 'react';
import { PackageCheck, ShoppingBag, ChevronLeft, RotateCcw, Download } from 'lucide-react';
import { db, supabase } from '../services/db';
import { downloadInvoice } from '../utils/invoice';
import { useToast } from '../context/ToastContext';
import { PageSkeleton } from './SkeletonLoader';
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
    return <PageSkeleton type="orders" />;
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
        <button className="back-btn" onClick={() => navigate(-1)} style={{ padding: '8px', margin: 0 }}>
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
          orders.map(order => {
            const isDelivered = order.status === 'Delivered';
            const isCancelled = order.status === 'Cancelled' || order.status === 'Cancellation Rejected';
            const statusColor = isDelivered ? '#10B981' : isCancelled ? '#EF4444' : '#F59E0B';

            return (
              <div key={order.id} className="order-card past-order-card" style={{ opacity: 1, padding: '16px 18px', borderRadius: '18px', border: '1px solid var(--color-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Header Row: Status badge & Date */}
                <div className="order-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--color-border)', paddingBottom: '10px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${statusColor}18`, color: statusColor, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                    <PackageCheck size={14} color={statusColor} />
                    <span>{order.status}</span>
                  </div>
                  <span className="order-date" style={{ fontSize: '11.5px', color: 'var(--color-text-light)', fontWeight: 600 }}>
                    {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Main Details: Order ID, Total, Item summary */}
                <div className="order-details" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text)', letterSpacing: '0.3px' }}>
                      Order #{order.id.split('-')[0].toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: '16px', color: 'var(--color-text)' }}>
                      ₹{order.total}
                    </span>
                  </div>

                  {/* Items List Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-muted)', padding: '10px 12px', borderRadius: '12px' }}>
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          <strong style={{ color: '#10B981', marginRight: '4px' }}>{item.qty}×</strong> {item.name}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>
                          ₹{item.price ? item.price * item.qty : ''}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 700, marginTop: '2px' }}>
                        +{order.items.length - 3} more items
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Payment info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-light)' }}>
                  <span>Payment: <strong style={{ color: 'var(--color-text)' }}>{order.payment_method || 'Online'}</strong></span>
                  <span>{order.delivery_address?.type ? `Delivered to ${order.delivery_address.type}` : ''}</span>
                </div>

                {/* Actions: Download Invoice & Reorder */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '6px' }}>
                  {order.items && order.items.length > 0 ? (
                    <button 
                      onClick={() => downloadInvoice(order, showToast)}
                      style={{
                        background: 'var(--color-surface-muted)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        borderRadius: '12px',
                        padding: '10px 0',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <Download size={15} /> Invoice
                    </button>
                  ) : null}
                  
                  <button 
                    onClick={() => handleReorder(order)}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '12px',
                      padding: '10px 0',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <RotateCcw size={15} /> Reorder
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PastOrdersPage;
