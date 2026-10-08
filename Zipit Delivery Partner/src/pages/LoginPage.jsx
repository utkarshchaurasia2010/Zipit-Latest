import React, { useState } from 'react';
import { supabase } from '../services/db';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Clean the phone number (remove spaces, +, etc)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // TRICK: Map the phone number to a pseudo-email to bypass paid SMS providers
    const pseudoEmail = `${cleanPhone}@partner.zipit.com`;

    const { error } = await supabase.auth.signInWithPassword({ email: pseudoEmail, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Incorrect Mobile Number or Access Code');
      } else {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)' }}>
      {/* Hero Header Area */}
      <div style={{ 
        height: '35vh', 
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomLeftRadius: '32px',
        borderBottomRightRadius: '32px',
        padding: '24px',
        color: '#000'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#000',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}>
          <span style={{ fontSize: '32px' }}>⚡</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Zipit Partner</h1>
        <p style={{ fontSize: '15px', fontWeight: '500', opacity: 0.8, marginTop: '8px' }}>
          Deliver fast. Earn fast.
        </p>
      </div>

      {/* Login Form */}
      <div style={{ padding: '32px 24px', flex: 1 }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px', color: 'var(--color-text)' }}>
          Welcome back
        </h2>
        
        {error && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light)', marginBottom: '8px' }}>Mobile Number</label>
            <input 
              type="tel" 
              placeholder="9999999999" 
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '14px', 
                border: '1px solid var(--color-border)', 
                backgroundColor: '#f8fafc',
                fontSize: '15px' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light)', marginBottom: '8px' }}>Access Code</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '14px', 
                border: '1px solid var(--color-border)', 
                backgroundColor: '#f8fafc',
                fontSize: '15px' 
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              marginTop: '12px',
              background: 'var(--color-primary)', 
              color: '#000', 
              padding: '16px', 
              borderRadius: '14px', 
              border: 'none', 
              fontWeight: '700', 
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(248, 203, 70, 0.3)'
            }}
          >
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
