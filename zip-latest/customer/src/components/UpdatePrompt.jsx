import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { supabase, db } from '../services/db';
import { applyDynamicBrandingIcons } from '../utils/dynamicManifest';

function UpdatePrompt() {
  const [brandingUpdateAvailable, setBrandingUpdateAvailable] = useState(false);
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [updateMessage, setUpdateMessage] = useState('New app icon & brand update available!');

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

  // Realtime Branding & Logo update detector
  useEffect(() => {
    const channel = supabase.channel('app-global-branding-listener')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: 'id=eq.00000000-0000-0000-0000-000000000001' 
      }, (payload) => {
        if (payload.new?.address) {
          try {
            const data = JSON.parse(payload.new.address);
            const cachedCustomerLogo = localStorage.getItem('zipit_cached_customer_logo');
            // If new customer logo differs from what was cached, display the reload banner
            if (data.customer_logo && data.customer_logo !== cachedCustomerLogo) {
              setNewLogoUrl(data.customer_logo);
              setUpdateMessage('New App Icon & Brand Update Available!');
              setBrandingUpdateAvailable(true);
            }
          } catch (_) {}
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const shouldShow = needRefresh || brandingUpdateAvailable;
  if (!shouldShow) return null;

  const handleApplyUpdate = () => {
    if (newLogoUrl) {
      applyDynamicBrandingIcons(newLogoUrl, 'Zipit');
    }
    if (needRefresh) {
      updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#111827',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      zIndex: 99999,
      width: '90%',
      maxWidth: '380px',
      animation: 'fadeInUp 0.3s ease-out forwards'
    }}>
      <div style={{ background: '#0c831f', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <RefreshCw size={20} color="#ffffff" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800' }}>{updateMessage}</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Tap reload to apply latest changes.</p>
      </div>
      <button 
        onClick={handleApplyUpdate}
        style={{
          background: '#0c831f',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: '700',
          cursor: 'pointer',
          fontSize: '13px',
          boxShadow: '0 2px 8px rgba(12, 131, 31, 0.4)'
        }}
      >
        Reload
      </button>
      <button 
        onClick={() => {
          setNeedRefresh(false);
          setBrandingUpdateAvailable(false);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
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
