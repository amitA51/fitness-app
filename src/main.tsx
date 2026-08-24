// ============================================================================
// SPARKOS FITNESS - Main Entry Point
// ============================================================================

import { LazyMotion, domMax } from 'framer-motion';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PWAUpdatePrompt } from './components/pwa/PWAUpdatePrompt';
import { RootErrorBoundary } from './errors/RootErrorBoundary';
import { loadSentry } from './lib/sentryLazy';
import { initAI } from './services/ai/bootstrap';
import { checkMissedWorkouts } from './services/notificationService';
import { initOfflineSync } from './services/offlineQueue';
import { hasAnalyticsConsent, onTrackingConsentChange } from './services/tracking/trackingConsent';
import { initWebVitals } from './services/webVitals';
import { logger } from './utils/logger';
import './styles/global.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/typography.css';
import './styles/components.css';

// Analytics / error-monitoring (Sentry + web-vitals) initialise ONLY after the
// user grants analytics consent (Consent-Mode pattern). Until then they stay
// off; the local window error logging below still works.
let analyticsStarted = false;
async function startAnalytics() {
  if (analyticsStarted) return;
  analyticsStarted = true;

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    try {
      // Fetch the Sentry SDK lazily now that consent is granted — it is kept
      // out of the initial bundle (see lib/sentryLazy).
      const Sentry = await loadSentry();
      Sentry.init({
        dsn: sentryDsn,
        // Release attribution: without this, crash-free rate and per-release
        // regression tracking cannot work. Netlify injects COMMIT_REF on every
        // build; fall back to the package version locally.
        release: import.meta.env.VITE_COMMIT_REF ?? `sparkos-fitness@${__APP_VERSION__}`,
        environment: import.meta.env.MODE,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        sendDefaultPii: false,
        beforeSend(event) {
          // Scrub PII before anything leaves the device. Auth POST bodies can
          // carry passwords/tokens; breadcrumb URLs embed magic-link / reset
          // tokens in the query string; error messages may contain emails.
          event.request = undefined;
          event.breadcrumbs = undefined;
          if (event.extra?.data) {
            event.extra.data = undefined;
          }
          if (event.user) {
            event.user = { id: event.user.id };
          }
          return event;
        },
      });
      logger.app.info('Sentry initialized (analytics consent granted)');
    } catch (e) {
      logger.app.warn('Sentry failed to load; error reporting disabled', e);
    }
  } else if (import.meta.env.PROD) {
    logger.app.warn('Sentry NOT initialized — error reporting disabled in production');
  }

  // Web-vitals reports through Sentry, so it shares the same analytics consent.
  initWebVitals();
}

if (hasAnalyticsConsent()) {
  startAnalytics();
} else {
  // Start live the moment the user opts in via the cookie banner.
  onTrackingConsentChange((consent) => {
    if (consent.analytics) startAnalytics();
  });
}

// Initialize accessibility checker in development
if (import.meta.env.DEV) {
  import('@axe-core/react')
    .then((axe) => {
      axe.default(React, ReactDOM, 1000);
      logger.app.info('axe-core accessibility checker initialized');
    })
    .catch(() => {
      // Ignore if axe-core fails to load
    });
}

// Web-vitals is started inside startAnalytics() once analytics consent is granted.

// Local logging only. Sentry.init installs its own global error /
// unhandledrejection handlers, so we must NOT call Sentry.captureException here
// or every uncaught error would be reported twice.
window.addEventListener('error', (event) => {
  logger.app.error('Global error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.app.error('Unhandled promise rejection', event.reason);
});

// Stale-chunk recovery. After a deploy, a long-lived tab can request a hashed
// asset that no longer exists; the SPA fallback used to answer it with HTML
// (now /assets/* 404s, but older cached SWs may still hold the bad body). The
// failure surfaces as "Failed to fetch dynamically imported module" mid-session
// — a hard stop for the user. One automatic reload picks up the new deploy;
// the sessionStorage guard prevents a reload loop when the site itself is down.
window.addEventListener('error', (event) => {
  const message = typeof event.message === 'string' ? event.message : '';
  const isChunkFailure =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed');
  if (!isChunkFailure) return;
  try {
    if (sessionStorage.getItem('chunk_error_reloaded')) return;
    sessionStorage.setItem('chunk_error_reloaded', '1');
  } catch {
    // Storage unavailable — still reload once; worst case is an extra refresh.
  }
  window.location.reload();
});

initAI();

// Activate the offline mutation queue: replays failed cloud writes on
// startup and when the network comes back online.
initOfflineSync();

// Notification permission is now requested from Settings when the user
// explicitly enables reminders (better UX, higher grant rates).
// On load we only check missed workouts if permission was already granted.
if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
  const lastWorkout = localStorage.getItem('sparkos_last_workout_date');
  checkMissedWorkouts(lastWorkout);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <LazyMotion features={domMax}>
        <App />
      </LazyMotion>
      {/* Service-worker registration + "new version" toast. The hook self-
          registers the SW (production only; no-op in dev) so there is no manual
          registerSW call here and no HMR-socket conflict. */}
      <PWAUpdatePrompt />
    </RootErrorBoundary>
  </React.StrictMode>
);
