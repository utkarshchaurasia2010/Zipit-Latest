import React, { useState } from 'react';
import './LoginPage.css';
import { supabase } from '../services/db';
import { Mail } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const LoginPage = ({ onLogin }) => {
  const [step, setStep] = useState(() => parseInt(localStorage.getItem('login_step')) || 1);
  const [email, setEmail] = useState(() => localStorage.getItem('login_email') || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (email.includes('@')) {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        showToast("Error sending OTP: " + error.message, "Error");
      } else {
        setStep(2);
        localStorage.setItem('login_step', '2');
      }
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length === 6) {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        showToast("Invalid OTP: " + error.message, "Error");
      } else {
        localStorage.removeItem('login_step');
        localStorage.removeItem('login_email');
        localStorage.setItem('zipit_admin_logged_in', 'true');
        onLogin();
      }
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="logo-box">
          <div className="login-logo-container">
            <img src="/logo_full.png" alt="Zipit Logo" className="login-logo-image" />
          </div>
        </div>

        <h1 className="main-title">Zipit Admin</h1>
        
        {step === 1 ? (
          <>
            <p className="sub-title">Log in to your dashboard</p>
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="modern-input-group">
                <div className="email-prefix">
                  <Mail size={18} color="#667085" />
                </div>
                <input 
                  type="email" 
                  placeholder="Enter email address" 
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    localStorage.setItem('login_email', e.target.value);
                  }}
                  autoFocus
                  disabled={loading}
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={!email.includes('@') || loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="sub-title" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              OTP sent to {email}
              <button 
                type="button"
                onClick={() => {
                  setStep(1);
                  localStorage.setItem('login_step', '1');
                  setOtp('');
                }}
                className="change-email-btn"
              >
                Change
              </button>
            </p>
            <form onSubmit={handleVerify} className="login-form">
              <div className="modern-input-group" style={{justifyContent: 'center'}}>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit OTP" 
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  disabled={loading}
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', paddingLeft: '14px', width: '100%' }}
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={otp.length < 6 || loading}
              >
                {loading ? 'Verifying...' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
