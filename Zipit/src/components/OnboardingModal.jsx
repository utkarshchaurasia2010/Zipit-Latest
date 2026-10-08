import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import { Mail, User, Phone, Edit2 } from 'lucide-react';
import './OnboardingModal.css';

const OnboardingModal = ({ userProfile, onComplete }) => {
  const [formData, setFormData] = useState({ 
    name: (userProfile?.name && !userProfile?.name.startsWith('User ') && userProfile?.name !== 'New User') ? userProfile.name : '', 
    phone: userProfile?.phone || localStorage.getItem('zipit_verified_phone') || '', 
    email: userProfile?.email || '', 
    photo: userProfile?.photo || '' 
  });
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const prefillData = async () => {
      const { data } = await supabase.auth.getUser();
      const authEmail = data?.user?.email || userProfile?.email || '';
      const verifiedPhone = userProfile?.phone || localStorage.getItem('zipit_verified_phone') || '';
      setFormData(prev => ({ 
        ...prev, 
        email: authEmail || prev.email,
        phone: verifiedPhone || prev.phone
      }));
    };
    prefillData();
  }, [userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    
    // Auto-generate initials if empty
    let photoInitials = formData.photo.trim();
    if (!photoInitials) {
      photoInitials = formData.name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }

    const payload = {
      ...formData,
      photo: photoInitials || 'NU'
    };

    setLoading(true);
    const updated = await db.user.update(payload);
    setLoading(false);
    
    if (updated) {
      // Smooth closing animation
      setClosing(true);
      setTimeout(() => {
        onComplete(updated);
      }, 400); // Wait for animation
    }
  };

  return (
    <>
      <div className={`onboarding-overlay ${closing ? 'fade-out' : ''}`} />
      <div className={`onboarding-modal ${closing ? 'slide-down' : ''}`}>
        <div className="onboarding-header">
          <h2>Welcome to Zipit!</h2>
          <p>Please complete your profile to continue.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="modern-input-group">
            <div className="email-prefix"><User size={18} color="#FFF" /></div>
            <input 
              type="text" 
              placeholder="Full Name" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
              disabled={loading}
              autoFocus
            />
          </div>
          
          <div className="modern-input-group">
            <div className="email-prefix"><Phone size={18} color="#FFF" /></div>
            <input 
              type="tel" 
              placeholder="Mobile Number" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
              required
              disabled={loading}
              maxLength={10}
            />
          </div>
          
          <div className="modern-input-group disabled-input-group">
            <div className="email-prefix"><Mail size={18} color="#888" /></div>
            <input 
              type="email" 
              placeholder="Email Address" 
              value={formData.email}
              readOnly
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>
          
          <div className="modern-input-group">
            <div className="email-prefix"><Edit2 size={18} color="#FFF" /></div>
            <input 
              type="text" 
              placeholder="Initials (e.g. UC - Optional)" 
              maxLength={2}
              value={formData.photo}
              onChange={e => setFormData({...formData, photo: e.target.value.toUpperCase()})}
              disabled={loading}
              style={{textTransform: 'uppercase'}}
            />
          </div>
          
          <button 
            type="submit" 
            className="modern-continue-btn" 
            disabled={!formData.name.trim() || formData.phone.length < 10 || loading}
          >
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </form>
      </div>
    </>
  );
};

export default OnboardingModal;
