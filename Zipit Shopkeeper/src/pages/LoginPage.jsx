import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/auth';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const role = auth.getRole();
    if (role === 'shopkeeper' || role === 'rider') {
      window.location.href = '/';
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (code.length < 4) {
      setError('Please enter a valid code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const role = await auth.loginWithCode(code);
      if (role === 'shopkeeper' || role === 'rider') {
        window.location.href = '/';
      } else {
        setError('Unrecognized role mapped to this code.');
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
      <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Zipit Shopkeeper</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Enter your Shopkeeper access code</p>
        
        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', background: '#fef2f2', padding: '8px', borderRadius: '8px' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="e.g. SHOP7829"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '18px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }}
            maxLength={10}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#F8CB46', color: '#000', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Verifying...' : 'Access Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
