import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Grid, List, Tag, LogOut, Settings, Bell, Search, X, RefreshCcw, Sun, Moon } from 'lucide-react';
import { db, supabase } from '../services/db';
import './AdminLayout.css';

const AdminLayout = ({ profile, setProfile }) => {
  const navigate = useNavigate();
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ products: [], categories: [], orders: [] });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  
  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('admin_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setIsSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time Notification Listener
  useEffect(() => {
    const fetchInitialRecent = async () => {
      // Just fetch last 5 orders to populate initially if we want, or start empty. Let's start empty for truly "new" notifications while active, or fetch 5.
      const recent = await db.orders.getAllAdmin();
      const top5 = recent.slice(0, 5);
      setNotifications(top5);
    };
    fetchInitialRecent();

    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 10)); // keep last 10
        setUnreadCount(prev => prev + 1);
        
        // Native browser notification if granted
        if (Notification.permission === 'granted') {
          new Notification('New Order Received!', { body: `Order #${payload.new.id.split('-')[0]}` });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.new.status === 'Cancellation Requested' && payload.old.status !== 'Cancellation Requested') {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10)); 
          setUnreadCount(prev => prev + 1);
          
          if (Notification.permission === 'granted') {
            new Notification('Refund Requested!', { body: `Order #${payload.new.id.split('-')[0]} wants to cancel` });
          }
        }
      })
      .subscribe();
      
    // Ask for notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => supabase.removeChannel(channel);
  }, []);

  // Search Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults({ products: [], categories: [], orders: [] });
        return;
      }
      
      const q = searchQuery.toLowerCase();
      
      const [allProds, allCats, allOrders] = await Promise.all([
        db.products.getAll(),
        db.categories.getAll(),
        db.orders.getAllAdmin()
      ]);
      
      setSearchResults({
        products: allProds.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5),
        categories: allCats.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5),
        orders: allOrders.filter(o => o.id.toLowerCase().includes(q) || (o.status && o.status.toLowerCase().includes(q))).slice(0, 5)
      });
    };
    
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLogout = async () => {
    localStorage.removeItem('zipit_admin_logged_in');
    await supabase.auth.signOut();
    setProfile(null);
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Categories', path: '/categories', icon: <Grid size={20} /> },
    { name: 'Products', path: '/products', icon: <List size={20} /> },
    { name: 'Pinnacle Showcase', path: '/grid-products', icon: <Grid size={20} /> },
    { name: 'Bestsellers', path: '/bestsellers', icon: <Tag size={20} /> },
    { name: 'Banners', path: '/banners', icon: <LayoutDashboard size={20} /> },
    { name: 'Coupons', path: '/coupons', icon: <Tag size={20} /> },
    { name: 'Refunds', path: '/refunds', icon: <RefreshCcw size={20} /> },
  ];

  // Pending Refund Badge State
  const [pendingRefundCount, setPendingRefundCount] = useState(0);

  useEffect(() => {
    const fetchRefundCount = async () => {
      const allOrders = await db.orders.getAllAdmin();
      const pendingRefunds = allOrders.filter(o => 
        o.status === 'Refund Requested' || 
        o.status === 'Cancellation Requested'
      );
      setPendingRefundCount(pendingRefunds.length);
    };

    fetchRefundCount();

    const channel = supabase.channel('refund-badge-listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchRefundCount();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <img src="/logo_full.png" alt="Zipit Admin" className="sidebar-logo" />
          <span className="admin-badge">Admin Workspace</span>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-title">MAIN MENU</p>
          {navItems.map(item => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
              style={{ position: 'relative' }}
            >
              {item.icon}
              <span>{item.name}</span>
              {item.path === '/refunds' && pendingRefundCount > 0 && (
                <span className="sidebar-refund-badge">
                  {pendingRefundCount > 9 ? '9+' : pendingRefundCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-user-profile">
            <div className="admin-avatar">{profile?.name?.charAt(0) || 'A'}</div>
            <div className="admin-user-info">
              <h4>{profile?.name || 'Administrator'}</h4>
              <p>Super Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="search-container" ref={searchRef}>
            <div className={`search-bar ${isSearchOpen && searchQuery ? 'focused' : ''}`}>
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search orders, products, or categories..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
              />
              {searchQuery && (
                <X size={16} className="search-clear" onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} />
              )}
            </div>
            
            {/* Search Dropdown */}
            {isSearchOpen && searchQuery && (
              <div className="search-dropdown">
                {searchResults.orders.length > 0 && (
                  <div className="search-group">
                    <h4>Orders</h4>
                    {searchResults.orders.map(o => (
                      <div key={o.id} className="search-result-item" onClick={() => { navigate(`/orders?search=${encodeURIComponent(o.id.split('-')[0])}`); setIsSearchOpen(false); }}>
                        <ShoppingBag size={14} /> Order #{o.id.split('-')[0]} - <span className="status-badge">{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.products.length > 0 && (
                  <div className="search-group">
                    <h4>Products</h4>
                    {searchResults.products.map(p => (
                      <div key={p.id} className="search-result-item" onClick={() => { navigate(`/products?search=${encodeURIComponent(p.name)}`); setIsSearchOpen(false); }}>
                        <List size={14} /> {p.name}
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.categories.length > 0 && (
                  <div className="search-group">
                    <h4>Categories</h4>
                    {searchResults.categories.map(c => (
                      <div key={c.id} className="search-result-item" onClick={() => { navigate('/categories'); setIsSearchOpen(false); }}>
                        <Grid size={14} /> {c.name}
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.orders.length === 0 && searchResults.products.length === 0 && searchResults.categories.length === 0 && (
                  <div className="search-no-results">No results found for "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
          
          <div className="topbar-actions">
            
            {/* Google Sheets Sync Buttons */}
            <div style={{display: 'flex', gap: '8px', marginRight: '16px', alignItems: 'center'}}>
              <button 
                onClick={async (e) => {
                  e.target.disabled = true;
                  const originalText = e.target.innerText;
                  e.target.innerText = 'Pushing...';
                  try {
                    const res = await fetch('http://localhost:4000/sync/to-sheets', { method: 'POST' });
                    const data = await res.json();
                    if(data.success) alert(data.message);
                    else alert("Error: " + data.error);
                  } catch (err) { alert("Make sure Zipit Sync server is running!"); }
                  e.target.disabled = false;
                  e.target.innerText = originalText;
                }}
                style={{background: '#0c831f', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                Push to Sheets
              </button>
              
              <button 
                onClick={async (e) => {
                  e.target.disabled = true;
                  const originalText = e.target.innerText;
                  e.target.innerText = 'Pulling...';
                  try {
                    const res = await fetch('http://localhost:4000/sync/from-sheets', { method: 'POST' });
                    const data = await res.json();
                    if(data.success) alert(data.message);
                    else alert("Error: " + data.error);
                  } catch (err) { alert("Make sure Zipit Sync server is running!"); }
                  e.target.disabled = false;
                  e.target.innerText = originalText;
                }}
                style={{background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                Pull from Sheets
              </button>
            </div>

            <button className="icon-btn theme-btn" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <div className="notification-wrapper" ref={notifRef}>
              <button className="icon-btn" onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0); }}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                  </div>
                  <div className="notif-list">
                    {notifications.length > 0 ? notifications.map(notif => (
                      <div key={notif.id} className="notif-item" onClick={() => navigate('/orders')}>
                        <div className="notif-icon"><ShoppingBag size={16} color="#027A48" /></div>
                        <div className="notif-content">
                          <p><strong>New Order Received!</strong></p>
                          <span>Order #{notif.id.split('-')[0]} for ₹{notif.total_amount}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="notif-empty">No recent notifications.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => navigate('/settings')}><Settings size={20} /></button>
          </div>
        </header>
        
        <div className="admin-content-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
