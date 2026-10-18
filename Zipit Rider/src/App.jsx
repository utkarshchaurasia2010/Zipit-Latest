import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import OrderMapPage from './pages/OrderMapPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import OrderIncomingModal from './components/OrderIncomingModal';
import { ToastProvider } from './context/ToastContext';
import { auth } from './services/auth';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './index.css';

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '24px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px' }}>
            Something went wrong loading this screen
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '340px', margin: '0 0 20px', lineHeight: '1.4' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={15} /> Reload App
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <RouteErrorBoundary>
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
      </RouteErrorBoundary>
    </ToastProvider>
  );
}

export default App;
