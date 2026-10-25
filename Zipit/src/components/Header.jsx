import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Mic, Bell, Check, Home, LayoutGrid, Navigation, ShoppingCart, Heart } from 'lucide-react';
import { db } from '../services/db';
import { requestFirebaseNotificationPermission } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { getCartDeliveryTime } from '../utils/time';
import './Header.css';

const SolidUserIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="7.5" r="4.5" />
    <rect x="4" y="14" width="16" height="7.5" rx="3.75" />
  </svg>
);

const Header = ({ time, onAddressClick, onEditAddressClick, onSearchClick, onProfileClick, defaultAddress, gpsLocation, isHome, isNavHidden, bgColor = 'transparent', cart, userProfile, setUserProfile, navigate, openCart }) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  
  const [nativePerm, setNativePerm] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNativePerm(Notification.permission);
      const interval = setInterval(() => {
        setNativePerm(Notification.permission);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const hasNotificationsEnabled = nativePerm === 'granted' || !!userProfile?.fcm_token || !!localStorage.getItem('fcm_token');

  const handleEnableNotifications = async (e) => {
    e.stopPropagation();
    if (hasNotificationsEnabled) {
      showToast('Notifications are already enabled!');
      return;
    }
    const token = await requestFirebaseNotificationPermission();
    if (token || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      setNativePerm('granted');
      showToast('Notifications enabled successfully!');
    } else {
      showToast('Please enable notifications in browser/device settings.');
    }
  };
  
  // Rotating search text
  const searchItems = ["'ice-cream'", "'milk'", "'bread'", "'eggs'", "'chips'", "'maggi'"];
  const [searchIndex, setSearchIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSearchIndex(prev => (prev + 1) % searchItems.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  const textColor = theme === 'dark' ? '#FFFFFF' : '#000000';
  const iconColor = textColor;

  const topOffset = isNavHidden ? '-89px' : '0px';

  return (
    <header className="app-header" style={{ background: bgColor, top: topOffset }}>
      {/* ── 3D Glowing Vector Curved Backdrop ── */}
      <div className="header-vector-bg" aria-hidden="true">
        <svg viewBox="0 0 400 160" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Light Mode Gradients */}
            <linearGradient id="headerGrad1Light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="headerGrad2Light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id="headerGlowLight" cx="60%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>

            {/* Dark Mode Gradients */}
            <linearGradient id="headerGrad1Dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#059669" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="headerGrad2Dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.20" />
              <stop offset="60%" stopColor="#D97706" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="headerGlowDark" cx="50%" cy="20%" r="80%">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#10B981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#064E3B" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Primary Fluid Wave */}
          <path
            d="M-20 -20 Q 80 130, 240 45 T 440 95 L 440 -40 Z"
            fill={theme === 'dark' ? 'url(#headerGrad1Dark)' : 'url(#headerGrad1Light)'}
            style={{ filter: theme === 'dark' ? 'drop-shadow(0 6px 12px rgba(16, 185, 129, 0.15))' : 'drop-shadow(0 4px 10px rgba(255, 255, 255, 0.25))' }}
          />
          {/* Secondary Intersecting Wave */}
          <path
            d="M90 -40 Q 220 150, 380 35 T 530 85 L 530 -40 Z"
            fill={theme === 'dark' ? 'url(#headerGrad2Dark)' : 'url(#headerGrad2Light)'}
            style={{ filter: theme === 'dark' ? 'drop-shadow(0 4px 10px rgba(245, 158, 11, 0.12))' : 'drop-shadow(0 3px 8px rgba(253, 230, 138, 0.3))' }}
          />
          {/* Glowing 3D Orb/Sphere Highlight */}
          <circle
            cx="355"
            cy="24"
            r="75"
            fill={theme === 'dark' ? 'url(#headerGlowDark)' : 'url(#headerGlowLight)'}
          />
        </svg>
      </div>

      {/* ── DESKTOP HEADER BAR (Visible only on desktop screens >= 1024px) ── */}
      <div className="desktop-header-row">
        {/* Brand & Delivery Pill */}
        <div className="desktop-header-left">
          <div className="desktop-brand" onClick={() => navigate && navigate('/')}>
            <span className="brand-zip">Zip</span>
            <span className="brand-it">it</span>
          </div>

          <div className="desktop-delivery-pill" onClick={onAddressClick} title="Change delivery location">
            <div className="desktop-eta-box">
              <span className="desktop-eta-num">{getCartDeliveryTime(cart) || time}</span>
              <span className="desktop-eta-unit">MINS</span>
            </div>
            <div className="desktop-address-box">
              <span className="desktop-address-label">
                {defaultAddress?.type || 'Current Location'}
                <ChevronDown size={14} style={{ marginLeft: 3 }} />
              </span>
              <span className="desktop-address-sub">
                {(defaultAddress?.details?.split(',')[0] || String(gpsLocation || localStorage.getItem('zipit_gps_area') || 'Select location').split(',')[0]).trim()}
              </span>
            </div>
          </div>
        </div>

        {/* Central Expanded Search Bar */}
        <div className="desktop-search-bar" onClick={onSearchClick}>
          <Search size={18} color={theme === 'dark' ? '#9CA3AF' : '#64748B'} />
          <div className="search-placeholder-wrapper">
            <span>Search for </span>
            <div className="animated-search-text">
              <span key={searchIndex} className="slide-up-text">{searchItems[searchIndex]}</span>
            </div>
          </div>
          <div className="desktop-mic-btn" onClick={(e) => { e.stopPropagation(); onSearchClick(true); }} title="Search by voice">
            <Mic size={17} color={theme === 'dark' ? '#FFFFFF' : '#0F172A'} />
          </div>
        </div>

        {/* Right Nav Menu & Controls */}
        <div className="desktop-header-right">
          <nav className="desktop-nav-menu">
            <button 
              type="button" 
              className={`desktop-menu-link ${isHome ? 'active' : ''}`}
              onClick={() => navigate && navigate('/')}
            >
              <Home size={17} />
              <span>Home</span>
            </button>
            <button 
              type="button" 
              className="desktop-menu-link"
              onClick={() => navigate && navigate('/categories')}
            >
              <LayoutGrid size={17} />
              <span>Categories</span>
            </button>
            <button 
              type="button" 
              className="desktop-menu-link"
              onClick={() => navigate && navigate('/track')}
            >
              <Navigation size={17} />
              <span>Orders</span>
            </button>
            <button 
              type="button" 
              className="desktop-menu-link"
              onClick={() => navigate && navigate('/wishlist')}
            >
              <Heart size={17} />
              <span>Wishlist</span>
            </button>
          </nav>

          {/* Cart Button */}
          {openCart && (
            <button
              type="button"
              className="desktop-cart-pill-btn"
              onClick={openCart}
            >
              <ShoppingCart size={18} />
              <span>Cart</span>
              {Array.isArray(cart) && cart.length > 0 && (
                <span className="desktop-cart-count">
                  {cart.reduce((s, i) => s + (i.qty || 1), 0)}
                </span>
              )}
            </button>
          )}

          {/* Notifications */}
          <button 
            type="button"
            className="desktop-icon-btn" 
            onClick={handleEnableNotifications} 
            title={hasNotificationsEnabled ? "Notifications enabled" : "Enable notifications"}
          >
            <Bell size={18} color={hasNotificationsEnabled ? '#15803d' : textColor} />
            {hasNotificationsEnabled && <span className="desktop-notif-dot" />}
          </button>

          {/* Profile */}
          <button 
            type="button"
            className="desktop-profile-btn" 
            onClick={onProfileClick}
            title="My Profile"
          >
            <SolidUserIcon size={18} color={textColor} />
            <span className="desktop-profile-name">{userProfile?.name?.split(' ')[0] || 'Profile'}</span>
          </button>
        </div>
      </div>

      {/* ── MOBILE / TABLET HEADER BAR (<1024px) ── */}
      <div className="mobile-header-wrapper">
        <div className="header-top" style={{ color: textColor }}>
          <div className="location-info" onClick={onAddressClick}>
            <div className="delivery-time">
              <strong>Zipit in</strong>
              <h1>{getCartDeliveryTime(cart) || time} minutes</h1>
            </div>
            <div className="address" style={{ display: 'flex', alignItems: 'center', gap: '3px', maxWidth: '240px', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {defaultAddress && typeof defaultAddress.details === 'string' && defaultAddress.details.trim() ? (
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    fontSize: '13px', 
                    color: textColor, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}
                  title={defaultAddress.details}
                >
                  <span style={{ fontWeight: 800, flexShrink: 0, fontSize: '13px' }}>
                    {defaultAddress.type || 'Home'}
                  </span>
                  <span style={{ fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9, fontSize: '12.5px' }}>
                    {` - ${(defaultAddress.details.split(',')[0] || '').trim()}`}
                  </span>
                  <ChevronDown size={15} style={{ flexShrink: 0, marginLeft: '3px' }} strokeWidth={2.5} />
                </div>
              ) : (
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    fontSize: '13px', 
                    color: textColor, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}
                >
                  <span style={{ fontWeight: 800, flexShrink: 0, fontSize: '13px' }}>
                    Current location
                  </span>
                  <span style={{ fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9, fontSize: '12.5px' }}>
                    {` - ${(String(gpsLocation || localStorage.getItem('zipit_gps_area') || 'Detecting...').split(',')[0] || '').trim()}`}
                  </span>
                  <ChevronDown size={15} style={{ flexShrink: 0, marginLeft: '3px' }} strokeWidth={2.5} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div 
              className="notification-icon" 
              onClick={handleEnableNotifications} 
              title={hasNotificationsEnabled ? "Notifications enabled" : "Click to enable Notifications"}
              aria-label={hasNotificationsEnabled ? "Notifications enabled" : "Enable order notifications"}
              role="button"
              tabIndex={0}
              style={{ 
                position: 'relative', 
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF', 
                boxShadow: theme === 'dark' ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.12)',
                border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: hasNotificationsEnabled ? 'default' : 'pointer'
              }}
            >
              <Bell size={20} color={hasNotificationsEnabled ? (theme === 'dark' ? '#34c759' : '#0c831f') : (theme === 'dark' ? '#ff3b30' : '#d93025')} strokeWidth={2.6} />
              {hasNotificationsEnabled && (
                 <div style={{ position: 'absolute', bottom: 6, right: 6, width: 12, height: 12, backgroundColor: '#0c831f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Check size={8} color="#fff" strokeWidth={3} />
                 </div>
              )}
            </div>
            <div 
              className="profile-pic" 
              onClick={onProfileClick} 
              aria-label="User Profile"
              role="button"
              tabIndex={0}
              style={{ 
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF', 
                boxShadow: theme === 'dark' ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.12)',
                border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <SolidUserIcon size={22} color={textColor} />
            </div>
          </div>
        </div>
        
        <div className="search-container" onClick={onSearchClick} role="search" aria-label="Search products">
          <Search size={20} color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} />
          <div className="search-placeholder-wrapper">
            <span>Search for </span>
            <div className="animated-search-text">
              <span key={searchIndex} className="slide-up-text">{searchItems[searchIndex]}</span>
            </div>
          </div>
          <div className="divider"></div>
          <div 
            className="mic-icon-wrapper" 
            onClick={(e) => { e.stopPropagation(); onSearchClick(true); }}
            aria-label="Voice Search"
            role="button"
            tabIndex={0}
          >
            <Mic size={20} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
          </div>
        </div>
      </div>
    </header>
  );
};
export default Header;
