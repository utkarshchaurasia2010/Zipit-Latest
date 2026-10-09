import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import OrderIncomingModal from './OrderIncomingModal';
import { LayoutDashboard, ShoppingBag, User } from 'lucide-react';
import './ShopkeeperLayout.css';

export default function ShopkeeperLayout({ profile, setProfile }) {
  return (
    <div className="shopkeeper-layout">
      {/* Realtime Order Alert Popup for Shopkeeper */}
      <OrderIncomingModal role="shopkeeper" />

      {/* Navigation Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand" style={{ padding: '0 12px 16px', fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
          Zipit <span style={{ color: '#EAB308', fontSize: 13, background: '#FEF08A', padding: '2px 8px', borderRadius: 12 }}>SHOP</span>
        </div>

        <NavLink to="/" end className="nav-item">
          <LayoutDashboard size={18} /> Overview
        </NavLink>
        <NavLink to="/orders" className="nav-item">
          <ShoppingBag size={18} /> Orders
        </NavLink>
        <NavLink to="/profile" className="nav-item">
          <User size={18} /> Profile
        </NavLink>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
