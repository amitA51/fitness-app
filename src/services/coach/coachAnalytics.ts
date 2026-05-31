// ============================================================================
// COACH PLATFORM — per-client analytics (coach dashboard)
// ============================================================================
// Computes lightweight adherence/activity signals for a trainee from their
// workout sessions (read via coachApi, RLS-gated to an active link). Pure
// `computeClientAnalytics` is unit-testable; `getClientAnalytics` fetches first.

import type { CoachClient } from '../../types/coach';
import { getClientSessions, getClientsActivity } from './coachApi';

export type ClientStatusLevel = 'active' | 'at_risk' | 'inactive' | 'new';

/** Minimal session shape the analytics need — WorkoutSession is assignable to this. */
export interface SessionActivity {
  startTime: string;
  totalVolume: number;
}

export interface ClientAnalytics {
  /** ISO timestamp of the most recent session, or null when none. */
  lastActivity: string | null;
  /** Whole days since the last session, or null when none. */
  daysSinceActivity: number | null;
  sessionsLast7: number;
  sessionsPrev7: number;
  /** Total volume per week for the last 4 weeks, oldest → newest. */
  volumeByWeek: number[];
  level: ClientStatusLevel;
}

const DAY = 86_400_000;

/** Derive activity/adherence signals from a client's sessions. */
export function computeClientAnalytics(
  sessions: SessionActivity[],
  inactiveDays = 7,
  now: number = Date.now()
): ClientAnalytics {
  const times = sessions
    .map((s) => new Date(s.startTime).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);

  const lastTs = times[0] ?? null;
  const daysSinceActivity = lastTs === null ? null : Math.floor((now - lastTs) / DAY);
  const sessionsLast7 = times.filter((t) => t > now - 7 * DAY).length;
  const sessionsPrev7 = times.filter((t) => t <= now - 7 * DAY && t > now - 14 * DAY).length;

  const volumeByWeek = [0, 0, 0, 0];
  for (const s of sessions) {
    const t = new Date(s.startTime).getTime();
    if (!Number.isFinite(t)) continue;
    const weeksAgo = Math.floor((now - t) / (7 * DAY));
    if (weeksAgo >= 0 && weeksAgo < 4)
      volumeByWeek[3 - weeksAgo] = (volumeByWeek[3 - weeksAgo] ?? 0) + (s.totalVolume || 0);
  }

  let level: ClientStatusLevel;
  if (times.length === 0) level = 'new';
  else if (daysSinceActivity !== null && daysSinceActivity >= inactiveDays) level = 'inactive';
  else if (sessionsLast7 === 0) level = 'at_risk';
  else level = 'active';

  return {
    lastActivity: lastTs === null ? null : new Date(lastTs).toISOString(),
    daysSinceActivity,
    sessionsLast7,
    sessionsPrev7,
    volumeByWeek,
    level,
  };
}

/** Fetch a client's recent sessions and compute their analytics. */
export async function getClientAnalytics(
  clientId: string,
  inactiveDays = 7
): Promise<ClientAnalytics> {
  const sessions = await getClientSessions(clientId, 100);
  return computeClientAnalytics(sessions, inactiveDays);
}

/** Display label + Fresh-Steel color token for a status level. */
export function clientStatusMeta(level: ClientStatusLevel): { label: string; color: string } {
  switch (level) {
    case 'active':
      return { label: 'פעיל', color: 'var(--fs-accent)' };
    case 'at_risk':
      return { label: 'בסיכון', color: 'var(--fs-warn)' };
    case 'inactive':
      return { label: 'לא פעיל', color: 'var(--fs-warn)' };
    default:
      return { label: 'חדש', color: 'var(--fs-muted)' };
  }
}

// ---- Roster overview (aggregate across ALL clients) ------------------------

export interface ClientOverviewRow {
  client: CoachClient;
  analytics: ClientAnalytics;
}

export interface RosterSummary {
  total: number;
  active: number;
  atRisk: number;
  inactive: number;
  /** at_risk + inactive — clients that need the coach's attention. */
  needsAttention: number;
  /** Clients with no session ever (new). */
  awaitingFirst: number;
}

/**
 * Build per-client analytics for the WHOLE roster with ONE batched activity
 * query (no N+1). Sorted attention-first: inactive/at_risk before active, then
 * by days since last activity descending so the stalest float to the top.
 */
export async function getClientsOverview(
  clients: CoachClient[],
  inactiveDays = 7,
  now: number = Date.now()
): Promise<ClientOverviewRow[]> {
  const ids = clients.map((c) => c.clientId);
  const activity = await getClientsActivity(ids);
  const rows = clients.map((client) => ({
    client,
    analytics: computeClientAnalytics(activity[client.clientId] ?? [], inactiveDays, now),
  }));
  return rows.sort((a, b) => attentionRank(b.analytics) - attentionRank(a.analytics));
}

/** Higher rank = needs more attention (sorts to the top). */
function attentionRank(a: ClientAnalytics): number {
  const base =
    a.level === 'inactive' ? 3000 : a.level === 'at_risk' ? 2000 : a.level === 'new' ? 1000 : 0;
  return base + (a.daysSinceActivity ?? 0);
}

/** Aggregate counts for the overview header cards. Pure + unit-testable. */
export function summarizeRoster(rows: ClientOverviewRow[]): RosterSummary {
  const summary: RosterSummary = {
    total: rows.length,
    active: 0,
    atRisk: 0,
    inactive: 0,
    needsAttention: 0,
    awaitingFirst: 0,
  };
  for (const { analytics } of rows) {
    if (analytics.level === 'active') summary.active += 1;
    else if (analytics.level === 'at_risk') {
      summary.atRisk += 1;
      summary.needsAttention += 1;
    } else if (analytics.level === 'inactive') {
      summary.inactive += 1;
      summary.needsAttention += 1;
    } else {
      summary.awaitingFirst += 1;
    }
  }
  return summary;
}
