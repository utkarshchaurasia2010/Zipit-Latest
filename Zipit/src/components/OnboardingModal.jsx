import React, { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { db, supabase } from '../services/db';
import { Mail, User, Phone, CheckCircle2, ArrowLeft } from 'lucide-react';
import './OnboardingModal.css';

const OnboardingModal = ({ userProfile, onComplete, onCancel }) => {
  const getCleanPhone = (p) => {
    if (!p || p.startsWith('temp_')) return '';
    return p;
  };

  const [formData, setFormData] = useState({ 
    name: (userProfile?.name && !userProfile?.name.startsWith('User ') && userProfile?.name !== 'New User') ? userProfile.name : '', 
    phone: getCleanPhone(userProfile?.phone || localStorage.getItem('zipit_verified_phone') || ''), 
    email: userProfile?.email || '', 
    photo: (userProfile?.photo && userProfile.photo !== 'NU') ? userProfile.photo : ''
  });
  const [userEditedInitials, setUserEditedInitials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const computeInitials = (nameStr) => {
    if (!nameStr) return '';
    return nameStr
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

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

  const handleNameChange = (e) => {
    setErrorMsg('');
    const newName = e.target.value;
    setFormData(prev => ({
      ...prev,
      name: newName,
      // If user hasn't manually customized initials, keep auto-generating live
      photo: userEditedInitials ? prev.photo : computeInitials(newName)
    }));
  };

  const handleGoBack = async () => {
    if (loading || cancelling) return;
    setCancelling(true);
    try {
      // Remove placeholder record from db
      await db.user.deleteCurrentProfile();
      // Sign out from auth session
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Error during cancel cleanup:", err);
    } finally {
      setClosing(true);
      setTimeout(() => {
        if (onCancel) onCancel();
      }, 350);
    }
  };

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
    
    // Auto-generate initials if still empty or use customized value
    const photoInitials = formData.photo.trim().toUpperCase() || computeInitials(cleanName) || 'NU';

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
      try { Preferences.set({ key: 'zipit_verified_phone', value: cleanPhone }); } catch (_) {}
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
        <div className="onboarding-top-nav">
          <button 
            type="button" 
            className="onboarding-back-btn" 
            onClick={handleGoBack}
            disabled={loading || cancelling}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
        </div>

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
                onChange={handleNameChange}
                required
                disabled={loading || cancelling}
                autoFocus
              />
            </div>
          </div>

          <div className="onboarding-field">
            <div className="onboarding-label-row">
              <label className="onboarding-label">Avatar Initials</label>
              <span className="onboarding-label-hint">Auto-generated • Editable</span>
            </div>
            <div className="onboarding-input-group initials-group">
              <div className="initials-avatar-preview">
                {formData.photo || computeInitials(formData.name) || 'NU'}
              </div>
              <input 
                type="text" 
                placeholder="e.g. RS" 
                value={formData.photo}
                maxLength={2}
                onChange={e => {
                  setUserEditedInitials(true);
                  setFormData({ ...formData, photo: e.target.value.toUpperCase() });
                }}
                disabled={loading || cancelling}
                style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
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
                disabled={loading || cancelling}
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
            disabled={!formData.name.trim() || formData.phone.length < 10 || loading || cancelling}
          >
            {loading ? 'Setting up your profile...' : cancelling ? 'Cancelling...' : 'Continue to Quickly'}
          </button>
        </form>
      </div>
    </>
  );
};

export default OnboardingModal;
