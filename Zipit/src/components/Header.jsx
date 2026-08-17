import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Mic, Bell, Check } from 'lucide-react';
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

const Header = ({ time, onAddressClick, onEditAddressClick, onSearchClick, onProfileClick, defaultAddress, gpsLocation, isHome, isNavHidden, bgColor = 'transparent', cart, userProfile, setUserProfile }) => {
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
    <header className="app-header" style={{ background: bgColor, paddingBottom: '12px', top: topOffset }}>
      <div className="header-top" style={{ color: textColor }}>
        <div className="location-info" onClick={onAddressClick}>
          <div className="delivery-time">
            <strong>Zipit in</strong>
            <h1>{getCartDeliveryTime(cart) || time} minutes</h1>
          </div>
          <div className="address" style={{ display: 'flex', alignItems: 'center', gap: '3px', maxWidth: '240px', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
            {defaultAddress && defaultAddress.details ? (
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
                  {` - ${defaultAddress.details.split(',')[0].trim()}`}
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
                  {` - ${(gpsLocation || localStorage.getItem('zipit_gps_area') || 'Detecting...').split(',')[0].trim()}`}
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
      
      <div className="search-container" onClick={onSearchClick}>
        <Search size={20} color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} />
        <div className="search-placeholder-wrapper">
          <span>Search for </span>
          <div className="animated-search-text">
            <span key={searchIndex} className="slide-up-text">{searchItems[searchIndex]}</span>
          </div>
        </div>
        <div className="divider"></div>
        <div className="mic-icon-wrapper" onClick={(e) => { e.stopPropagation(); onSearchClick(true); }}>
          <Mic size={20} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
        </div>
      </div>
    </header>
  );
};
export default Header;
