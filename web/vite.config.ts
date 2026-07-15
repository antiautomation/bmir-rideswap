import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'RideFinder',
        short_name: 'RideFinder',
        description: 'Free no-login rideshare board for Burning Man',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#e4622f',
        background_color: '#14110f',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Ride board', url: '/' },
          { name: 'Post a ride', url: '/post' },
          { name: 'Messages', url: '/messages' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/a\//, /^\/healthz/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/(listings|conversations|me|my)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '^/a/': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
