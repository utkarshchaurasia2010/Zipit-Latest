import React, { useState } from 'react';
import './LoginPage.css';
import { supabase, db } from '../services/db';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const DEFAULT_ADMIN_ACCESS_CODE = '737920'; // Default 6-digit admin access code

const LoginPage = ({ onLogin }) => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleCodeLogin = async (e) => {
    e.preventDefault();
    if (accessCode.length !== 6) {
      showToast("Please enter a valid 6-digit Admin Code", "Error");
      return;
    }

    setLoading(true);
    try {
      // Find admin profile or match custom code
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', true)
        .limit(1);

      const targetAdmin = adminProfiles?.[0];

      // Extract custom code from admin address tag or local storage
      const tagMatch = targetAdmin?.address?.match(/---ADMIN_CODE:(\d{6})---/);
      const customCode = tagMatch ? tagMatch[1] : (localStorage.getItem('zipit_admin_custom_code') || DEFAULT_ADMIN_ACCESS_CODE);
      const phoneDigits = targetAdmin?.phone ? targetAdmin.phone.replace(/\D/g, '').slice(-6) : null;

      const isAuthorized = accessCode === customCode || accessCode === DEFAULT_ADMIN_ACCESS_CODE || (phoneDigits && accessCode === phoneDigits);

      if (isAuthorized) {
        if (targetAdmin?.id) {
          localStorage.setItem('zipit_active_admin_id', targetAdmin.id);
        }
        localStorage.setItem('zipit_admin_logged_in', 'true');
        showToast("Welcome back, Administrator!", "Success");
        onLogin();
      } else {
        showToast("Invalid 6-digit Admin Code", "Error");
      }
    } catch (err) {
      showToast("Login error: " + err.message, "Error");
    } finally {
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
        <p className="sub-title">Enter your 6-digit security code to unlock the admin panel</p>

        <form onSubmit={handleCodeLogin} className="login-form">
          <div className="modern-input-group" style={{ justifyContent: 'center' }}>
            <input
              type="password"
              placeholder="••••••"
              maxLength={6}
              value={accessCode}
              onChange={e => setAccessCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              disabled={loading}
              style={{ textAlign: 'center', letterSpacing: '12px', fontSize: '24px', paddingLeft: '14px', width: '100%', fontWeight: '700' }}
            />
          </div>

          <button
            type="submit"
            className="modern-continue-btn"
            disabled={accessCode.length !== 6 || loading}
          >
            {loading ? 'Verifying Code...' : 'Unlock Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
