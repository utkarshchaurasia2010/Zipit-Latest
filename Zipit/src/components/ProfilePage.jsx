import React, { useState } from 'react';
import './ProfilePage.css';
import { LogOut, ChevronRight, BookOpen, CreditCard, ChevronLeft, Edit2, Moon, Sun, Heart, MapPin, Bell, FileText, ShieldCheck, HelpCircle, Store, Bike, Sparkles, ArrowRight } from 'lucide-react';
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
                <SolidUserIcon size={46} color="#FFF" />
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
              <h3 style={{ margin: 0 }}>{userProfile?.name || 'Guest User'}</h3>
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="#2563EB" 
                style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3))' }}
                title="Verified Account"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M7.5 12.5L10.5 15.5L16.5 9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <p className="profile-contact" style={{ marginTop: '4px' }}>
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

        {/* Partner with Quickly Section Cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#0c831f" />
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
                Quickly Partner Program (पार्टनर बनें)
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0c831f', background: 'rgba(12, 131, 31, 0.12)', padding: '2px 8px', borderRadius: '12px' }}>
              Earn with Us
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Retail Partner Card */}
            <div 
              onClick={() => navigate('/partner-register', { state: { role: 'shopkeeper' } })}
              style={{
                background: theme === 'dark' ? '#1e293b' : '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: '16px',
                padding: '14px 12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(12, 131, 31, 0.08)',
                transition: 'transform 0.15s ease'
              }}
            >
              <div>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#0c831f', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '10px',
                  boxShadow: '0 2px 6px rgba(12, 131, 31, 0.3)'
                }}>
                  <Store size={20} color="#ffffff" />
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text)', lineHeight: '1.2' }}>
                  Retail Partner
                </div>
                <div style={{ fontSize: '11px', color: '#0c831f', fontWeight: '700', marginTop: '2px' }}>
                  दुकानदार / सेलर बनें
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px', lineHeight: '1.3' }}>
                  Sell products & get daily payouts
                </div>
              </div>

              <div style={{ 
                marginTop: '12px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '11.5px', 
                fontWeight: '800', 
                color: '#0c831f' 
              }}>
                Apply to Sell <ArrowRight size={13} />
              </div>
            </div>

            {/* Delivery Partner Card */}
            <div 
              onClick={() => navigate('/partner-register', { state: { role: 'rider' } })}
              style={{
                background: theme === 'dark' ? '#1e293b' : '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '16px',
                padding: '14px 12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
                transition: 'transform 0.15s ease'
              }}
            >
              <div>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#d97706', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '10px',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                }}>
                  <Bike size={20} color="#ffffff" />
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text)', lineHeight: '1.2' }}>
                  Delivery Partner
                </div>
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '700', marginTop: '2px' }}>
                  डिलीवरी राइडर बनें
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px', lineHeight: '1.3' }}>
                  Deliver orders on bike & earn daily
                </div>
              </div>

              <div style={{ 
                marginTop: '12px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '11.5px', 
                fontWeight: '800', 
                color: '#b45309' 
              }}>
                Join Fleet <ArrowRight size={13} />
              </div>
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

          <div className="menu-item" onClick={() => navigate('/customer-support')}>
            <div className="menu-item-left">
              <div className="menu-icon-box" style={{ background: theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' }}>
                <HelpCircle size={18} color={theme === 'dark' ? '#6ee7b7' : '#15803d'} />
              </div>
              <span>Customer Support</span>
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
