import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Edit2, Shield, Save, KeyRound } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import './Settings.css';

const Settings = ({ profile, setProfile }) => {
  const [formData, setFormData] = useState({ 
    ...profile, 
    admin_code: profile?.admin_code || localStorage.getItem('zipit_admin_custom_code') || '737920' 
  });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

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
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
