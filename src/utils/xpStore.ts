// xpStore — persistent session-XP total for the gamification layer.
//
// Design: a single localStorage key holding the cumulative XP. The summary
// surface adds the just-earned session XP on mount (guarded by session id so
// a re-opened summary never double-counts) and reads the resulting level via
// levelFromXp. Cloud sync can come later; the local pool is the source of
// truth for now.

import { logger } from './logger';

const XP_KEY = 'gamification_xp_total';
const SEEN_SESSIONS_KEY = 'gamification_xp_sessions';

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function getTotalXp(): number {
  return readNumber(XP_KEY);
}

/** Has this session already contributed its XP? */
export function isSessionCounted(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_SESSIONS_KEY) ?? '[]') as string[];
    return seen.includes(sessionId);
  } catch {
    return false;
  }
}

/**
 * Add `xp` to the persistent pool exactly once for the given session id.
 * Returns the new cumulative total. Re-entry with the same id is a no-op —
 * re-opened summaries never inflate the pool.
 */
export function awardSessionXp(xp: number, sessionId: string | undefined): number {
  if (xp <= 0) return getTotalXp();
  if (isSessionCounted(sessionId)) return getTotalXp();

  const total = getTotalXp() + xp;
  try {
    localStorage.setItem(XP_KEY, String(total));
    const seen = (() => {
      try {
        return JSON.parse(localStorage.getItem(SEEN_SESSIONS_KEY) ?? '[]') as string[];
      } catch {
        return [];
      }
    })();
    if (sessionId) seen.push(sessionId);
    // Cap the ledger so it cannot grow forever; XP total is what matters.
    localStorage.setItem(SEEN_SESSIONS_KEY, JSON.stringify(seen.slice(-500)));
  } catch (err) {
    logger.app.warn('Failed to persist XP', err);
  }
  return total;
}
