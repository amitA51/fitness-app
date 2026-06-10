import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { logger } from '../../../utils/logger';

const LAST_SYNC_KEY = 'last_sync_time';

export function useCloudSync() {
  const [cloudConnected, setCloudConnected] = useState(false);
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

  useEffect(() => {
    const checkConnection = async () => {
      if (!isSupabaseConfigured()) {
        setCloudConnected(false);
        return;
      }
      try {
        const { testConnection } = await import('../../../services/supabaseSync');
        const connected = await testConnection();
        setCloudConnected(connected);
      } catch {
        setCloudConnected(false);
      }
    };
    checkConnection();
    loadLastSyncTime();
  }, [loadLastSyncTime]);

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
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [loadPendingCount]);

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
      const result = await pullAllData();
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
      const pullResult = await pullAllData();
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
