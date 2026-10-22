import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { logger } from '../../../utils/logger';
import { isTimeoutError, withTimeout } from '../../../utils/withTimeout';

const LAST_SYNC_KEY = 'last_sync_time';

/** How long Settings waits on the connection check before keeping what it knows. */
export const CONNECTION_CHECK_TIMEOUT_MS = 5_000;
/** Pending-count refresh, which doubles as the background re-check while disconnected. */
const POLL_MS = 30_000;

const deviceOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

/** What the device already knows without asking the server: a backend is
 * configured and the network is up. */
const likelyConnected = (): boolean => isSupabaseConfigured() && deviceOnline();

export function useCloudSync() {
  // Start from local knowledge instead of "לא מחובר" until the server answers;
  // the check below corrects it either way.
  const [cloudConnected, setCloudConnected] = useState(likelyConnected);
  const [isSyncingUp, setIsSyncingUp] = useState(false);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const loadLastSyncTime = useCallback(() => {
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) setLastSyncTime(stored);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Only the newest check may set the status: an older, slower one landing
  // after an offline event (or a newer check) must not overwrite it.
  const checkSeqRef = useRef(0);

  const checkConnection = useCallback(async () => {
    const seq = ++checkSeqRef.current;
    if (!likelyConnected()) {
      setCloudConnected(false);
      return;
    }
    try {
      const { testConnection } = await import('../../../services/supabaseSync');
      const connected = await withTimeout(
        testConnection(),
        CONNECTION_CHECK_TIMEOUT_MS,
        'testConnection'
      );
      if (seq === checkSeqRef.current) setCloudConnected(connected && deviceOnline());
    } catch (err) {
      // A check that is merely slow says the server is busy, not that the user
      // is disconnected: keep the current state (a sync reports its own error).
      if (seq === checkSeqRef.current && !isTimeoutError(err)) setCloudConnected(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    loadLastSyncTime();
  }, [checkConnection, loadLastSyncTime]);

  // Follow the device's network: offline is known at once, and coming back
  // online re-checks instead of waiting for the next poll.
  useEffect(() => {
    const handleOffline = () => {
      checkSeqRef.current += 1; // a check still in flight is now stale
      setCloudConnected(false);
    };
    const handleOnline = () => void checkConnection();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkConnection]);

  const loadPendingCount = useCallback(async () => {
    try {
      const { getQueueDepth } = await import('../../../services/offlineQueue');
      const count = await getQueueDepth();
      setPendingSyncCount(count);
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
    const interval = setInterval(loadPendingCount, POLL_MS);
    return () => clearInterval(interval);
  }, [loadPendingCount]);

  // While disconnected, re-check in the background so the status recovers on
  // its own once the server does.
  useEffect(() => {
    if (cloudConnected || !isSupabaseConfigured()) return;
    const interval = setInterval(() => void checkConnection(), POLL_MS);
    return () => clearInterval(interval);
  }, [cloudConnected, checkConnection]);

  const handleSyncToCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingUp(true);
    setSyncMessage('מעלה לענן...');
    try {
      const { syncAllData } = await import('../../../services/supabaseSync');
      const result = await syncAllData();
      if (result.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        setSyncMessage(`הועלו ${result.syncedItems} פריטים!`);
      } else {
        // Raw error strings are internal English (e.g. "fetch failed: ...") —
        // log them for debugging, show the user friendly Hebrew.
        logger.sync.error('Sync to cloud failed', result.error);
        setSyncMessage('שגיאה בהעלאה לענן — נסו שוב');
      }
    } catch {
      setSyncMessage('שגיאה בהעלאה');
    } finally {
      setIsSyncingUp(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handlePullFromCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingDown(true);
    setSyncMessage('מביא נתונים מהענן...');
    try {
      const { pullAllData } = await import('../../../services/supabaseSync');
      // A button press asks for everything, not only what changed since the
      // last pull — the user is usually checking that the cloud copy is whole.
      const result = await pullAllData({ full: true });
      if (result.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        setSyncMessage(`התקבלו ${result.syncedItems} פריטים!`);
      } else {
        logger.sync.error('Pull from cloud failed', result.error);
        setSyncMessage('שגיאה בטעינה מהענן — נסו שוב');
      }
    } catch {
      setSyncMessage('שגיאה בטעינה');
    } finally {
      setIsSyncingDown(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleSyncAll = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingAll(true);
    setSyncMessage('מסנכרן הכל...');
    try {
      const { syncAllData, pullAllData } = await import('../../../services/supabaseSync');
      const syncResult = await syncAllData();
      if (!syncResult.success) {
        logger.sync.error('Sync-all (upload phase) failed', syncResult.error);
        setSyncMessage('שגיאה בסנכרון — נסו שוב');
        return;
      }
      const pullResult = await pullAllData({ full: true });
      if (pullResult.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        const totalItems = (syncResult.syncedItems || 0) + (pullResult.syncedItems || 0);
        setSyncMessage(`סנכרון הושלם: ${totalItems} פריטים`);
      } else {
        logger.sync.error('Sync-all (pull phase) failed', pullResult.error);
        setSyncMessage('שגיאה בסנכרון — נסו שוב');
      }
    } catch {
      setSyncMessage('שגיאה בסנכרון');
    } finally {
      setIsSyncingAll(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  return {
    cloudConnected,
    isSyncingUp,
    isSyncingDown,
    isSyncingAll,
    syncMessage,
    pendingSyncCount,
    lastSyncTime,
    handleSyncToCloud,
    handlePullFromCloud,
    handleSyncAll,
  };
}
