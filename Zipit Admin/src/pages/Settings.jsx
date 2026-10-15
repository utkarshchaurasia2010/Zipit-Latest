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

      {/* Geofencing & Service Radius Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>📍 Store Geofencing & Delivery Radius</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Set your Dark Store dispatch location and maximum delivery boundary. Customer checkout will block orders outside this radius.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label>Dark Store Latitude</label>
            <input 
              type="number" 
              step="0.0001"
              value={branding.store_lat ?? 25.5788} 
              onChange={(e) => setBranding(prev => ({ ...prev, store_lat: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 25.5788"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Dark Store Longitude</label>
            <input 
              type="number" 
              step="0.0001"
              value={branding.store_lng ?? 83.5780} 
              onChange={(e) => setBranding(prev => ({ ...prev, store_lng: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 83.5780"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Max Delivery Radius (Kilometers)</label>
            <input 
              type="number" 
              step="0.5"
              min="1"
              max="50"
              value={branding.max_delivery_radius_km ?? 8.5} 
              onChange={(e) => setBranding(prev => ({ ...prev, max_delivery_radius_km: parseFloat(e.target.value) || 1 }))}
              placeholder="e.g. 8.5"
              className="form-input"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #bbf7d0', flexWrap: 'wrap', gap: '14px', boxShadow: '0 2px 10px rgba(12, 131, 31, 0.04)' }}>
          <div style={{ fontSize: '13px', color: '#166534', flex: 1, minWidth: '240px' }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '2px', fontSize: '13.5px' }}>⚡ Active Geofence Rule</strong>
            Customers located beyond <strong>{branding.max_delivery_radius_km ?? 8.5} km</strong> from the store coordinates will be protected from unserviceable order dispatch.
          </div>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Geofence boundaries saved successfully!', 'success');
              } catch (err) {
                showToast('Failed to save geofence: ' + err.message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="update-geofence-btn"
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #0c831f 0%, #15803d 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(12, 131, 31, 0.35)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              letterSpacing: '0.3px',
              opacity: saving ? 0.75 : 1
            }}
            onMouseEnter={(e) => { if (!saving) { e.currentTarget.style.transform = 'translateY(-1.5px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(12, 131, 31, 0.45)'; } }}
            onMouseLeave={(e) => { if (!saving) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(12, 131, 31, 0.35)'; } }}
          >
            <Save size={18} strokeWidth={2.4} />
            <span>{saving ? 'Updating...' : 'Update Geofence & Radius'}</span>
          </button>
        </div>
      </div>

      {/* Delivery & Service Cost Management Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>💰 Delivery &amp; Service Fee Controls</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Configure delivery charge, handling fee, dynamic surge pricing, and free delivery thresholds. All updates sync instantly to customer checkout.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label>Standard Delivery Fee (₹)</label>
            <input 
              type="number" 
              min="0"
              step="1"
              value={branding.delivery_fee ?? 20} 
              onChange={(e) => setBranding(prev => ({ ...prev, delivery_fee: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 20"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Handling / Platform Fee (₹)</label>
            <input 
              type="number" 
              min="0"
              step="1"
              value={branding.handling_fee ?? 9} 
              onChange={(e) => setBranding(prev => ({ ...prev, handling_fee: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 9"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Free Delivery Min Order (₹)</label>
            <input 
              type="number" 
              min="0"
              step="10"
              disabled={branding.free_delivery_enabled === false}
              value={branding.free_delivery_min_amount ?? 149} 
              onChange={(e) => setBranding(prev => ({ ...prev, free_delivery_min_amount: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 149"
              className="form-input"
              style={{ opacity: branding.free_delivery_enabled === false ? 0.6 : 1 }}
            />
          </div>

          <div className="form-group">
            <label>Surge / Rain Fee (₹)</label>
            <input 
              type="number" 
              min="0"
              step="5"
              disabled={!branding.surge_enabled}
              value={branding.surge_fee ?? 15} 
              onChange={(e) => setBranding(prev => ({ ...prev, surge_fee: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 15"
              className="form-input"
              style={{ opacity: !branding.surge_enabled ? 0.6 : 1 }}
            />
          </div>
        </div>

        {/* Toggles Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Free Delivery Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '13.5px' }}>Free Delivery Criteria</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                {branding.free_delivery_enabled !== false ? `Active on orders above ₹${branding.free_delivery_min_amount ?? 149}` : 'Disabled (Delivery fee applies to all orders)'}
              </div>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
              <input 
                type="checkbox" 
                checked={branding.free_delivery_enabled !== false}
                onChange={(e) => setBranding(prev => ({ ...prev, free_delivery_enabled: e.target.checked }))}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: branding.free_delivery_enabled !== false ? '#10b981' : '#cbd5e1',
                borderRadius: '34px', transition: '.3s'
              }}>
                <span style={{
                  position: 'absolute', height: '18px', width: '18px', left: branding.free_delivery_enabled !== false ? '24px' : '3px', bottom: '3px',
                  backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                }} />
              </span>
            </label>
          </div>

          {/* Surge Pricing Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '13.5px', color: branding.surge_enabled ? '#b45309' : 'inherit' }}>
                🌧️ High Demand / Surge Fee
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                {branding.surge_enabled ? `+₹${branding.surge_fee ?? 15} surge fee applied during peak/bad weather` : 'Normal operational pricing (no surge fee)'}
              </div>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
              <input 
                type="checkbox" 
                checked={!!branding.surge_enabled}
                onChange={(e) => setBranding(prev => ({ ...prev, surge_enabled: e.target.checked }))}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: branding.surge_enabled ? '#f59e0b' : '#cbd5e1',
                borderRadius: '34px', transition: '.3s'
              }}>
                <span style={{
                  position: 'absolute', height: '18px', width: '18px', left: branding.surge_enabled ? '24px' : '3px', bottom: '3px',
                  backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Save Fees Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Fee policies & pricing saved successfully!', 'success');
              } catch (err) {
                showToast('Failed to save fees: ' + err.message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="save-btn"
            style={{ width: 'auto', padding: '10px 24px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Fee Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
