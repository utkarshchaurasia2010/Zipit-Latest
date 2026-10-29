import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Mic, Bell, Check, Home, LayoutGrid, Navigation, ShoppingCart, Heart } from 'lucide-react';
import { db, supabase } from '../services/db';
import { requestAppNotificationPermission } from '../utils/notifications';
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

  const [brandingConfig, setBrandingConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('zipit_cached_branding');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    db.branding.get().then(b => {
      if (b) setBrandingConfig(b);
    }).catch(() => {});

    const channel = supabase.channel('header-branding-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'id=eq.00000000-0000-0000-0000-000000000001'
      }, () => {
        db.branding.get().then(b => {
          if (b) setBrandingConfig(b);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    const granted = await requestAppNotificationPermission();
    if (granted || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      setNativePerm('granted');
      showToast('Notifications enabled successfully!');
    } else {
      showToast('Please enable notifications in device settings.');
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

  return (
    <header className={`app-header ${isNavHidden ? 'nav-hidden' : ''}`} style={{ background: bgColor }}>
      {/* ── 3D Glowing Vector Curved Backdrop (High Contrast & Visible in Light Mode) ── */}
      <div className="header-vector-bg" aria-hidden="true">
        <svg viewBox="0 0 400 160" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* 3D Filter for bevel specular lighting & deep volumetric shadow */}
            <filter id="waveDepth3D" x="-20%" y="-20%" width="150%" height="160%" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={theme === 'dark' ? '#000000' : '#b45309'} floodOpacity={theme === 'dark' ? '0.6' : '0.22'} />
              <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor={theme === 'dark' ? '#064e3b' : '#d97706'} floodOpacity={theme === 'dark' ? '0.4' : '0.15'} />
            </filter>

            <filter id="topEdgeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ffffff" floodOpacity={theme === 'dark' ? '0.35' : '0.8'} />
            </filter>

            {/* Light Mode Gradients - 3D Embossed Golden/Amber Curves */}
            <linearGradient id="curve1Light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.75" />
              <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.25" />
            </linearGradient>

            <linearGradient id="curve2Light" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#FBBF24" stopOpacity="0.6" />
              <stop offset="85%" stopColor="#EA580C" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#C2410C" stopOpacity="0.1" />
            </linearGradient>

            <linearGradient id="curveRidgeLight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#FEF08A" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
            </linearGradient>

            {/* Dark Mode Gradients - Vibrant #FF6B00 Vector Curve */}
            <linearGradient id="curve1Dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#EA580C" stopOpacity="0.28" />
              <stop offset="80%" stopColor="#C2410C" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#7C2D12" stopOpacity="0.04" />
            </linearGradient>

            <linearGradient id="curve2Dark" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="#FF8533" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#C2410C" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#431407" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id="curveRidgeDark" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFB380" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#EA580C" stopOpacity="0.2" />
            </linearGradient>

            <radialGradient id="sphere3DLight" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#FDE047" stopOpacity="0.6" />
              <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="sphere3DDark" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFB380" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#FF6B00" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#C2410C" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#431407" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Deep Base Shadow Wave (Lends realistic physical lift) */}
          <path
            d="M-30 -25 Q 75 142, 238 48 T 445 105 L 445 -45 Z"
            fill={theme === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(180, 83, 9, 0.08)'}
            transform="translate(0, 3)"
          />

          {/* Primary Wave Body with 3D Bevel & Depth Filter */}
          <path
            d="M-30 -25 Q 75 142, 238 48 T 445 105 L 445 -45 Z"
            fill={theme === 'dark' ? 'url(#curve1Dark)' : 'url(#curve1Light)'}
            filter="url(#waveDepth3D)"
          />

          {/* Sleek, Crisp 3D Specular Highlight Ridge (Ultra-fine 1.2px embossed edge) */}
          <path
            d="M-30 -25 Q 75 142, 238 48 T 445 105"
            stroke={theme === 'dark' ? 'url(#curveRidgeDark)' : 'url(#curveRidgeLight)'}
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            filter="url(#topEdgeGlow)"
          />

          {/* Secondary Intersecting Wave Body (Overlapping 3D tier) */}
          <path
            d="M80 -45 Q 215 160, 375 38 T 530 92 L 530 -45 Z"
            fill={theme === 'dark' ? 'url(#curve2Dark)' : 'url(#curve2Light)'}
            filter="url(#waveDepth3D)"
          />

          {/* Secondary Fine Specular Ridge (1px edge) */}
          <path
            d="M80 -45 Q 215 160, 375 38 T 530 92"
            stroke={theme === 'dark' ? 'rgba(255, 179, 128, 0.7)' : 'rgba(255, 255, 255, 0.9)'}
            strokeWidth="1.0"
            strokeLinecap="round"
            fill="none"
          />

          {/* Raised 3D Spherical Ambient Luster */}
          <circle
            cx="355"
            cy="26"
            r="80"
            fill={theme === 'dark' ? 'url(#sphere3DDark)' : 'url(#sphere3DLight)'}
            style={{ mixBlendMode: theme === 'dark' ? 'screen' : 'multiply' }}
          />
        </svg>
      </div>

      {/* ── DESKTOP HEADER BAR (Visible only on desktop screens >= 1024px) ── */}
      <div className="desktop-header-row">
        {/* Brand & Delivery Pill */}
        <div className="desktop-header-left">
          <div className="desktop-brand" onClick={() => navigate && navigate('/')}>
            <span className="brand-zip" style={{ color: 'var(--color-text)' }}>{brandingConfig?.app_name || 'Quickly'}</span>
          </div>

          <div className="desktop-delivery-pill" onClick={onAddressClick} title="Change delivery location">
            <div className="desktop-eta-box">
              <span className="desktop-eta-num">{getCartDeliveryTime(cart) || brandingConfig?.default_eta_mins || time}</span>
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
              <strong>{brandingConfig?.app_name || 'Quickly'} in</strong>
              <h1>{getCartDeliveryTime(cart) || brandingConfig?.default_eta_mins || time} minutes</h1>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div 
              className="notification-icon" 
              onClick={handleEnableNotifications} 
              title={hasNotificationsEnabled ? "Notifications enabled" : "Click to enable Notifications"}
              aria-label={hasNotificationsEnabled ? "Notifications enabled" : "Enable order notifications"}
              role="button"
              tabIndex={0}
              style={{ 
                position: 'relative', 
                width: 42, 
                height: 42, 
                borderRadius: '50%', 
                backgroundColor: theme === 'dark' ? '#1E1E1E' : 'rgba(255, 255, 255, 0.92)', 
                backdropFilter: 'blur(8px)',
                boxShadow: theme === 'dark' 
                  ? 'inset 0 1.5px 3px rgba(0, 0, 0, 0.7), inset 0 -1px 2px rgba(255, 255, 255, 0.05), 0 2px 6px rgba(0, 0, 0, 0.4)' 
                  : 'inset 0 1.5px 3px rgba(0, 0, 0, 0.12), inset 0 -1.5px 2px rgba(255, 255, 255, 0.95), 0 2px 6px rgba(0, 0, 0, 0.06)',
                border: theme === 'dark' ? '1px solid #333333' : '1px solid rgba(0, 0, 0, 0.07)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: hasNotificationsEnabled ? 'default' : 'pointer',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease'
              }}
            >
              <Bell size={19} color={hasNotificationsEnabled ? (theme === 'dark' ? '#34c759' : '#0c831f') : (theme === 'dark' ? '#ff3b30' : '#d93025')} strokeWidth={2.4} />
              {hasNotificationsEnabled && (
                 <div style={{ position: 'absolute', bottom: 5, right: 5, width: 11, height: 11, backgroundColor: '#0c831f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: theme === 'dark' ? '#1E1E1E' : 'rgba(255, 255, 255, 0.92)', 
                backdropFilter: 'blur(8px)',
                boxShadow: theme === 'dark' 
                  ? 'inset 0 1.5px 3px rgba(0, 0, 0, 0.7), inset 0 -1px 2px rgba(255, 255, 255, 0.05), 0 2px 6px rgba(0, 0, 0, 0.4)' 
                  : 'inset 0 1.5px 3px rgba(0, 0, 0, 0.12), inset 0 -1.5px 2px rgba(255, 255, 255, 0.95), 0 2px 6px rgba(0, 0, 0, 0.06)',
                border: theme === 'dark' ? '1px solid #333333' : '1px solid rgba(0, 0, 0, 0.07)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease'
              }}
            >
              <SolidUserIcon size={21} color={textColor} />
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
