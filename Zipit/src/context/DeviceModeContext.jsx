import React, { createContext, useContext, useState, useEffect } from 'react';

const DeviceModeContext = createContext();

export const DeviceModeProvider = ({ children }) => {
  // 'auto' (detect screen size), 'desktop' (force desktop website), or 'phone' (force mobile phone layout)
  const [deviceMode, setDeviceMode] = useState(() => {
    return localStorage.getItem('zipit_device_mode') || 'auto';
  });

  const [isDesktopScreen, setIsDesktopScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate effective layout mode
  // If user explicitly chose 'phone', force phone even on wide screens.
  // If 'auto', respect media queries / screen size.
  const isPhoneForced = deviceMode === 'phone';
  const isDesktopForced = deviceMode === 'desktop';
  const effectiveIsDesktop = !isPhoneForced && (isDesktopForced || isDesktopScreen);

  useEffect(() => {
    localStorage.setItem('zipit_device_mode', deviceMode);
    
    // Apply class to body so CSS can conditionally trigger desktop vs phone styling
    if (deviceMode === 'phone') {
      document.body.classList.add('force-phone-mode');
      document.body.classList.remove('force-desktop-mode');
    } else if (deviceMode === 'desktop') {
      document.body.classList.add('force-desktop-mode');
      document.body.classList.remove('force-phone-mode');
    } else {
      document.body.classList.remove('force-phone-mode');
      document.body.classList.remove('force-desktop-mode');
    }
  }, [deviceMode]);

  const togglePhoneMode = () => {
    setDeviceMode(prev => (prev === 'phone' ? 'auto' : 'phone'));
  };

  return (
    <DeviceModeContext.Provider value={{ 
      deviceMode, 
      setDeviceMode, 
      isPhoneForced, 
      effectiveIsDesktop, 
      togglePhoneMode 
    }}>
      {children}
    </DeviceModeContext.Provider>
  );
};

export const useDeviceMode = () => useContext(DeviceModeContext);
