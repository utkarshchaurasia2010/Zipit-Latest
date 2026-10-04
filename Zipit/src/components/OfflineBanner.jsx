import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import './OfflineBanner.css';

const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div className={`offline-banner-pill ${!isOnline ? 'is-offline' : 'is-restored'}`}>
      {!isOnline ? (
        <>
          <WifiOff size={15} className="offline-icon" />
          <span>No Internet • Offline Catalog Active</span>
        </>
      ) : (
        <>
          <Wifi size={15} className="online-icon" />
          <span>Back Online • Synchronized</span>
        </>
      )}
    </div>
  );
};

export default OfflineBanner;
