import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/** Ask Strava for new activities at most this often while the app is open. */
const SYNC_EVERY_MS = 10 * 60 * 1000;
/** How often the open app checks whether a sync or a detail backfill is due. */
const TICK_MS = 5 * 60 * 1000;
/**
 * Without the local "linked" flag (a wiped browser, a second device, the app
 * reinstalled) ask the server at most this often whether a link exists.
 */
const STATUS_RECHECK_MS = 24 * 60 * 60 * 1000;
const STATUS_CHECKED_KEY = 'strava_status_checked_at';

const readNumber = (key: string): number => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

/**
 * Brings Strava activities in while the app is open: when it opens, when it
 * comes back to the foreground, and every few minutes. Nearly free for anyone
 * who never linked Strava — one status call a day per device, and the Strava
 * code loads only past that gate.
 *
 * It also finishes a connect started on this device: on an iPhone the Strava
 * redirect lands in Safari, so the installed app learns about the new link by
 * asking the server when the user switches back to it.
 */
export function useStravaAutoSync(): void {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    let running = false;

    const run = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const strava = await import('../services/strava/stravaSync');
        if (!strava.isStravaLinkedHere()) {
          const now = Date.now();
          const pending = readNumber(strava.STRAVA_PENDING_KEY) > now;
          if (!pending && now - readNumber(STATUS_CHECKED_KEY) < STATUS_RECHECK_MS) return;
          localStorage.setItem(STATUS_CHECKED_KEY, String(now));
          const { fetchStravaStatus } = await import('../services/strava/stravaApi');
          const res = await fetchStravaStatus();
          if (!active || !res.ok || !res.connected) return;
          localStorage.removeItem(strava.STRAVA_PENDING_KEY);
          strava.rememberStravaLinked(true);
        }
        const last = strava.lastStravaSyncAt() ?? 0;
        if (Date.now() - last >= SYNC_EVERY_MS) await strava.syncStrava();
        if (active && strava.isStravaLinkedHere()) await strava.backfillStravaDetails();
      } catch (err) {
        logger.sync.warn('strava: auto-sync failed', err);
      } finally {
        running = false;
      }
    };

    void run();
    const interval = window.setInterval(() => void run(), TICK_MS);
    const onVisible = () => void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status]);
}
