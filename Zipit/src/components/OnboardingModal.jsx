import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import { Mail, User, Phone, Edit2 } from 'lucide-react';
import './OnboardingModal.css';

const OnboardingModal = ({ userProfile, onComplete }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', photo: '' });
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Attempt to prefill email from auth session
    const fetchEmail = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setFormData(prev => ({ ...prev, email: data.user.email }));
      }
    };
    fetchEmail();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await db.user.update(formData);
    
    // Smooth closing animation
    setClosing(true);
    setTimeout(() => {
      onComplete(formData);
    }, 400); // Wait for animation
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
            />
          </div>
          
          <div className="modern-input-group">
            <div className="email-prefix"><Phone size={18} color="#FFF" /></div>
            <input 
              type="tel" 
              placeholder="Mobile Number" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          
          <div className="modern-input-group">
            <div className="email-prefix"><Mail size={18} color="#FFF" /></div>
            <input 
              type="email" 
              placeholder="Email Address" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          
          <div className="modern-input-group">
            <div className="email-prefix"><Edit2 size={18} color="#FFF" /></div>
            <input 
              type="text" 
              placeholder="Initials (e.g. UC)" 
              maxLength={2}
              value={formData.photo}
              onChange={e => setFormData({...formData, photo: e.target.value})}
              required
              disabled={loading}
              style={{textTransform: 'uppercase'}}
            />
          </div>
          
          <button 
            type="submit" 
            className="modern-continue-btn" 
            disabled={!formData.name || !formData.phone || !formData.email || !formData.photo || loading}
          >
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </form>
      </div>
    </>
  );
};

export default OnboardingModal;
