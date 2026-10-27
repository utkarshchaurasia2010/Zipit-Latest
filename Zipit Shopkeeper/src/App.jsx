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
    const code = auth.getCode();
    if (!code) {
      setRole(null);
      return;
    }

    // 1. Immediate validation against database
    const verifyCodeActive = async () => {
      try {
        const { data, error } = await supabase
          .from('access_codes')
          .select('is_active, role')
          .eq('code', code.toUpperCase())
          .single();

        if (error || !data || data.is_active === false) {
          auth.logout();
        }
      } catch (e) {
        console.warn('Access code verification check skipped:', e);
      }
    };
    verifyCodeActive();

    // 2. Realtime listener: if Admin deactivates/deletes this code, immediately log out
    const channel = supabase
      .channel(`shopkeeper-access-guard-${code}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'access_codes' 
      }, (payload) => {
        const changedCode = (payload.new?.code || payload.old?.code || '').toUpperCase();
        if (changedCode === code.toUpperCase()) {
          if (payload.eventType === 'DELETE' || payload.new?.is_active === false) {
            alert('Your Shopkeeper access has been deactivated by Admin.');
            auth.logout();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
