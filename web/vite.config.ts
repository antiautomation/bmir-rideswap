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
          { name: 'Create a post', url: '/post' },
          { name: 'Messages', url: '/messages' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Standalone docs (the BMIR one-pager and its paste-into-Docs twin) are
        // shared by link and read once — no reason to ship them to every
        // installed app's precache.
        globIgnores: ['**/bmir.html', '**/bmir-doc.html'],
        navigateFallback: '/index.html',
        // …and without the denylist entry the fallback would answer those URLs
        // with the SPA shell, which has no route for them.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/a\//,
          /^\/healthz/,
          /^\/bmir(-doc)?\.html$/,
          /^\/bmir\.pdf$/,
        ],
        runtimeCaching: [
          // Thumbs are content-addressed via ?v={avatarVersion}, so cache-first is
          // safe: a new upload changes the URL, stale entries age out via expiration.
          {
            urlPattern: /\/api\/(me|listings\/[^/]+|conversations\/[^/]+)\/avatar-thumb/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatar-thumbs',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Workbox matches regexes against the full URL, not just the path.
            urlPattern: /\/api\/(listings|conversations|me|my)/,
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
    // Honour PORT so more than one dev server can run side by side.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '^/a/': 'http://localhost:3000',
      '^/u/': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
