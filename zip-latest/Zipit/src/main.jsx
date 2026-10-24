import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
