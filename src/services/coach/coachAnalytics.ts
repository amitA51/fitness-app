// ============================================================================
// COACH PLATFORM — per-client analytics (coach dashboard)
// ============================================================================
// Computes lightweight adherence/activity signals for a trainee from their
// workout sessions (read via coachApi, RLS-gated to an active link). Pure
// `computeClientAnalytics` is unit-testable; `getClientAnalytics` fetches first.

import type { CoachClient } from '../../types/coach';
import { logger } from '../../utils/logger';
import { listCoachAssignments } from './assignmentService';
import { getClientNutrition, getClientSessions, getClientsActivity } from './coachApi';
import { getClientSchedule } from './scheduleService';

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

// ---- Week adherence (per-day breakdown for the trailing 7 days) ------------

export interface DayAdherence {
  /** Local date in YYYY-MM-DD format. */
  date: string;
  /** Day of week: 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Number of workout sessions that started on this local date. */
  sessions: number;
  /** Total calories logged on this date, or null if no nutrition row exists. */
  calories: number | null;
  /** Calorie target from the client's active nutrition_target assignment, or null. */
  targetCalories: number | null;
  /** Number of workouts the coach scheduled for this date. */
  scheduled: number;
  /** Of the scheduled workouts, how many are marked done. */
  completedScheduled: number;
}

/** Build a local YYYY-MM-DD string without UTC conversion (avoids timezone bug). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Derive per-day adherence for the trailing 7 days ending today (local time).
 * Pure and unit-testable — no I/O.
 */
export function computeWeekAdherence(
  sessions: Array<{ startTime: string | null }>,
  nutrition: Array<{ date: string; calories: number | null }>,
  targetCalories: number | null,
  schedule: Array<{ scheduledDate: string; status: string }> = [],
  now: Date = new Date()
): DayAdherence[] {
  // Build the 7-day window (oldest → newest, ending today in local time).
  const days: DayAdherence[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      date: toLocalDateString(d),
      weekday: d.getDay(),
      sessions: 0,
      calories: null,
      targetCalories,
      scheduled: 0,
      completedScheduled: 0,
    });
  }

  // Index days by date string for O(1) lookup.
  const dayMap = new Map<string, DayAdherence>();
  for (const day of days) dayMap.set(day.date, day);

  // Count sessions by local date of startTime.
  for (const s of sessions) {
    if (!s.startTime) continue;
    const d = new Date(s.startTime);
    if (!Number.isFinite(d.getTime())) continue;
    const key = toLocalDateString(d);
    const day = dayMap.get(key);
    if (day) day.sessions += 1;
  }

  // Map nutrition calories by date.
  for (const n of nutrition) {
    const day = dayMap.get(n.date);
    if (day) day.calories = n.calories ?? null;
  }

  // Count scheduled vs. completed-scheduled workouts by date.
  for (const item of schedule) {
    const day = dayMap.get(item.scheduledDate);
    if (!day) continue;
    day.scheduled += 1;
    if (item.status === 'done') day.completedScheduled += 1;
  }

  return days;
}

/**
 * Fetch all required data for a client and return 7-day adherence.
 * THROWS on any fetch failure (the readers run with throwOnError) so callers'
 * error states fire — a failed load must never render as an all-zero week.
 */
export async function getClientWeekAdherence(clientId: string): Promise<DayAdherence[]> {
  try {
    // Same 7-day window as computeWeekAdherence (today and the prior 6 days).
    const now = new Date();
    const fromDate = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    );
    const toDate = toLocalDateString(now);

    const [sessions, nutrition, assignments, schedule] = await Promise.all([
      getClientSessions(clientId, 30, { throwOnError: true }),
      getClientNutrition(clientId, 10, { throwOnError: true }),
      listCoachAssignments(clientId, { throwOnError: true }),
      getClientSchedule(clientId, fromDate, toDate, { throwOnError: true }),
    ]);

    // Find the newest active nutrition_target assignment with a numeric calories payload.
    let targetCalories: number | null = null;
    for (const a of assignments) {
      if (a.kind === 'nutrition_target' && a.status === 'active') {
        const cal = a.payload?.calories;
        if (typeof cal === 'number') {
          targetCalories = cal;
          break; // listCoachAssignments is ordered newest-first
        }
      }
    }

    const nutritionRows = nutrition.map((n) => ({
      date: n.date,
      calories: n.calories ?? null,
    }));
    const scheduleRows = schedule.map((s) => ({
      scheduledDate: s.scheduledDate,
      status: s.status,
    }));
    return computeWeekAdherence(sessions, nutritionRows, targetCalories, scheduleRows);
  } catch (e) {
    logger.db.error('getClientWeekAdherence failed', e);
    throw e instanceof Error ? e : new Error('week_adherence_failed');
  }
}

const DAY = 86_400_000;

/** Derive activity/adherence signals from a client's sessions. */
export function computeClientAnalytics(
  sessions: SessionActivity[],
  inactiveDays = 7,
  now: number = Date.now()
): ClientAnalytics {
  // Parse each session's startTime once and reuse for both the times list and
  // the volume-by-week loop (avoids re-calling new Date in the hot path).
  const parsed = sessions
    .map((s) => ({ t: new Date(s.startTime).getTime(), totalVolume: s.totalVolume }))
    .filter((p) => Number.isFinite(p.t));

  const times = parsed.map((p) => p.t).sort((a, b) => b - a);

  const lastTs = times[0] ?? null;
  const daysSinceActivity = lastTs === null ? null : Math.floor((now - lastTs) / DAY);
  const sessionsLast7 = times.filter((t) => t > now - 7 * DAY).length;
  const sessionsPrev7 = times.filter((t) => t <= now - 7 * DAY && t > now - 14 * DAY).length;

  const volumeByWeek = [0, 0, 0, 0];
  for (const p of parsed) {
    const weeksAgo = Math.floor((now - p.t) / (7 * DAY));
    if (weeksAgo >= 0 && weeksAgo < 4)
      volumeByWeek[3 - weeksAgo] = (volumeByWeek[3 - weeksAgo] ?? 0) + (p.totalVolume || 0);
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
