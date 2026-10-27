import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  KeyRound, 
  Save, 
  Upload, 
  Image as ImageIcon, 
  MapPin, 
  Truck, 
  CreditCard, 
  Clock, 
  Store, 
  Bike, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import './Settings.css';

const LOGO_CONFIGS = [
  { key: 'customer_logo', title: 'Customer App', role: 'PWA & Splash' },
  { key: 'admin_logo', title: 'Admin Workspace', role: 'Header & Nav' },
  { key: 'rider_logo', title: 'Rider App', role: 'Rider Portal' },
  { key: 'shopkeeper_logo', title: 'Shopkeeper App', role: 'Store Portal' }
];

const Settings = ({ profile, setProfile }) => {
  const [formData, setFormData] = useState({ 
    ...profile, 
    admin_code: profile?.admin_code || localStorage.getItem('zipit_admin_custom_code') || '737920' 
  });
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({});
  const [uploadingKey, setUploadingKey] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    const data = await db.branding.get();
    if (data) {
      setBranding(data);
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

  const handleLogoUpload = async (key, file) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const publicUrl = await db.branding.uploadLogo(key, file);
      const updated = {
        ...branding,
        [key]: publicUrl
      };
      await db.branding.update(updated);
      setBranding(updated);
      showToast('Logo updated successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to upload logo', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (formData.admin_code && formData.admin_code.length !== 6) {
      showToast('Admin code must be exactly 6 digits.', 'error');
      return;
    }
    setSaving(true);
    const result = await db.user.update(formData);
    if (result?.data) {
      setProfile(result.data);
      if (formData.admin_code) {
        localStorage.setItem('zipit_admin_custom_code', formData.admin_code);
      }
      showToast('Profile and access code saved.', 'success');
    } else {
      showToast(result?.error || 'Failed to update profile.', 'error');
    }
    setSaving(false);
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await db.branding.update(branding);
      showToast('Settings saved successfully.', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>System Settings</h2>
        <p>Configure workspace security, operational parameters, and app fleet controls.</p>
      </div>

      {/* 1. Admin Security & Profile */}
      <div className="settings-card">
        <div className="card-title-row">
          <div className="card-title-icon"><ShieldCheck size={18} /></div>
          <h3>Admin Security & Access</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="settings-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <User size={16} />
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon disabled">
                <Mail size={16} />
                <input 
                  type="email" 
                  value={formData.email || ''} 
                  disabled 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <div className="input-with-icon">
                <Phone size={16} />
                <input 
                  type="text" 
                  value={formData.phone || ''} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} 
                  placeholder="10-digit number"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="form-group">
              <label>6-Digit Admin Unlock Code</label>
              <div className="input-with-icon">
                <KeyRound size={16} />
                <input 
                  type="text" 
                  value={formData.admin_code || ''} 
                  onChange={e => setFormData({ ...formData, admin_code: e.target.value.replace(/\D/g, '').slice(0, 6) })} 
                  placeholder="737920"
                  maxLength={6}
                  style={{ letterSpacing: '4px', fontWeight: '700' }}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving} className="save-btn">
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Profile & Code'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Brand Identity & Invoicing Details */}
      <div className="settings-card">
        <div className="card-title-row">
          <div className="card-title-icon"><Store size={18} /></div>
          <h3>Brand Identity & Invoicing</h3>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Brand Name</label>
            <input 
              type="text" 
              value={branding.app_name ?? 'Quickly'} 
              onChange={e => setBranding(prev => ({ ...prev, app_name: e.target.value }))}
              placeholder="e.g. Quickly"
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Tagline / Slogan</label>
            <input 
              type="text" 
              value={branding.app_tagline ?? 'Quickly ~ Fastest Delivery'} 
              onChange={e => setBranding(prev => ({ ...prev, app_tagline: e.target.value }))}
              placeholder="e.g. Quickly ~ Fastest Delivery"
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Legal Business Name</label>
            <input 
              type="text" 
              value={branding.legal_name ?? 'Quickly Technologies & Co.'} 
              onChange={e => setBranding(prev => ({ ...prev, legal_name: e.target.value }))}
              placeholder="e.g. Quickly Technologies & Co."
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Support Contact Email</label>
            <input 
              type="email" 
              value={branding.support_email ?? 'zipitrural@gmail.com'} 
              onChange={e => setBranding(prev => ({ ...prev, support_email: e.target.value }))}
              placeholder="e.g. support@quickly.com"
              className="clean-input"
            />
          </div>
        </div>

        {/* Logos Grid */}
        <div className="logos-section-title">Application Logos</div>
        <div className="branding-grid">
          {LOGO_CONFIGS.map(({ key, title, role }) => {
            const currentUrl = branding[key];
            const isUploading = uploadingKey === key;

            return (
              <div key={key} className="logo-card">
                <div className="logo-card-header">
                  <span className="logo-name">{title}</span>
                  <span className="logo-badge">{role}</span>
                </div>

                <div className="logo-box">
                  {currentUrl ? (
                    <img src={currentUrl} alt={title} className="logo-img" />
                  ) : (
                    <div className="logo-empty">
                      <ImageIcon size={20} />
                      <span>No Logo</span>
                    </div>
                  )}
                </div>

                <label className={`upload-action-btn ${isUploading ? 'loading' : ''}`}>
                  <Upload size={13} />
                  <span>{isUploading ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload'}</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(key, file);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleSaveBranding} disabled={saving} className="save-btn">
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Brand Settings'}</span>
          </button>
        </div>
      </div>

      {/* 3. Delivery Service & Geofencing */}
      <div className="settings-card">
        <div className="card-title-row">
          <div className="card-title-icon"><MapPin size={18} /></div>
          <h3>Geofence & Dispatch Radius</h3>
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label>Hub Latitude</label>
            <input 
              type="number" 
              step="0.0001"
              value={branding.store_lat ?? 25.5788} 
              onChange={e => setBranding(prev => ({ ...prev, store_lat: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Hub Longitude</label>
            <input 
              type="number" 
              step="0.0001"
              value={branding.store_lng ?? 83.5780} 
              onChange={e => setBranding(prev => ({ ...prev, store_lng: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
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
              onChange={e => setBranding(prev => ({ ...prev, max_delivery_radius_km: parseFloat(e.target.value) || 1 }))}
              className="clean-input"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleSaveBranding} disabled={saving} className="save-btn">
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Geofence'}</span>
          </button>
        </div>
      </div>

      {/* 4. Customer Delivery & Fees */}
      <div className="settings-card">
        <div className="card-title-row">
          <div className="card-title-icon"><Truck size={18} /></div>
          <h3>Customer Orders & Fees</h3>
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label>Delivery Fee (₹)</label>
            <input 
              type="number" 
              min="0"
              step="1"
              value={branding.delivery_fee ?? 20} 
              onChange={e => setBranding(prev => ({ ...prev, delivery_fee: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Handling Charge (₹)</label>
            <input 
              type="number" 
              min="0"
              step="1"
              value={branding.handling_fee ?? 9} 
              onChange={e => setBranding(prev => ({ ...prev, handling_fee: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Free Delivery Threshold (₹)</label>
            <input 
              type="number" 
              min="0"
              step="10"
              value={branding.free_delivery_min_amount ?? 149} 
              onChange={e => setBranding(prev => ({ ...prev, free_delivery_min_amount: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Estimated Delivery Time (Mins)</label>
            <input 
              type="number" 
              min="5"
              max="60"
              value={branding.default_eta_mins ?? 16} 
              onChange={e => setBranding(prev => ({ ...prev, default_eta_mins: parseInt(e.target.value) || 16 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Opening Time</label>
            <input 
              type="time" 
              value={branding.store_open_time ?? '07:00'} 
              onChange={e => setBranding(prev => ({ ...prev, store_open_time: e.target.value }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Closing Time</label>
            <input 
              type="time" 
              value={branding.store_close_time ?? '23:00'} 
              onChange={e => setBranding(prev => ({ ...prev, store_close_time: e.target.value }))}
              className="clean-input"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="toggles-grid">
          <div className="clean-toggle-box">
            <div>
              <span className="toggle-label">Cash on Delivery (COD)</span>
              <span className="toggle-subtext">{branding.cod_enabled !== false ? 'Enabled' : 'Disabled'}</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={branding.cod_enabled !== false} 
                onChange={e => setBranding(prev => ({ ...prev, cod_enabled: e.target.checked }))} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="clean-toggle-box">
            <div>
              <span className="toggle-label">UPI / Online Gateway</span>
              <span className="toggle-subtext">{branding.upi_enabled !== false ? 'Enabled' : 'Disabled'}</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={branding.upi_enabled !== false} 
                onChange={e => setBranding(prev => ({ ...prev, upi_enabled: e.target.checked }))} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleSaveBranding} disabled={saving} className="save-btn">
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Order & Fee Settings'}</span>
          </button>
        </div>
      </div>

      {/* 5. Shopkeeper & Rider Operations */}
      <div className="settings-card">
        <div className="card-title-row">
          <div className="card-title-icon"><Bike size={18} /></div>
          <h3>Partner Fleet & SLA Controls</h3>
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label>Shop Acceptance Timeout (Mins)</label>
            <input 
              type="number" 
              min="1"
              max="15"
              value={branding.shopkeeper_sla_mins ?? 3} 
              onChange={e => setBranding(prev => ({ ...prev, shopkeeper_sla_mins: parseInt(e.target.value) || 3 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Shop Packing Commission (₹)</label>
            <input 
              type="number" 
              min="0"
              value={branding.shopkeeper_commission_fixed ?? 10} 
              onChange={e => setBranding(prev => ({ ...prev, shopkeeper_commission_fixed: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Rider Base Payout (₹)</label>
            <input 
              type="number" 
              min="0"
              value={branding.rider_base_payout ?? 25} 
              onChange={e => setBranding(prev => ({ ...prev, rider_base_payout: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Rider Distance Bonus (₹/km)</label>
            <input 
              type="number" 
              min="0"
              value={branding.rider_per_km_bonus ?? 5} 
              onChange={e => setBranding(prev => ({ ...prev, rider_per_km_bonus: parseFloat(e.target.value) || 0 }))}
              className="clean-input"
            />
          </div>

          <div className="form-group">
            <label>Rider Cash-in-Hand Limit (₹)</label>
            <input 
              type="number" 
              min="500"
              step="500"
              value={branding.rider_max_cash_limit ?? 2000} 
              onChange={e => setBranding(prev => ({ ...prev, rider_max_cash_limit: parseFloat(e.target.value) || 2000 }))}
              className="clean-input"
            />
          </div>
        </div>

        <div className="toggles-grid" style={{ marginTop: '16px' }}>
          <div className="clean-toggle-box">
            <div>
              <span className="toggle-label">Customer Handover OTP</span>
              <span className="toggle-subtext">{branding.require_delivery_otp !== false ? 'Required' : 'Optional'}</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={branding.require_delivery_otp !== false} 
                onChange={e => setBranding(prev => ({ ...prev, require_delivery_otp: e.target.checked }))} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleSaveBranding} disabled={saving} className="save-btn">
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Fleet Controls'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
