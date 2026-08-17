import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './services/db';
import DashboardPage from './pages/DashboardPage';
import OrderMapPage from './pages/OrderMapPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate('/login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) navigate('/login');
      else navigate('/');
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="app-container" style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: 'var(--color-bg, #f8fafc)', position: 'relative' }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/order/:id" element={<OrderMapPage />} />
      </Routes>
    </div>
  );
}

export default App;
