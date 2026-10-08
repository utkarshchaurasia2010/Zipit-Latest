import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ShopkeeperLayout from './components/ShopkeeperLayout';
import ShopkeeperDashboard from './pages/ShopkeeperDashboard';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './pages/LoginPage';
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
          <Route path="/login" element={<LoginPage portalName="Zipit Shopkeeper" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<ShopkeeperLayout />}>
          <Route index element={<ShopkeeperDashboard />} />
          <Route path="orders" element={<ShopkeeperDashboard />} />
          <Route path="categories" element={<AdminDashboard key="categories" initialTab="categories" />} />
          <Route path="products" element={<AdminDashboard key="products" initialTab="products" />} />
          <Route path="grid-products" element={<AdminDashboard key="grid-products" initialTab="grid-products" />} />
          <Route path="bestsellers" element={<AdminDashboard key="bestsellers" initialTab="bestsellers" />} />
          <Route path="banners" element={<AdminDashboard key="banners" initialTab="banners" />} />
          <Route path="refunds" element={<AdminDashboard key="refunds" initialTab="refunds" />} />
          <Route path="coupons" element={<AdminDashboard key="coupons" initialTab="coupons" />} />
          <Route path="users" element={<AdminDashboard key="users" initialTab="users" />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

export default App;
