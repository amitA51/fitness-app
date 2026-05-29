import { useEffect, useState } from 'react';
import { getUnreadCount } from '../services/coach/messageService';

/**
 * Unread coach<->client message count for the current user. Polls periodically
 * and refreshes instantly when a thread is opened/read (via the
 * `coach:unread-refresh` window event). Degrades to 0 offline or pre-migration.
 */
export function useUnreadMessages(pollMs = 30_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const tick = () => {
      getUnreadCount()
        .then((n) => {
          if (active) setCount(n);
        })
        .catch(() => {
          if (active) setCount(0);
        });
    };
    tick();
    const id = window.setInterval(tick, pollMs);
    window.addEventListener('coach:unread-refresh', tick);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener('coach:unread-refresh', tick);
    };
  }, [pollMs]);

  return count;
}
