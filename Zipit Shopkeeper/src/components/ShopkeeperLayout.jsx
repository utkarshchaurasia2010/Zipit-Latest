import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import OrderIncomingModal from './OrderIncomingModal';
import { LayoutDashboard, ShoppingBag, User, Package } from 'lucide-react';
import { db, supabase } from '../services/db';
import './ShopkeeperLayout.css';

export default function ShopkeeperLayout({ profile, setProfile }) {
  const [branding, setBranding] = useState(() => {
    try {
      const stored = localStorage.getItem('zipit_cached_branding');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    db.branding.get().then(b => {
      if (b) setBranding(b);
    }).catch(() => {});

    const channel = supabase.channel('shopkeeper-branding-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'id=eq.00000000-0000-0000-0000-000000000001'
      }, () => {
        db.branding.get().then(b => {
          if (b) setBranding(b);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const appName = branding?.app_name || 'Quickly';
  const logoUrl = branding?.shopkeeper_logo;

  return (
    <div className="shopkeeper-layout">
      {/* Realtime Order Alert Popup for Shopkeeper */}
      <OrderIncomingModal role="shopkeeper" />

      {/* Navigation Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand-box">
          <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ height: '28px', width: 'auto', borderRadius: '6px', objectFit: 'contain' }} />
            ) : null}
            <span>{appName}</span>
            <span className="brand-badge">STORE</span>
          </div>
          <div className="store-status-indicator">
            <span className="live-dot"></span>
            <span>Live Store Operations</span>
          </div>
        </div>

        <div className="sidebar-nav-links">
          <NavLink to="/" end className="nav-item">
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/orders" className="nav-item">
            <ShoppingBag size={18} />
            <span>Orders Queue</span>
          </NavLink>
          <NavLink to="/profile" className="nav-item">
            <User size={18} />
            <span>Store Profile</span>
          </NavLink>
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
