import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import OrderIncomingModal from './OrderIncomingModal';
import { LayoutDashboard, ShoppingBag, User, Package } from 'lucide-react';
import './ShopkeeperLayout.css';

export default function ShopkeeperLayout({ profile, setProfile }) {
  return (
    <div className="shopkeeper-layout">
      {/* Realtime Order Alert Popup for Shopkeeper */}
      <OrderIncomingModal role="shopkeeper" />

      {/* Navigation Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand-box">
          <div className="sidebar-brand">
            Quick<span className="brand-accent">ly</span>
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
          <NavLink to="/products" className="nav-item">
            <Package size={18} />
            <span>Stock / Inventory</span>
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
