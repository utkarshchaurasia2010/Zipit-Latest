import React from 'react';
import { Home, LayoutGrid, Navigation, ShoppingCart } from 'lucide-react';
import './BottomNav.css';

const BottomNav = ({ activeTab, navigate, openCart, isNavHidden }) => {
  return (
    <nav className={`bottom-nav ${isNavHidden ? 'hidden' : ''}`} aria-label="Bottom Navigation">
      <div 
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} 
        onClick={() => navigate('/')}
        role="button"
        tabIndex={0}
        aria-label="Home"
      >
        <Home size={22} strokeWidth={activeTab === 'home' ? 2.4 : 1.7} />
        <span className="nav-label">Home</span>
      </div>
      <div 
        className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`} 
        onClick={() => navigate('/categories')}
        role="button"
        tabIndex={0}
        aria-label="Categories"
      >
        <LayoutGrid size={22} strokeWidth={activeTab === 'categories' ? 2.4 : 1.7} />
        <span className="nav-label">Categories</span>
      </div>
      <div 
        className={`nav-item ${activeTab === 'track' ? 'active' : ''}`} 
        onClick={() => navigate('/track')}
        role="button"
        tabIndex={0}
        aria-label="Track Order"
      >
        <Navigation size={22} strokeWidth={activeTab === 'track' ? 2.4 : 1.7} />
        <span className="nav-label">Track</span>
      </div>
      <div 
        className="nav-item" 
        onClick={openCart}
        role="button"
        tabIndex={0}
        aria-label="Cart"
      >
        <ShoppingCart size={22} strokeWidth={1.7} />
        <span className="nav-label">Cart</span>
      </div>
    </nav>
  );
};

export default React.memo(BottomNav);
