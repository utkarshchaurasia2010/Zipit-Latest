import React, { useEffect, useState } from 'react';
import { supabase } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { MapPin, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const navigate = useNavigate();

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

  const fetchOrders = async () => {
    // We only show orders that are Preparing or Out for Delivery.
    // In a real app, we'd assign an order to a specific partner, but for now we list available/active ones.
    const { data } = await supabase.from('orders')
      .select('*')
      .in('status', ['Preparing', 'Out for Delivery'])
      .order('created_at', { ascending: false });
    
    setOrders(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Active Orders</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => setIsOnline(!isOnline)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              background: isOnline ? '#22c55e' : '#e2e8f0',
              color: isOnline ? '#fff' : '#64748b',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </button>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ef4444' }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {!isOnline && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          Go online to start receiving delivery requests.
        </div>
      )}

      {isOnline && orders.length === 0 && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          No active orders at the moment.
        </div>
      )}

      {isOnline && orders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map(order => (
            <div key={order.id} style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '15px' }}>Order #{order.id.slice(0,6)}</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>{new Date(order.created_at).toLocaleTimeString()}</div>
                </div>
                <div style={{ 
                  background: order.status === 'Preparing' ? '#fef3c7' : '#dcfce7',
                  color: order.status === 'Preparing' ? '#d97706' : '#15803d',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  {order.status}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
                <MapPin size={16} color="#F8CB46" style={{ marginTop: '2px' }} />
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>
                  {order.delivery_address?.details?.split('\n---TAG:')[0] || 'Unknown Address'}
                </div>
              </div>
              
              <button 
                onClick={() => navigate(`/order/${order.id}`)}
                style={{ 
                  width: '100%', 
                  background: '#F8CB46', 
                  color: '#000', 
                  border: 'none', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                View Map & Track
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
