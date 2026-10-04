import React, { useState } from 'react';
import './ProfilePage.css';
import { LogOut, ChevronRight, BookOpen, CreditCard, ChevronLeft, Edit2, Moon, Sun, Heart, MapPin, Bell, FileText } from 'lucide-react';
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
        <button className="back-btn" onClick={() => navigate('/')}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
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
                <BookOpen size={18} color="var(--color-text)" />
              </div>
              <span>Your Orders</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/wishlist')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-pink">
                <Heart size={18} color="var(--color-text)" />
              </div>
              <span>My Wishlist</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/saved-addresses')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-purple">
                <MapPin size={18} color="var(--color-text)" />
              </div>
              <span>Address Book</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/payment-methods')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-green">
                <CreditCard size={18} color="var(--color-text)" />
              </div>
              <span>Payment Methods</span>
            </div>
            <ChevronRight size={20} color="var(--color-text-light)" />
          </div>

          <div className="menu-item" onClick={() => navigate('/terms')}>
            <div className="menu-item-left">
              <div className="menu-icon-box menu-icon-orange" style={{ background: 'rgba(248, 203, 70, 0.15)' }}>
                <FileText size={18} color="var(--color-primary)" />
              </div>
              <span>Terms & Conditions</span>
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
