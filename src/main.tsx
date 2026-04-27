// ============================================================================
// SPARKOS FITNESS - Main Entry Point
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAI } from './services/ai/bootstrap';
import { logger } from './utils/logger';
import './styles/global.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/typography.css';
import './styles/components.css';

window.addEventListener('error', (event) => {
  logger.app.error('Global error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.app.error('Unhandled promise rejection', event.reason);
});

initAI();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA offline support — production only.
// In dev, the SW interferes with Vite's HMR WebSocket, causing connection failures.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch((err) => {
    logger.app.warn('SW registration skipped', err);
  });
}
