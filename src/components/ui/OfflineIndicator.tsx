import { useCallback, useEffect, useState } from 'react';
import { getQueueDepth, processQueue } from '../../services/offlineQueue';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueDepth, setQueueDepth] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueueDepth = useCallback(async () => {
    try {
      const depth = await getQueueDepth();
      setQueueDepth(depth);
    } catch {
      // ignore - depth stays at last known value
    }
  }, []);

  // Force a sync pass now. Success/failure feedback is surfaced by the queue
  // itself via the shared toast; here we just refresh the visible depth.
  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await processQueue();
      await refreshQueueDepth();
    } catch {
      // ignore — the queue keeps its items and the periodic retry will run
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void refreshQueueDepth();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueueDepth]);

  useEffect(() => {
    void refreshQueueDepth();
  }, [refreshQueueDepth]);

  const shouldPoll = isOffline || queueDepth > 0;

  useEffect(() => {
    if (!shouldPoll) return;

    let active = true;

    const poll = async () => {
      try {
        const depth = await getQueueDepth();
        if (active) setQueueDepth(depth);
      } catch {
        // ignore — depth stays at last known value
      }
    };

    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [shouldPoll]);

  if (!isOffline && queueDepth === 0) return null;

  if (!isOffline && queueDepth > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="מצב סנכרון"
        className="glass-surface-dark scale-pop-in sticky top-0 inset-x-0 z-50 text-center text-sm font-mono py-1 flex items-center justify-center gap-2 w-full"
        style={{
          color: 'var(--fs-ink)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        }}
      >
        <span className="breathing-dot warn" aria-hidden="true" />
        <span>
          <span dir="ltr" className="kinetic-number">
            {queueDepth}
          </span>{' '}
          פעולות ממתינות לסנכרון
        </span>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={isSyncing}
          aria-label="סנכרן עכשיו"
          className="font-mono uppercase transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            fontWeight: 600,
            color: 'var(--fs-accent)',
            background: 'transparent',
            border: 'none',
            padding: '2px 6px',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            opacity: isSyncing ? 0.5 : 1,
          }}
        >
          {isSyncing ? 'מסנכרן…' : 'סנכרן עכשיו'}
        </button>
      </div>
    );
  }

  // offline
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="מצב סנכרון"
      className="glass-surface-dark scale-pop-in sticky top-0 inset-x-0 z-50 text-center text-sm font-mono py-2 flex items-center justify-center gap-2 w-full"
      style={{
        color: 'var(--fs-ink)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      }}
    >
      <span className="breathing-dot warn" aria-hidden="true" />
      {queueDepth > 0 ? (
        <span>
          לא מחובר ·{' '}
          <span dir="ltr" className="kinetic-number">
            {queueDepth}
          </span>{' '}
          פעולות בתור
        </span>
      ) : (
        'אין חיבור - האפליקציה פועלת במצב לא מקוון'
      )}
    </div>
  );
}
