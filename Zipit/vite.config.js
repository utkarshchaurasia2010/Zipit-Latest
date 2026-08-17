import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Zipit App',
        short_name: 'Zipit',
        description: 'Zipit Delivery App',
        theme_color: '#F8CB46',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo_full.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo_full.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo_full.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        importScripts: ['/firebase-messaging-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
