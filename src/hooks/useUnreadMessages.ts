import { useEffect, useState } from 'react';
import { getGroupUnreadCount } from '../services/coach/groupMessageService';
import { getUnreadCount } from '../services/coach/messageService';

/**
 * Unread coach<->client message count for the current user, including both
 * 1-to-1 thread messages and group-chat messages. Polls periodically and
 * refreshes instantly when a thread is opened/read (via the
 * `coach:unread-refresh` window event). Degrades to 0 offline or pre-migration.
 * Each source is caught independently so one failure does not zero the other.
 */
export function useUnreadMessages(pollMs = 30_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const tick = () => {
      Promise.all([getUnreadCount().catch(() => 0), getGroupUnreadCount().catch(() => 0)]).then(
        ([direct, group]) => {
          if (active) setCount(direct + group);
        }
      );
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
