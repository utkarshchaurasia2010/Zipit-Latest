import React, { useState } from 'react';
import { supabase } from '../services/db';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'white' }}>
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: '#1e293b' }}>Zipit Partner</h1>
        <p style={{ color: '#64748b', marginBottom: '32px' }}>Login to start delivering orders.</p>
        
        {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: '#F8CB46', 
              color: '#000', 
              padding: '14px', 
              borderRadius: '12px', 
              border: 'none', 
              fontWeight: '700', 
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
