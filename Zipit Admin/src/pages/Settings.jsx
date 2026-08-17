import React, { useState } from 'react';
import { User, Mail, Phone, Edit2, Shield, Save } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import './Settings.css';

const Settings = ({ profile, setProfile }) => {
  const [formData, setFormData] = useState({ ...profile });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const updated = await db.user.update(formData);
    if (updated) {
      setProfile(updated);
      showToast('Profile updated successfully!', 'Success');
    } else {
      showToast('Failed to update profile.', 'Error');
    }
    setSaving(false);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Admin Settings</h2>
        <p>Manage your account settings and preferences.</p>
      </div>

      <div className="settings-card">
        <h3>Profile Information</h3>
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
                style={{backgroundColor: '#F9FAFB', cursor: 'not-allowed'}}
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
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
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
