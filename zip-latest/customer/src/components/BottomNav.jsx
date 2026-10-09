import React from 'react';
import { Home, LayoutGrid, Navigation, ShoppingCart } from 'lucide-react';
import './BottomNav.css';

const BottomNav = ({ activeTab, navigate, openCart, isNavHidden }) => {
  return (
    <nav className={`bottom-nav ${isNavHidden ? 'hidden' : ''}`}>
      <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => navigate('/')}>
        <Home size={22} strokeWidth={activeTab === 'home' ? 2.2 : 1.5} />
        <span className="nav-label">Home</span>
      </div>
      <div className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => navigate('/categories')}>
        <LayoutGrid size={22} strokeWidth={activeTab === 'categories' ? 2.2 : 1.5} />
        <span className="nav-label">Categories</span>
      </div>
      <div className={`nav-item ${activeTab === 'track' ? 'active' : ''}`} onClick={() => navigate('/track')}>
        <Navigation size={22} strokeWidth={activeTab === 'track' ? 2.2 : 1.5} />
        <span className="nav-label">Track</span>
      </div>
      <div className="nav-item" onClick={openCart}>
        <ShoppingCart size={22} strokeWidth={1.5} />
        <span className="nav-label">Cart</span>
      </div>
    </nav>
  );
};

export default BottomNav;
