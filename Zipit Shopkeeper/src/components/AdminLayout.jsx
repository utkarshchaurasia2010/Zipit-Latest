import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Grid, List, Tag, LogOut, Settings, Bell, Search, X, RefreshCcw, Sun, Moon, Volume2, VolumeX, AlertTriangle, ArrowRight, Key } from 'lucide-react';
import { db, supabase } from '../services/db';
import { startSiren, stopSiren, testSiren } from '../utils/siren';
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

  // Incoming Order Alarm State
  const [incomingAlertOrder, setIncomingAlertOrder] = useState(null);
  const [isTestingSiren, setIsTestingSiren] = useState(false);

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

  // Real-time Notification & Order Siren Listener
  useEffect(() => {
    const fetchInitialRecent = async () => {
      const recent = await db.orders.getAllAdmin();
      const top5 = recent.slice(0, 5);
      setNotifications(top5);
    };
    fetchInitialRecent();

    const ordersChannel = supabase.channel('admin-orders-live-siren')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
        
        // Trigger Loud Village Shop Siren Alarm!
        startSiren();
        setIncomingAlertOrder(payload.new);

        // Native browser notification if granted
        if (Notification.permission === 'granted') {
          new Notification('🚨 NEW ORDER RECEIVED!', { body: `Order #${payload.new.id.split('-')[0].toUpperCase()} for ₹${payload.new.total}` });
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

    // Realtime Profile Listener
    const profileChannel = supabase.channel('admin-profile-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async (payload) => {
        if (payload.new.id === profile?.id || payload.new.is_admin) {
          const fresh = await db.user.get();
          if (fresh) setProfile(fresh);
        }
      })
      .subscribe();

    return () => {
      stopSiren();
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(profileChannel);
    };
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
    localStorage.removeItem('zipit_sales_role');
    localStorage.removeItem('zipit_sales_code');
    window.location.href = '/';
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
                    const res = await fetch('/api/syncToSheets', { method: 'POST' });
                    const data = await res.json();
                    if(data.success) alert(data.message);
                    else alert("Error: " + data.error);
                  } catch (err) { alert("Failed to trigger sync to sheets!"); }
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
                    const res = await fetch('/api/syncFromSheets', { method: 'POST' });
                    const data = await res.json();
                    if(data.success) alert(data.message);
                    else alert("Error: " + data.error);
                  } catch (err) { alert("Failed to trigger pull from sheets!"); }
                  e.target.disabled = false;
                  e.target.innerText = originalText;
                }}
                style={{background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                Pull from Sheets
              </button>
            </div>

            {/* Loud Siren Test Button */}
            <button 
              className="siren-test-btn"
              onClick={() => {
                setIsTestingSiren(true);
                testSiren();
                setTimeout(() => setIsTestingSiren(false), 1500);
              }}
              title="Test Shop Siren Sound Alert"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: isTestingSiren ? '#ef4444' : 'rgba(239, 68, 68, 0.12)',
                color: isTestingSiren ? '#ffffff' : '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginRight: '8px'
              }}
            >
              <Volume2 size={16} className={isTestingSiren ? 'pulse-icon' : ''} />
              <span>{isTestingSiren ? 'Siren Ringing...' : 'Test Siren'}</span>
            </button>

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

      {/* LOUD INCOMING ORDER SIREN OVERLAY MODAL */}
      {incomingAlertOrder && (
        <div className="siren-modal-overlay">
          <div className="siren-modal-card">
            <div className="siren-pulse-badge">
              <AlertTriangle size={36} color="#dc2626" className="siren-shake" />
            </div>

            <h2 className="siren-title">🚨 NEW ORDER RECEIVED!</h2>
            <p className="siren-order-code">Order #{incomingAlertOrder.id?.slice(0, 8).toUpperCase()}</p>
            
            <div className="siren-details-box">
              <div className="siren-detail-row">
                <span>Total Amount:</span>
                <strong>₹{incomingAlertOrder.total}</strong>
              </div>
              <div className="siren-detail-row">
                <span>Items:</span>
                <span>{incomingAlertOrder.items?.length || 0} item(s)</span>
              </div>
              <div className="siren-detail-row">
                <span>Payment:</span>
                <span className="siren-tag">{incomingAlertOrder.payment_method || 'COD / UPI'}</span>
              </div>
            </div>

            <div className="siren-actions">
              <button 
                className="siren-btn-primary"
                onClick={() => {
                  stopSiren();
                  setIncomingAlertOrder(null);
                  navigate('/orders');
                }}
              >
                <span>Accept Order & Stop Alarm</span>
                <ArrowRight size={18} />
              </button>

              <button 
                className="siren-btn-mute"
                onClick={() => {
                  stopSiren();
                  setIncomingAlertOrder(null);
                }}
              >
                <VolumeX size={16} />
                <span>Mute Alarm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
