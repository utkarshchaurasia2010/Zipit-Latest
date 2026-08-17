import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered');
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      zIndex: 99999,
      width: '90%',
      maxWidth: '380px',
      animation: 'fadeInUp 0.3s ease-out forwards'
    }}>
      <RefreshCw size={24} color="#0c831f" />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>New update available!</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#ccc', marginTop: '2px' }}>Click reload to apply latest changes.</p>
      </div>
      <button 
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#0c831f',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: '700',
          cursor: 'pointer',
          fontSize: '13px'
        }}
      >
        Reload
      </button>
      <button 
        onClick={() => setNeedRefresh(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#999',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default UpdatePrompt;
