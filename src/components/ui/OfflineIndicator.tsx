import { useCallback, useEffect, useState } from 'react';
import { getQueueDepth, processQueue } from '../../services/offlineQueue';
import { flushUnsyncedSessions, getUnsyncedSessionCount } from '../../services/sessionDb';

interface OfflineIndicatorProps {
  /**
   * A guest has no cloud account to sync INTO — the queue never drains for
   * them (processQueue skips unauthenticated users), so showing "pending
   * sync" chrome with a dead button read as "my data is broken". Guest mode
   * is local-only by design; the pending-sync branch must not render there.
   */
  isGuest?: boolean;
}

export function OfflineIndicator({ isGuest = false }: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueDepth, setQueueDepth] = useState(0);
  // Queue depth alone was a blind spot with the same shape as the sign-out
  // guard's: a workout written while getCurrentUser() returned null (a 401
  // during token refresh) entered no queue, so this component rendered
  // NOTHING — a reassuring "all synced" at the exact moment the only copy of
  // that workout was on the device. The ledger in sessionDb is the second
  // input that closes it.
  const [unsyncedSessions, setUnsyncedSessions] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueueDepth = useCallback(async () => {
    try {
      const depth = await getQueueDepth();
      setQueueDepth(depth);
    } catch {
      // ignore - depth stays at last known value
    }
    try {
      setUnsyncedSessions(isGuest ? 0 : await getUnsyncedSessionCount());
    } catch {
      // ignore — count stays at last known value
    }
  }, [isGuest]);

  // Force a sync pass now. Success/failure feedback is surfaced by the queue
  // itself via the shared toast; here we just refresh the visible depth.
  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // A ledgered-only workout is in no queue, so processQueue cannot see it.
      // Flushing first is what keeps this button from being a no-op for exactly
      // the case the banner is warning about.
      await flushUnsyncedSessions();
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

  // A signed-out visitor with leftover queued rows used to poll every 5s
  // forever behind a banner they could never clear.
  const shouldPoll = !isGuest && (isOffline || queueDepth > 0 || unsyncedSessions > 0);

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
      try {
        const pending = await getUnsyncedSessionCount();
        if (active) setUnsyncedSessions(pending);
      } catch {
        // ignore — count stays at last known value
      }
    };

    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [shouldPoll]);

  // Only ever counted for a real account: a guest's local-only workouts are not
  // "waiting for the cloud", so they must not raise this banner.
  const atRiskSessions = isGuest ? 0 : unsyncedSessions;

  if (isGuest && !isOffline) return null;

  if (!isOffline && queueDepth === 0 && atRiskSessions === 0) return null;

  if (!isOffline && (queueDepth > 0 || atRiskSessions > 0)) {
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
        {queueDepth > 0 ? (
          <span>
            <span dir="ltr" className="kinetic-number">
              {queueDepth}
            </span>{' '}
            {queueDepth === 1 ? 'פעולה אחת ממתינה לסנכרון' : 'פעולות ממתינות לסנכרון'}
          </span>
        ) : (
          // The queue is empty and a workout still exists only here. Naming the
          // workout is the whole point: "0 pending" was the lie.
          <span>
            {atRiskSessions === 1 ? (
              'אימון אחד שמור במכשיר בלבד'
            ) : (
              <>
                <span dir="ltr" className="kinetic-number">
                  {atRiskSessions}
                </span>{' '}
                אימונים שמורים במכשיר בלבד
              </>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={isSyncing}
          aria-label="סנכרן עכשיו"
          className="transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
          style={{
            fontSize: '13px',
            letterSpacing: '-0.01em',
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
      {queueDepth > 0 && !isGuest ? (
        <span>
          לא מחובר ·{' '}
          <span dir="ltr" className="kinetic-number">
            {queueDepth}
          </span>{' '}
          פעולות בתור
        </span>
      ) : atRiskSessions > 0 ? (
        <span>
          לא מחובר ·{' '}
          {atRiskSessions === 1 ? (
            'אימון אחד שמור במכשיר בלבד'
          ) : (
            <>
              <span dir="ltr" className="kinetic-number">
                {atRiskSessions}
              </span>{' '}
              אימונים שמורים במכשיר בלבד
            </>
          )}
        </span>
      ) : (
        'אין חיבור - האפליקציה פועלת במצב לא מקוון'
      )}
    </div>
  );
}
