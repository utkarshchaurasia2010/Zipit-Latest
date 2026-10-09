import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db, supabase } from './services/db';
import LoginPage from './components/LoginPage';
import AdminLayout from './components/AdminLayout';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import AdminDashboard from './components/AdminDashboard';
import AccessCodesManager from './components/AccessCodesManager';
import { ToastProvider } from './context/ToastContext';
import './index.css';

function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    setLoading(true);
    try {
      let p = await db.user.get();
      if (p) {
        if (p.is_admin === undefined) p.is_admin = true;
        setProfile(p);
      } else {
        const adminId = localStorage.getItem('zipit_active_admin_id');
        if (adminId) {
          const { data: adminRows } = await supabase.from('profiles').select('*').eq('id', adminId).limit(1);
          if (adminRows && adminRows.length > 0) {
            setProfile({ ...adminRows[0], is_admin: true });
          } else if (localStorage.getItem('zipit_admin_logged_in') === 'true') {
            setProfile({ id: adminId || 'admin-fallback', name: 'Zipit Admin', is_admin: true });
          } else {
            setProfile(null);
          }
        } else if (localStorage.getItem('zipit_admin_logged_in') === 'true') {
          const { data: anyAdmin } = await supabase.from('profiles').select('*').limit(1);
          if (anyAdmin && anyAdmin.length > 0) {
            setProfile({ ...anyAdmin[0], is_admin: true });
          } else {
            setProfile({ id: 'admin-fallback', name: 'Zipit Admin', is_admin: true });
          }
        } else {
          setProfile(null);
        }
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      if (localStorage.getItem('zipit_admin_logged_in') === 'true') {
        setProfile({ id: 'admin-fallback', name: 'Zipit Admin', is_admin: true });
      } else {
        setProfile(null);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F8F9FA' }}>
        <div style={{ fontWeight: 600, color: '#475467' }}>Loading Admin Workspace...</div>
      </div>
    );
  }

  const isAdmin = Boolean(profile && profile.is_admin);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!isAdmin ? <LoginPage onLogin={checkUser} isEmbedded={true} /> : <Navigate to="/" />} />
          
          {isAdmin ? (
            <Route path="/" element={<AdminLayout profile={profile} setProfile={setProfile} />}>
              <Route index element={<Overview />} />
              <Route path="categories" element={<AdminDashboard key="categories" initialTab="categories" />} />
              <Route path="products" element={<AdminDashboard key="products" initialTab="products" />} />
              <Route path="grid-products" element={<AdminDashboard key="grid-products" initialTab="grid-products" />} />
              <Route path="bestsellers" element={<AdminDashboard key="bestsellers" initialTab="bestsellers" />} />
              <Route path="banners" element={<AdminDashboard key="banners" initialTab="banners" />} />
              <Route path="orders" element={<AdminDashboard key="orders" initialTab="orders" />} />
              <Route path="refunds" element={<AdminDashboard key="refunds" initialTab="refunds" />} />
              <Route path="coupons" element={<AdminDashboard key="coupons" initialTab="coupons" />} />
              <Route path="users" element={<AdminDashboard key="users" initialTab="users" />} />
              <Route path="access-codes" element={<AccessCodesManager />} />
              <Route path="settings" element={<Settings profile={profile} setProfile={setProfile} />} />
              <Route path="*" element={<Navigate to="/orders" replace />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/login" />} />
          )}
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
