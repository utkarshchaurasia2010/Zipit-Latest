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

      {/* App Branding & Dynamic Information Synchronization Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>🎨 App Names, Identity & Branding</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Update company names, taglines, support contact, and dynamic app logos. Changes sync across all platforms in realtime.
            </p>
          </div>
          {brandingLoading && <span style={{ fontSize: '12px', color: '#64748b' }}>Syncing branding...</span>}
        </div>

        {/* Essential App Info Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '16px 0 20px 0', padding: '16px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: '700' }}>Company / Brand Name</label>
            <input 
              type="text" 
              value={branding.app_name ?? 'Quickly'} 
              onChange={(e) => setBranding(prev => ({ ...prev, app_name: e.target.value }))}
              placeholder="e.g. Quickly"
              className="form-input"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: '700' }}>Tagline / Delivery Slogan</label>
            <input 
              type="text" 
              value={branding.app_tagline ?? 'Quickly ~ Fastest Delivery'} 
              onChange={(e) => setBranding(prev => ({ ...prev, app_tagline: e.target.value }))}
              placeholder="e.g. Quickly ~ Fastest Delivery"
              className="form-input"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: '700' }}>Official Invoice Business Name</label>
            <input 
              type="text" 
              value={branding.legal_name ?? 'Quickly Technologies & Co.'} 
              onChange={(e) => setBranding(prev => ({ ...prev, legal_name: e.target.value }))}
              placeholder="e.g. Quickly Technologies & Co."
              className="form-input"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: '700' }}>Official Support Email</label>
            <input 
              type="email" 
              value={branding.support_email ?? 'zipitrural@gmail.com'} 
              onChange={(e) => setBranding(prev => ({ ...prev, support_email: e.target.value }))}
              placeholder="e.g. support@quickly.com"
              className="form-input"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '22px' }}>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Brand details and names updated live across all apps!', 'success');
              } catch (err) {
                showToast('Failed to save brand details: ' + err.message, 'error');
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
              padding: '10px 20px',
              background: '#0c831f',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={15} color="#ffffff" strokeWidth={2.2} />
            <span>{saving ? 'Saving...' : 'Save Brand Information'}</span>
          </button>
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

      {/* Global Multi-App Controls (Customer, Rider & Shopkeeper) */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>⚡ Multi-App Ecosystem Controls</h3>
            <p style={{ color: 'var(--color-text-light)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Control order dispatch rules, rider payouts, shopkeeper SLAs, and customer app operational settings live.
            </p>
          </div>
        </div>

        {/* 1. Customer App Controls */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#10b981', margin: '0 0 12px 0' }}>
            🛒 Customer App Live Controls
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '14px' }}>
            <div className="form-group">
              <label>Default Delivery ETA (Minutes)</label>
              <input 
                type="number" 
                min="5" 
                max="60"
                value={branding.default_eta_mins ?? 16}
                onChange={(e) => setBranding(prev => ({ ...prev, default_eta_mins: parseInt(e.target.value) || 16 }))}
                placeholder="e.g. 16"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Store Opening Time</label>
              <input 
                type="time" 
                value={branding.store_open_time ?? '07:00'}
                onChange={(e) => setBranding(prev => ({ ...prev, store_open_time: e.target.value }))}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Store Closing Time</label>
              <input 
                type="time" 
                value={branding.store_close_time ?? '23:00'}
                onChange={(e) => setBranding(prev => ({ ...prev, store_close_time: e.target.value }))}
                className="form-input"
              />
            </div>
          </div>

          {/* Customer Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>Cash On Delivery (COD)</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-light)' }}>
                  {branding.cod_enabled !== false ? 'Enabled for customers' : 'Disabled (Prepaid Only)'}
                </div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                <input 
                  type="checkbox" 
                  checked={branding.cod_enabled !== false}
                  onChange={(e) => setBranding(prev => ({ ...prev, cod_enabled: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: branding.cod_enabled !== false ? '#10b981' : '#cbd5e1',
                  borderRadius: '34px', transition: '.3s'
                }}>
                  <span style={{
                    position: 'absolute', height: '16px', width: '16px', left: branding.cod_enabled !== false ? '24px' : '3px', bottom: '3px',
                    backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                  }} />
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>Online UPI Payments</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-light)' }}>
                  {branding.upi_enabled !== false ? 'Enabled (Instant QR/UPI)' : 'Disabled'}
                </div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                <input 
                  type="checkbox" 
                  checked={branding.upi_enabled !== false}
                  onChange={(e) => setBranding(prev => ({ ...prev, upi_enabled: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: branding.upi_enabled !== false ? '#10b981' : '#cbd5e1',
                  borderRadius: '34px', transition: '.3s'
                }}>
                  <span style={{
                    position: 'absolute', height: '16px', width: '16px', left: branding.upi_enabled !== false ? '24px' : '3px', bottom: '3px',
                    backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                  }} />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 2. Shopkeeper & Store SLA Controls */}
        <div style={{ marginBottom: '24px', borderTop: '1px dashed var(--color-border)', paddingTop: '18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b', margin: '0 0 12px 0' }}>
            🏪 Shopkeeper & Store SLA Controls
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label>Order Acceptance Timeout (Minutes)</label>
              <input 
                type="number" 
                min="1" 
                max="15"
                value={branding.shopkeeper_sla_mins ?? 3}
                onChange={(e) => setBranding(prev => ({ ...prev, shopkeeper_sla_mins: parseInt(e.target.value) || 3 }))}
                placeholder="e.g. 3"
                className="form-input"
              />
              <small style={{ color: 'var(--color-text-light)', fontSize: '11px' }}>Auto-alarms or reassigns if unclaimed after this time</small>
            </div>

            <div className="form-group">
              <label>Store Packing Commission / Order (₹)</label>
              <input 
                type="number" 
                min="0"
                value={branding.shopkeeper_commission_fixed ?? 10}
                onChange={(e) => setBranding(prev => ({ ...prev, shopkeeper_commission_fixed: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 10"
                className="form-input"
              />
              <small style={{ color: 'var(--color-text-light)', fontSize: '11px' }}>Standard store packing fee per fulfilled order</small>
            </div>
          </div>
        </div>

        {/* 3. Rider & Delivery Fleet Controls */}
        <div style={{ marginBottom: '20px', borderTop: '1px dashed var(--color-border)', paddingTop: '18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7', margin: '0 0 12px 0' }}>
            🛵 Rider & Fleet Partner Controls
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '14px' }}>
            <div className="form-group">
              <label>Rider Base Payout per Order (₹)</label>
              <input 
                type="number" 
                min="0" 
                value={branding.rider_base_payout ?? 25}
                onChange={(e) => setBranding(prev => ({ ...prev, rider_base_payout: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 25"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Rider Distance Bonus (₹ / KM)</label>
              <input 
                type="number" 
                min="0" 
                value={branding.rider_per_km_bonus ?? 5}
                onChange={(e) => setBranding(prev => ({ ...prev, rider_per_km_bonus: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 5"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Rider Max Cash-in-Hand Limit (₹)</label>
              <input 
                type="number" 
                min="500" 
                step="500"
                value={branding.rider_max_cash_limit ?? 2000}
                onChange={(e) => setBranding(prev => ({ ...prev, rider_max_cash_limit: parseFloat(e.target.value) || 2000 }))}
                placeholder="e.g. 2000"
                className="form-input"
              />
              <small style={{ color: 'var(--color-text-light)', fontSize: '11px' }}>Blocks new COD claims once rider reaches this cash limit</small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '13px' }}>Mandatory Delivery Handover PIN (OTP)</div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-light)' }}>
                {branding.require_delivery_otp !== false ? 'Rider must verify 4-digit customer OTP' : 'Direct Handover Allowed'}
              </div>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
              <input 
                type="checkbox" 
                checked={branding.require_delivery_otp !== false}
                onChange={(e) => setBranding(prev => ({ ...prev, require_delivery_otp: e.target.checked }))}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: branding.require_delivery_otp !== false ? '#0284c7' : '#cbd5e1',
                borderRadius: '34px', transition: '.3s'
              }}>
                <span style={{
                  position: 'absolute', height: '16px', width: '16px', left: branding.require_delivery_otp !== false ? '24px' : '3px', bottom: '3px',
                  backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Save Ecosystem Controls Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button 
            type="button" 
            onClick={async () => {
              try {
                setSaving(true);
                await db.branding.update(branding);
                showToast('Multi-App ecosystem controls updated and synced live!', 'success');
              } catch (err) {
                showToast('Failed to save controls: ' + err.message, 'error');
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
              padding: '11px 26px',
              background: '#0c831f',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13.5px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={16} color="#ffffff" strokeWidth={2.2} />
            <span>{saving ? 'Saving...' : 'Save Ecosystem Controls'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
