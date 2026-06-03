// ============================================================================
// SPARKOS FITNESS - Main Entry Point
// ============================================================================

import * as Sentry from '@sentry/react';
import { LazyMotion, domMax } from 'framer-motion';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PWAUpdatePrompt } from './components/pwa/PWAUpdatePrompt';
import { RootErrorBoundary } from './errors/RootErrorBoundary';
import { initAI } from './services/ai/bootstrap';
import { checkMissedWorkouts } from './services/notificationService';
import { initOfflineSync } from './services/offlineQueue';
import { initWebVitals } from './services/webVitals';
import { logger } from './utils/logger';
import './styles/global.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/typography.css';
import './styles/components.css';

// Initialize Sentry error tracking
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.extra?.data) {
        event.extra.data = undefined;
      }
      return event;
    },
  });
  logger.app.info('Sentry initialized');
} else if (import.meta.env.PROD) {
  logger.app.warn('Sentry NOT initialized — error reporting disabled in production');
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

// Initialize web vitals monitoring
initWebVitals();

// Local logging only. Sentry.init installs its own global error /
// unhandledrejection handlers, so we must NOT call Sentry.captureException here
// or every uncaught error would be reported twice.
window.addEventListener('error', (event) => {
  logger.app.error('Global error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.app.error('Unhandled promise rejection', event.reason);
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
