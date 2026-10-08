import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Edit2, Shield, Save, KeyRound, Upload, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { db, supabase } from '../services/db';
import { useToast } from '../context/ToastContext';
import './Settings.css';

const LOGO_CONFIGS = [
  {
    key: 'customer_logo',
    title: 'Customer App Logo',
    role: 'Zipit Customer',
    desc: 'Primary logo for consumer web app, splash screen, and PWA icon.'
  },
  {
    key: 'admin_logo',
    title: 'Admin Workspace Logo',
    role: 'Admin Panel',
    desc: 'Top header and sidebar brand logo in this management dashboard.'
  },
  {
    key: 'rider_logo',
    title: 'Delivery Rider App Logo',
    role: 'Rider Express',
    desc: 'App header, splash, and identity icon for delivery riders.'
  },
  {
    key: 'shopkeeper_logo',
    title: 'Shopkeeper App Logo',
    role: 'Store Portal',
    desc: 'Brand header icon displayed in the merchant order processing app.'
  }
];

const Settings = ({ profile, setProfile }) => {
  const [formData, setFormData] = useState({ 
    ...profile, 
    admin_code: profile?.admin_code || localStorage.getItem('zipit_admin_custom_code') || '737920' 
  });
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({});
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    setBrandingLoading(true);
    const data = await db.branding.get();
    if (data) {
      setBranding(data);
    }
    setBrandingLoading(false);
  };

  const handleLogoUpload = async (key, file) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      showToast(`Uploading ${file.name}...`, 'Info');
      const publicUrl = await db.branding.uploadLogo(key, file);
      const updated = {
        ...branding,
        [key]: publicUrl
      };
      await db.branding.update(updated);
      setBranding(updated);
      showToast('Logo uploaded & synced across all apps successfully!', 'Success');
    } catch (err) {
      console.error('Logo upload failed:', err);
      showToast(err.message || 'Failed to upload logo', 'Error');
    } finally {
      setUploadingKey(null);
    }
  };

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({ 
        ...prev, 
        ...profile, 
        admin_code: profile.admin_code || localStorage.getItem('zipit_admin_custom_code') || '737920' 
      }));
    }
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.admin_code && formData.admin_code.length !== 6) {
      showToast('Admin Security Code must be exactly 6 digits.', 'Error');
      return;
    }
    setSaving(true);
    const result = await db.user.update(formData);
    if (result?.data) {
      setProfile(result.data);
      if (formData.admin_code) {
        localStorage.setItem('zipit_admin_custom_code', formData.admin_code);
      }
      showToast('Profile and Admin Code updated successfully!', 'Success');
    } else {
      const errorMsg = result?.error || 'Failed to update profile. Please verify your connection or session.';
      showToast(errorMsg, 'Error');
    }
    setSaving(false);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Admin Settings</h2>
        <p>Manage your account settings, security code, and preferences.</p>
      </div>

      <div className="settings-card">
        <h3>Profile Information & Security</h3>
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                required 
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input 
                type="email" 
                value={formData.email || ''} 
                disabled
                style={{backgroundColor: 'transparent', color: 'var(--color-text-light)', cursor: 'not-allowed'}}
              />
            </div>
            <small>Email address cannot be changed.</small>
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <div className="input-with-icon">
              <Phone size={18} />
              <input 
                type="text" 
                value={formData.phone || ''} 
                onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                placeholder="10-digit phone number"
                maxLength={10}
              />
            </div>
          </div>

          <div className="form-group">
            <label>6-Digit Admin Access Code</label>
            <div className="input-with-icon">
              <KeyRound size={18} color="#0c831f" />
              <input 
                type="text" 
                value={formData.admin_code || ''} 
                onChange={e => setFormData({...formData, admin_code: e.target.value.replace(/\D/g, '').slice(0, 6)})} 
                placeholder="e.g. 737920"
                maxLength={6}
                style={{ fontWeight: '700', letterSpacing: '4px' }}
                required
              />
            </div>
            <small>Used to unlock the Admin Panel instead of email OTP.</small>
          </div>

            <div className="form-actions">
            <button type="submit" disabled={saving} className="save-settings-btn">
              <Save size={18} /> {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* App Branding & Logo Synchronization Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>🎨 App Branding & Dynamic Logos</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Upload logos for each app. Changes automatically sync in realtime across all app icons and headers.
            </p>
          </div>
          {brandingLoading && <span style={{ fontSize: '12px', color: '#64748b' }}>Syncing logos...</span>}
        </div>

        <div className="branding-grid">
          {LOGO_CONFIGS.map(({ key, title, role, desc }) => {
            const currentUrl = branding[key];
            const isUploading = uploadingKey === key;

            return (
              <div key={key} className="logo-upload-card">
                <div className="logo-card-head">
                  <span className="logo-role-title">{title}</span>
                  <span className="logo-role-tag">{role}</span>
                </div>

                <div className="logo-preview-box">
                  {currentUrl ? (
                    <img src={currentUrl} alt={title} className="logo-preview-img" />
                  ) : (
                    <div className="logo-preview-placeholder">
                      <ImageIcon size={22} />
                      <span>No Logo</span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, minHeight: '32px' }}>
                  {desc}
                </p>

                <label className={`logo-upload-btn-label ${isUploading ? 'uploading' : ''}`}>
                  <Upload size={14} />
                  <span>{isUploading ? 'Uploading...' : currentUrl ? 'Change Logo' : 'Upload Logo'}</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(key, file);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Settings;
