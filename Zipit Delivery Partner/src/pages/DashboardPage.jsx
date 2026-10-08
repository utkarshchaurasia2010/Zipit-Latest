import React, { useEffect, useState } from 'react';
import { supabase } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { MapPin, LogOut, PackageCheck, Zap } from 'lucide-react';

export default function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [isOnline, setIsOnline] = useState(localStorage.getItem('partner_online') === 'true');
  const navigate = useNavigate();

  const toggleOnline = () => {
    const newState = !isOnline;
    setIsOnline(newState);
    localStorage.setItem('partner_online', String(newState));
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

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders')
      .select('*')
      .in('status', ['Preparing', 'Out for Delivery'])
      .order('created_at', { ascending: false });
    
    // RIDER: Only show delivery orders, exclude store pickup
    const deliveryOnly = (data || []).filter(o => {
      const isPickup = o.delivery_address?.is_pickup === true || o.delivery_address?.order_type === 'PICKUP';
      return !isPickup;
    });
    setOrders(deliveryOnly);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>Active Tasks</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={toggleOnline}
            style={{
              padding: '8px 16px',
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
          
          <button onClick={handleLogout} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

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
        ) : orders.length === 0 ? (
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
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
              {orders.length} Active Request{orders.length > 1 ? 's' : ''}
            </h2>
            
            {orders.map(order => (
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
                    background: order.status === 'Preparing' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                    color: order.status === 'Preparing' ? 'var(--color-warning)' : 'var(--color-success)',
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
                    {order.delivery_address?.details?.split('\n---TAG:')[0] || 'Customer Address'}
                  </div>
                </div>
                
                <button 
                  onClick={() => navigate(`/order/${order.id}`)}
                  style={{ 
                    width: '100%', 
                    background: 'var(--color-primary)', 
                    color: '#000', 
                    border: 'none', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    fontWeight: '700',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(248, 203, 70, 0.25)'
                  }}
                >
                  View Details & Track
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
