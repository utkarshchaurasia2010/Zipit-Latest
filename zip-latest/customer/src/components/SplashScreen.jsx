import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import { applyDynamicBrandingIcons } from '../utils/dynamicManifest';
import './SplashScreen.css';

const SplashScreen = () => {
  const [logo, setLogo] = useState(() => {
    const cached = localStorage.getItem('zipit_cached_customer_logo') || '/logo_full.png';
    if (cached) applyDynamicBrandingIcons(cached, 'Zipit');
    return cached;
  });

  useEffect(() => {
    db.branding.get().then(b => {
      if (b?.customer_logo) {
        setLogo(b.customer_logo);
        applyDynamicBrandingIcons(b.customer_logo, 'Zipit');
      }
    });
  }, []);

  return (
    <div className="splash-screen">
      <div className="splash-logo-container">
        <img src={logo} alt="Zipit Logo" className="splash-logo" />
      </div>
      <div className="splash-brand-text">zipit</div>
      <div className="splash-tagline">Rural India's Instant Delivery</div>
    </div>
  );
};

export default SplashScreen;
