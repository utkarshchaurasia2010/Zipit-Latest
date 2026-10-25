import React from 'react';
import { RotateCw, AlertTriangle } from 'lucide-react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled app error captured by AppErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--color-background, #f8fafc)',
          color: 'var(--color-text, #0f172a)',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20
          }}>
            <AlertTriangle size={32} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
            Oops! Something interrupted Quickly
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-light, #64748b)', maxWidth: '320px', margin: '0 0 24px', lineHeight: 1.5 }}>
            An unexpected error occurred while loading this section. Let's get you back on track!
          </p>
          <button
            onClick={this.handleReload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '24px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <RotateCw size={16} /> Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
