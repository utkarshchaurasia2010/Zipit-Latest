import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Edit2, Shield, Save, KeyRound, Upload, Image as ImageIcon, CheckCircle, Smartphone } from 'lucide-react';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>Store Geofencing & Delivery Radius</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Define dispatch coordinates and maximum delivery range to control order serviceability.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
          <div className="form-group">
            <label>Store Latitude</label>
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
            <label>Store Longitude</label>
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
            <label>Max Delivery Radius (km)</label>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface-muted)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text)', flex: 1, minWidth: '240px' }}>
            Customers beyond <strong>{branding.max_delivery_radius_km ?? 8.5} km</strong> cannot place orders.
          </div>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Geofence boundaries saved successfully.', 'success');
              } catch (err) {
                showToast('Failed to save geofence: ' + err.message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="save-settings-btn"
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '11px 22px',
              background: '#0c831f',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13.5px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Save size={16} color="#ffffff" strokeWidth={2.2} />
            <span>{saving ? 'Saving...' : 'Save Geofence'}</span>
          </button>
        </div>
      </div>

      {/* Delivery & Service Cost Management Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>Delivery & Service Fee Controls</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Manage delivery charges, platform handling fees, surge pricing, and free delivery thresholds.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
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
              <div style={{ fontWeight: '700', fontSize: '13.5px' }}>Free Delivery Threshold</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                {branding.free_delivery_enabled !== false ? `Active on orders above ₹${branding.free_delivery_min_amount ?? 149}` : 'Disabled'}
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
              <div style={{ fontWeight: '700', fontSize: '13.5px' }}>
                High Demand / Surge Pricing
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                {branding.surge_enabled ? `+₹${branding.surge_fee ?? 15} surge charge active` : 'Standard rates active'}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Fee policies & pricing saved successfully.', 'success');
              } catch (err) {
                showToast('Failed to save fees: ' + err.message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="save-settings-btn"
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '11px 24px',
              background: '#0c831f',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13.5px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Save size={16} color="#ffffff" strokeWidth={2.2} />
            <span>{saving ? 'Saving...' : 'Save Fee Settings'}</span>
          </button>
        </div>
      </div>

      {/* 5. Mobile App Live Over-the-Air (OTA) Updates */}
      <div className="settings-card" style={{ marginTop: '24px' }}>
        <div className="card-title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', color: '#0c831f' }}><Smartphone size={20} /></div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Mobile App Live OTA Updates (Capgo)</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-light, #64748b)', marginBottom: '16px' }}>
          Push JavaScript, CSS, and UI updates directly to installed customer Android devices in real-time without requiring APK reinstallation or app store review delays.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '600' }}>Live OTA Bundle Version</label>
            <input 
              type="text" 
              value={branding.ota_bundle_version || ''} 
              onChange={e => setBranding(prev => ({ ...prev, ota_bundle_version: e.target.value }))}
              placeholder="e.g. 1.0.1 or commit hash"
              className="form-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border, #cbd5e1)' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '600' }}>Live Bundle Package URL (.zip)</label>
            <input 
              type="url" 
              value={branding.ota_bundle_url || ''} 
              onChange={e => setBranding(prev => ({ ...prev, ota_bundle_url: e.target.value }))}
              placeholder="https://.../Quickly-OTA-Bundle.zip"
              className="form-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border, #cbd5e1)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Live OTA Update settings published to all devices!', 'success');
              } catch (err) {
                showToast('Failed to deploy OTA update: ' + err.message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="save-settings-btn"
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '11px 24px',
              background: '#0c831f',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13.5px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Smartphone size={16} color="#ffffff" strokeWidth={2.2} />
            <span>{saving ? 'Publishing...' : 'Deploy Live OTA Update'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
