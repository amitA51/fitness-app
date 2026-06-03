// PWAUpdatePrompt — Fresh Steel "new version available" toast.
//
// vite-plugin-pwa runs in `prompt` mode: a freshly deployed service worker
// installs and then *waits*. Instead of silently sitting there (the old bug:
// users saw a stale build until they manually cleared the cache) or auto-
// reloading mid-workout, we surface a small, dismissible toast. Tapping "רענן"
// calls updateServiceWorker(true), which skip-waits the new SW and reloads into
// the fresh build. The app is IndexedDB-first, so no in-progress data is lost.
//
// The hook also self-registers the SW (no manual registerSW needed) and is a
// no-op in dev unless devOptions.enabled, so it never fights Vite's HMR socket.

import { useRegisterSW } from 'virtual:pwa-register/react';

// Re-check for a new deployment during long-lived sessions so a user who keeps
// the app open all day still gets prompted without a manual refresh.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const id = setInterval(() => {
        // Guard: only poll when online and the SW isn't already installing.
        if (registration.installing || !navigator.onLine) return;
        registration.update().catch(() => {
          // Network hiccup — the next interval (or reload) retries.
        });
      }, UPDATE_CHECK_INTERVAL_MS);
      // Best-effort cleanup if the SW is ever unregistered in this session.
      return () => clearInterval(id);
    },
  });

  // Kept out of the layout/a11y tree entirely until an update is actually
  // waiting; role="status" + aria-live announces it for screen readers on mount.
  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      style={{
        position: 'fixed',
        insetInlineStart: '50%',
        transform: 'translateX(50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'min(92vw, 420px)',
        padding: '10px 12px 10px 16px',
        background: 'var(--color-surface-elevated)',
        color: 'var(--fs-primary)',
        border: '1px solid var(--color-separator)',
        borderRadius: 'var(--radius-asymmetric, 14px)',
        boxShadow: 'var(--shadow-glow-accent, 0 8px 28px rgba(0,0,0,0.18))',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}
      >
        גרסה חדשה זמינה
      </span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        style={{
          flexShrink: 0,
          padding: '6px 14px',
          background: 'var(--fs-accent)',
          color: 'var(--color-ink-on-accent)',
          border: 'none',
          borderRadius: 999,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        רענן
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="התעלם מעדכון"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--fs-primary)',
          border: 'none',
          borderRadius: 999,
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          opacity: 0.6,
        }}
      >
        ×
      </button>
    </div>
  );
}
