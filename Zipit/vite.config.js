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
          }
        ]
      },
      manifest: {
        name: 'Zipit - India\'s Rural Delivery App',
        short_name: 'Zipit',
        description: 'Instant delivery app for rural and semi-urban India',
        theme_color: '#0a0a0c',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/logo_full.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo_full.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5175,
    strictPort: true,
    host: true
  }
})
