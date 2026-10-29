import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('ServiceWorker registration successful');
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Protect assets/images from direct context saving without blocking DevTools / Inspect on desktop
window.addEventListener('contextmenu', (e) => {
  const target = e.target;
  const tag = target?.tagName?.toUpperCase();
  // Specifically prevent right-click saving on images, picture sources, or marked asset elements
  if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || target?.closest?.('img, [data-protect-img]')) {
    e.preventDefault();
  }
});

// OAuth Callback Bridge: If opened in mobile browser after Google Auth, redirect back to native app
try {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if ((hash.includes('access_token=') || search.includes('code=')) && !window.Capacitor?.isNativePlatform?.()) {
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobileDevice) {
      const nativeRedirect = `quickly://login-callback${hash ? hash : ''}${search ? (hash ? '&' : '?') + search.replace(/^\?/, '') : ''}`;
      window.location.href = nativeRedirect;
    }
  }
} catch (_) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
