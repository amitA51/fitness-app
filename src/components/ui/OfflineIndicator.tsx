import { useEffect, useState } from 'react';
import { getQueueDepth } from '../../services/offlineQueue';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueDepth, setQueueDepth] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const depth = await getQueueDepth();
        if (active) setQueueDepth(depth);
      } catch {
        // ignore — depth stays at last known value
      }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!isOffline && queueDepth === 0) return null;

  if (!isOffline && queueDepth > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-50 text-center text-sm font-mono py-1"
        style={{
          background: 'var(--fs-ink)',
          color: 'var(--fs-bg)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        }}
      >
        {queueDepth} פעולות ממתינות לסנכרון
      </div>
    );
  }

  // offline
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 text-center text-sm font-mono py-2"
      style={{
        background: 'var(--fs-ink)',
        color: 'var(--fs-bg)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      }}
    >
      {queueDepth > 0
        ? `לא מחובר · ${queueDepth} פעולות בתור`
        : 'אין חיבור — האפליקציה פועלת במצב לא מקוון'}
    </div>
  );
}
