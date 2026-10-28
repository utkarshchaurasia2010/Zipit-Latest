import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globIgnores: ['**/firebase-messaging-sw.js'],
        navigateFallbackDenylist: [/^\/track/, /^\/orders/, /^\/past-orders/, /^\/checkout/, /^\/payment/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'zipit-supabase-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache only static catalogue REST API requests (categories/catalog).
            // NEVER cache realtime tables: orders, refunds, order tracking, rider/shopkeeper status, or live stock!
            urlPattern: ({ url }) => {
              if (!url.origin.includes('supabase.co') || !url.pathname.includes('/rest/v1/')) return false;
              const fullQuery = (url.pathname + url.search).toLowerCase();
              const realtimeKeywords = ['order', 'refund', 'rpc', 'status', 'profiles', 'stock', 'delivery'];
              if (realtimeKeywords.some(kw => fullQuery.includes(kw))) {
                return false; // Direct live network request every time
              }
              return true;
            },
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'quickly-supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        id: '/',
        name: 'Quickly - India\'s Rural Delivery App',
        short_name: 'Quickly',
        description: 'Instant delivery app for rural and semi-urban India',
        theme_color: '#0a0a0c',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['shopping', 'food'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'vendor-leaflet';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
        }
      }
    }
  },
  server: {
    port: 5175,
    strictPort: true,
    host: true
  }
})
