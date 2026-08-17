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

// Disable browser long-press context menus (Save Image As / Copy / Share) to feel 100% like a native app
window.addEventListener('contextmenu', (e) => {
  const tag = e.target?.tagName?.toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
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
