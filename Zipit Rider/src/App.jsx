import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import OrderMapPage from './pages/OrderMapPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import OrderIncomingModal from './components/OrderIncomingModal';
import { ToastProvider } from './context/ToastContext';
import { auth } from './services/auth';
import './index.css';

function App() {
  const [role, setRole] = useState(auth.getRole());

  useEffect(() => {
    const currentRole = auth.getRole();
    if (!currentRole) {
      setRole(null);
    } else {
      setRole(currentRole);
    }
  }, []);

  if (!role) {
    return (
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage portalName="Zipit Rider" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {/* Realtime Incoming Order Alarm & Ringing Bell for Rider */}
      <OrderIncomingModal role="rider" />

      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<DashboardPage />} />
        <Route path="/map/:id" element={<OrderMapPage />} />
        <Route path="/order/:id" element={<OrderMapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;
