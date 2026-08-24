import path from 'node:path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// package.json version, injected as __APP_VERSION__ (Sentry release fallback).
const version = JSON.parse((await import('node:fs')).readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version;

/**
 * Extract the npm package name from a module id so manualChunks can match on
 * exact package boundaries instead of fragile substrings (e.g. `/react/` used
 * to risk matching unrelated vendor paths). Returns the bare package name —
 * including the `@scope/name` for scoped packages — or undefined when the id is
 * not inside node_modules. Handles both POSIX and Windows path separators.
 */
export function vendorPackageName(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)node_modules\/(.+)$/);
  if (!match) return undefined;
  const segments = match[1].split('/');
  if (segments.length === 0 || segments[0] === '') return undefined;
  return segments[0].startsWith('@') && segments.length > 1
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
}

export default defineConfig({
  // Build-time constants: the app version feeds Sentry release attribution
  // (see src/main.tsx) when Netlify's COMMIT_REF is unavailable (local builds).
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable is a separate file: launchers crop to the inner 80% circle,
          // so the mark is drawn smaller there than in the 'any' icons.
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Audit measurement: the universal JS glob precached 2,533 KiB across
        // 139 entries (110 JS files), including routes a trainee never opens.
        // Keep only files index.html needs to boot offline plus launch branding.
        // Route chunks are content-hashed and use the runtime CacheFirst rule
        // below: an online visit seeds them, so previously visited routes still
        // work offline without making first install download the whole app.
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'assets/index-*.js',
          'assets/react-vendor-*.js',
          'assets/supabase-*.js',
          'assets/framer-*.js',
          'assets/icons-*.js',
          'assets/immer-*.js',
          'assets/tanstack-*.js',
          'assets/index-*.css',
          'assets/workbox-window*.js',
          'push-sw.js',
          'favicon.svg',
          'favicon-32.png',
          'favicon-64.png',
          'logo.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        // Delete precaches from previous builds so old hashed assets don't pile
        // up and can't be served after an update.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/, /^chrome-extension:\/\//],
        // Custom Web Push handler (push + notificationclick) for coach reminders.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          // Content-hashed route scripts are safe to cache by URL. Precaching
          // still wins for the launch shell above; this fills on first online
          // route visit and retains a bounded 30-day offline history instead of
          // caching user-scoped API responses or every route at install time.
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith('/assets/') &&
              url.pathname.endsWith('.js'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'route-script-cache',
              expiration: { maxEntries: 90, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
          const normalizedId = id.replace(/\\/g, '/');
          // This catalog is intentionally reachable only from programCatalogService
          // (dynamic import) and the route-lazy Program page. A named chunk makes
          // that boundary measurable in build output without making it eager.
          if (normalizedId.endsWith('/src/data/bbtProgram.generated.ts')) {
            return 'bbt-program';
          }

          const pkg = vendorPackageName(id);
          if (!pkg) return;

          if (pkg.startsWith('@tanstack/')) {
            return 'tanstack';
          }
          if (pkg === '@supabase/supabase-js' || pkg.startsWith('@supabase/')) {
            return 'supabase';
          }
          if (pkg === 'framer-motion') {
            return 'framer';
          }
          if (pkg === 'gsap' || pkg.startsWith('@gsap/')) {
            return 'gsap';
          }
          if (pkg === 'lucide-react') {
            return 'icons';
          }
          if (
            pkg === 'react' ||
            pkg === 'react-dom' ||
            pkg === 'react-router' ||
            pkg === 'react-router-dom'
          ) {
            return 'react-vendor';
          }
          if (pkg === 'idb') {
            return 'idb';
          }
          if (pkg === 'dompurify') {
            return 'dompurify';
          }
          if (pkg === 'immer' || pkg === 'use-immer') {
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
    // 'hidden' emits .map files WITHOUT the //# sourceMappingURL comment: the
    // browser will not fetch them (so they are not exposed to visitors), but they
    // can be uploaded to Sentry so production stack traces are readable instead
    // of minified. Previously sourcemap:false meant every production error
    // arrived as unreadable single-letter frames.
    //
    // Deploy note: upload dist/**/*.map to Sentry as part of the release, then
    // delete the .map files from the published output if your host serves the
    // whole dist directory.
    sourcemap: 'hidden',
  },
});
