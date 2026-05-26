// ============================================================================
// SPARKOS FITNESS - Main Entry Point
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { RootErrorBoundary } from './errors/RootErrorBoundary';
import { initWebVitals } from './services/webVitals';
import { initAI } from './services/ai/bootstrap';
import { checkMissedWorkouts, requestNotificationPermission } from './services/notificationService';
import { logger } from './utils/logger';
import './styles/global.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/typography.css';
import './styles/components.css';

// Initialize Sentry error tracking
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  });
  logger.app.info('Sentry initialized');
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

window.addEventListener('error', (event) => {
  logger.app.error('Global error', event.error);
  try {
    Sentry.captureException(event.error);
  } catch {
    // Sentry not initialized
  }
});

window.addEventListener('unhandledrejection', (event) => {
  logger.app.error('Unhandled promise rejection', event.reason);
  try {
    Sentry.captureException(event.reason);
  } catch {
    // Sentry not initialized
  }
});

initAI();

requestNotificationPermission()
  .then((granted) => {
    if (granted) {
      const lastWorkout = localStorage.getItem('sparkos_last_workout_date');
      checkMissedWorkouts(lastWorkout);
    }
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

// Register service worker for PWA offline support — production only.
// In dev, the SW interferes with Vite's HMR WebSocket, causing connection failures.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch((err) => {
      logger.app.warn('SW registration skipped', err);
    });
}
