import path from 'node:path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new build's SW installs but waits; the app surfaces an in-UI
      // "new version" toast (PWAUpdatePrompt) that calls updateServiceWorker to
      // skip-waiting + reload on the user's command. Fixes the old bug where the
      // SW sat in "waiting" forever (stale version until a manual cache clear),
      // without forcing an abrupt auto-reload in the middle of a workout.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'SparkOS Fitness',
        short_name: 'SparkOS',
        description: 'SparkOS Fitness - Training journal',
        theme_color: '#EEF3F1',
        background_color: '#EEF3F1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        dir: 'rtl',
        lang: 'he',
        categories: ['health', 'fitness'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Delete precaches from previous builds so old hashed assets don't pile
        // up and can't be served after an update.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/, /^chrome-extension:\/\//],
        // Custom Web Push handler (push + notificationclick) for coach reminders.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          // NOTE: Supabase REST responses are intentionally NOT cached by the
          // service worker. Responses are scoped to the authenticated user and
          // caching them at the SW layer risks cross-user data leaks on shared
          // devices. The app is IndexedDB-first, so an offline copy already
          // lives in the local DB.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    process.env.VITE_ENABLE_BUNDLE_ANALYZER === 'true' &&
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip only noisy dev-log calls; KEEP console.error / console.warn in
        // production so real failures remain observable. (drop_console: true
        // would have removed console.error too.)
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      format: {
        comments: false,
      },
    },
    cssTarget: 'chrome80',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@tanstack')) {
            return 'tanstack';
          }
          if (id.includes('@supabase/supabase-js') || id.includes('@supabase')) {
            return 'supabase';
          }
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          if (id.includes('@gsap') || id.includes('node_modules/gsap')) {
            return 'gsap';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
            return 'react-vendor';
          }
          if (id.includes('idb')) {
            return 'idb';
          }
          if (id.includes('dompurify')) {
            return 'dompurify';
          }
          if (id.includes('use-immer') || id.includes('immer')) {
            return 'immer';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 200,
    reportCompressedSize: false,
    sourcemap: false,
  },
});
