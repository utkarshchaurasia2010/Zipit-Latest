import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ProfilePage.css';
import { LogOut, ChevronRight, BookOpen, CreditCard, ChevronLeft, Edit2, Moon, Sun, Heart, MapPin, Bell, FileText, ShieldCheck, HelpCircle, PhoneCall, MessageCircle } from 'lucide-react';
import { db, supabase } from '../services/db';
import { useTheme } from '../context/ThemeContext';
import { requestFirebaseNotificationPermission } from '../services/firebase';
import Toast from './Toast';

const SolidUserIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="7.5" r="4.5" />
    <rect x="4" y="14" width="16" height="7.5" rx="3.75" />
  </svg>
);

const ProfilePage = ({ navigate, userProfile, setUserProfile, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(userProfile || { name: 'New User', phone: '', email: '', photo: 'NU' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Lock background scroll when customer support popup is open
  useEffect(() => {
    if (isSupportOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isSupportOpen]);

  React.useEffect(() => {
    if (userProfile) {
      setFormData(userProfile);
    }
  }, [userProfile]);

  const handleSave = async () => {
    setSaving(true);
    const result = await db.user.update(formData);
    if (result?.data) {
      setUserProfile(result.data);
      setIsEditing(false);
      setToast({ visible: true, title: 'Profile Updated', message: 'Your profile has been updated successfully.' });
    } else {
      setToast({ visible: true, title: 'Update Failed', message: result?.error || 'There was an error updating your profile.' });
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    localStorage.removeItem('zipit_cached_user_profile');
    localStorage.removeItem('zipit_cached_addresses');
    localStorage.removeItem('zipit_verified_phone');
    localStorage.removeItem('zipit_active_user_id');
    localStorage.removeItem('cart');
    await supabase.auth.signOut();
    onLogout();
  };

  const handleEnableNotifications = async () => {
    setToast({ visible: true, title: 'Requesting Permission', message: 'Please allow notifications in your browser...' });
    const token = await requestFirebaseNotificationPermission();
    if (token) {
      await db.user.update({ fcm_token: token });
      setToast({ visible: true, title: 'Notifications Enabled', message: 'You will now receive order updates!' });
    } else {
      setToast({ visible: true, title: 'Permission Denied', message: 'Could not enable notifications.' });
    }
  };

  return (
    <div className={`profile-page ${theme === 'dark' ? 'dark-gradient' : 'light-gradient'}`}>
      <header className="page-header transparent">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
      </header>
      
      <div className="profile-header-card transparent">
        {isEditing ? (
          <div className="profile-edit-form" style={{ textAlign: 'left', width: '100%' }}>
            <h3 style={{color: 'var(--color-text)', marginBottom: 20, textAlign: 'center'}}>Edit Profile</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>Full Name</label>
              <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>Phone Number (Optional)</label>
              <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 9876543210" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>Email Address</label>
              <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>Profile Initials</label>
              <input type="text" value={formData.photo || ''} onChange={e => setFormData({...formData, photo: e.target.value.toUpperCase()})} placeholder="JD" maxLength="2" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            <div style={{display: 'flex', gap: 12, marginTop: 8}}>
              <button onClick={() => setIsEditing(false)} className="zipit-premium-btn-secondary" style={{flex: 1}}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="zipit-premium-btn-primary" style={{flex: 1, opacity: saving ? 0.7 : 1}}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        ) : (
          <div className="profile-info-centered">
            <div className="profile-pic-large-wrapper">
              <div className="profile-pic-large">
                <SolidUserIcon size={48} color="#FFF" />
              </div>
            </div>
            <h3>{userProfile?.name || 'Guest'}</h3>
            <p className="profile-contact">
              {userProfile?.phone || 'No phone'} • {userProfile?.email || 'No email'}
            </p>
            <button className="edit-profile-btn-solid" onClick={() => setIsEditing(true)}>
              Edit Profile Details
            </button>
          </div>
        )}
      </div>

      {!isEditing && (
        <>
        <div className="profile-menu" style={{marginBottom: 16}}>
          <div className="menu-item" onClick={toggleTheme} style={{borderBottom: 'none'}}>
            <div className="menu-item-left">
              <span style={{fontWeight: 600, color: 'var(--color-text)', fontSize: '15px'}}>Appearance</span>
            </div>
            <div className={`fancy-theme-toggle ${theme}`} onClick={toggleTheme}>
              <div className="fancy-theme-decor fancy-stars"></div>
              <div className="fancy-theme-decor fancy-clouds"></div>
              <div className="fancy-toggle-circle"></div>
            </div>
          </div>
        </div>

        <div className="profile-menu">

          <div className="menu-item" onClick={() => navigate('/past-orders')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-blue">
                <BookOpen size={18} color={theme === 'dark' ? '#93c5fd' : '#1d4ed8'} />
              </div>
              <span>Your Orders</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/wishlist')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-pink">
                <Heart size={18} color={theme === 'dark' ? '#f472b6' : '#db2777'} />
              </div>
              <span>My Wishlist</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/saved-addresses')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-purple">
                <MapPin size={18} color={theme === 'dark' ? '#c084fc' : '#7e22ce'} />
              </div>
              <span>Address Book</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/payment-methods')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-green">
                <CreditCard size={18} color={theme === 'dark' ? '#86efac' : '#15803d'} />
              </div>
              <span>Payment Methods</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => setIsSupportOpen(true)}>
            <div className="menu-item-left">
              <div className="menu-icon-box" style={{ background: theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' }}>
                <HelpCircle size={18} color={theme === 'dark' ? '#6ee7b7' : '#15803d'} />
              </div>
              <div>
                <span style={{ display: 'block' }}>Customer Support</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '500' }}>Instant Help, WhatsApp & Call</span>
              </div>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/legal', { state: { policy: 'terms' } })}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-orange" style={{ background: theme === 'dark' ? 'rgba(248, 203, 70, 0.2)' : 'rgba(248, 203, 70, 0.15)' }}>
                <ShieldCheck size={18} color={theme === 'dark' ? '#fde047' : '#b45309'} />
              </div>
              <span>Legal & Policies</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>
          
          <div className="menu-item logout-btn" onClick={handleLogout}>
            <div className="menu-item-left">
              <div className="menu-icon-box" style={{ background: 'transparent' }}>
                <LogOut size={20} color="var(--color-danger)" />
              </div>
              <span style={{color: 'var(--color-danger)'}}>Log Out</span>
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── Fixed Customer Support Bottom Sheet Modal (Portaled to document.body) ── */}
      {isSupportOpen && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            touchAction: 'none'
          }} 
          onClick={() => setIsSupportOpen(false)}
        >
          <div 
            style={{
              background: 'var(--color-surface)',
              width: '100%',
              maxWidth: '480px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              border: '1px solid var(--color-border)',
              borderBottom: 'none',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '85vh',
              overflowY: 'auto'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>Customer Support &amp; Help</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-light)', margin: '4px 0 0' }}>We are here 7 AM - 11 PM to help you</p>
              </div>
              <button 
                onClick={() => setIsSupportOpen(false)} 
                style={{ 
                  background: 'var(--color-surface-muted)', 
                  border: 'none', 
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px', 
                  cursor: 'pointer', 
                  color: 'var(--color-text-light)' 
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href="https://wa.me/919999999999?text=Hi%20Zipit%20Support,%20I%20need%20help%20with%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: '#25D366',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textDecoration: 'none',
                  fontWeight: '800',
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
                }}
              >
                <MessageCircle size={20} />
                <span>Chat on WhatsApp (Fastest)</span>
              </a>

              <a
                href="tel:+919999999999"
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '14px'
                }}
              >
                <PhoneCall size={20} color="#10b981" />
                <span>Call Customer Care</span>
              </a>

              <button
                onClick={() => {
                  setIsSupportOpen(false);
                  navigate('/past-orders');
                }}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                <BookOpen size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800' }}>Order Issues &amp; Refund Status</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-light)', fontWeight: '500', marginTop: '2px' }}>
                    Check live status of cancellation, missing items, or refunds
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Toast 
        visible={toast.visible} 
        title={toast.title} 
        message={toast.message} 
        onClose={() => setToast({ ...toast, visible: false })} 
      />
    </div>
  );
};
export default ProfilePage;
