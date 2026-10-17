import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import { Mail, User, Phone, CheckCircle2 } from 'lucide-react';
import './OnboardingModal.css';

const OnboardingModal = ({ userProfile, onComplete }) => {
  const getCleanPhone = (p) => {
    if (!p || p.startsWith('temp_')) return '';
    return p;
  };

  const [formData, setFormData] = useState({ 
    name: (userProfile?.name && !userProfile?.name.startsWith('User ') && userProfile?.name !== 'New User') ? userProfile.name : '', 
    phone: getCleanPhone(userProfile?.phone || localStorage.getItem('zipit_verified_phone') || ''), 
    email: userProfile?.email || '', 
  });
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const prefillData = async () => {
      const { data } = await supabase.auth.getUser();
      const authEmail = data?.user?.email || userProfile?.email || '';
      const verifiedPhone = getCleanPhone(userProfile?.phone || localStorage.getItem('zipit_verified_phone') || '');
      setFormData(prev => ({ 
        ...prev, 
        email: authEmail || prev.email,
        phone: prev.phone || verifiedPhone
      }));
    };
    prefillData();
  }, [userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();

    if (!cleanName) {
      setErrorMsg('Please enter your full name');
      return;
    }

    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    
    // Auto-generate initials from the entered full name
    const photoInitials = cleanName
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NU';

    const payload = {
      name: cleanName,
      phone: cleanPhone,
      email: formData.email,
      photo: photoInitials
    };

    setLoading(true);
    const res = await db.user.update(payload);
    setLoading(false);
    
    if (res?.data) {
      localStorage.setItem('zipit_verified_phone', cleanPhone);
      setClosing(true);
      setTimeout(() => {
        onComplete(res.data);
      }, 350);
    } else if (res?.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <>
      <div className={`onboarding-overlay ${closing ? 'fade-out' : ''}`} />
      <div className={`onboarding-modal ${closing ? 'slide-down' : ''}`}>
        <div className="onboarding-header">
          <div className="onboarding-badge">
            <CheckCircle2 size={16} color="#10B981" />
            <span>Almost there!</span>
          </div>
          <h2>Complete Your Profile</h2>
          <p>Please enter your details so we can deliver your orders quickly and smoothly.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="onboarding-form">
          {errorMsg && (
            <div className="onboarding-error-banner">
              {errorMsg}
            </div>
          )}

          <div className="onboarding-field">
            <label className="onboarding-label">Full Name</label>
            <div className="onboarding-input-group">
              <div className="onboarding-prefix"><User size={18} color="#94A3B8" /></div>
              <input 
                type="text" 
                placeholder="e.g. Rahul Sharma" 
                value={formData.name}
                onChange={e => {
                  setErrorMsg('');
                  setFormData({...formData, name: e.target.value});
                }}
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
          
          <div className="onboarding-field">
            <label className="onboarding-label">Mobile Number</label>
            <div className="onboarding-input-group">
              <div className="onboarding-prefix">
                <Phone size={18} color="#94A3B8" />
                <span className="country-code">+91</span>
              </div>
              <input 
                type="tel" 
                placeholder="10-digit mobile number" 
                value={formData.phone}
                onChange={e => {
                  setErrorMsg('');
                  setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                }}
                required
                disabled={loading}
                maxLength={10}
              />
            </div>
          </div>
          
          {formData.email && (
            <div className="onboarding-field">
              <label className="onboarding-label">Registered Email</label>
              <div className="onboarding-input-group onboarding-disabled-group">
                <div className="onboarding-prefix"><Mail size={18} color="#64748B" /></div>
                <input 
                  type="email" 
                  value={formData.email}
                  readOnly
                  disabled
                />
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="onboarding-submit-btn" 
            disabled={!formData.name.trim() || formData.phone.length < 10 || loading}
          >
            {loading ? 'Setting up your profile...' : 'Continue to Zipit'}
          </button>
        </form>
      </div>
    </>
  );
};

export default OnboardingModal;
