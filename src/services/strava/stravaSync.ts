// ============================================================================
// Strava import — new activities in, then the detail of old ones, slowly.
// ============================================================================
// `syncStrava` asks the edge function for every activity after the saved
// cursor (the whole history on the first run), saves the cardio ones as
// ordinary sessions, and moves the cursor. Activities of the last two weeks get
// their detail (calories, km splits) right away; older ones are filled in by
// `backfillStravaDetails` a few dozen at a time, because Strava allows 100 reads
// per 15 minutes and 1,000 a day for the whole app.
//
// Nothing is saved twice: a Strava activity has one fixed session id, the
// cursor never moves back (so a run deleted in the app stays deleted), and an
// activity that overlaps a run the user recorded in the app itself is skipped.

import type { WorkoutSession } from '../../types';
import {
  type CardioDiscipline,
  cardioDiscipline,
  cardioEffortsOf,
  isCardioSession,
} from '../../utils/cardio';
import { logger } from '../../utils/logger';
import { getLatestBodyWeight } from '../bodyWeightDb';
import { readAthleteProfile } from '../intelligence/profile';
import {
  getAllWorkoutSessions,
  getWorkoutSession,
  saveImportedWorkoutSessions,
} from '../sessionDb';
import {
  type StravaCallError,
  ackStravaActivities,
  fetchNewStravaActivities,
  fetchStravaDetails,
} from './stravaApi';
import {
  type StravaActivityDetail,
  type StravaActivitySummary,
  activityForStrava,
  pendingStravaDetailId,
  stravaSessionFrom,
  withStravaDetail,
} from './stravaMapping';

const DAY_MS = 24 * 60 * 60 * 1000;

/** localStorage: '1' once the server confirmed a link — the auto-sync's cheap gate. */
export const STRAVA_LINKED_KEY = 'strava_linked';
/** localStorage: epoch ms until which a connect started on this device is awaited. */
export const STRAVA_PENDING_KEY = 'strava_connect_pending_until';
const LAST_SYNC_KEY = 'strava_last_sync_at';
const DETAILS_NEXT_KEY = 'strava_details_next_at';

/** Activities this recent get their detail at import time. */
const FRESH_DETAIL_DAYS = 14;
/** The edge function's per-call ceiling. */
const DETAIL_BATCH = 30;
/** Detail reads per backfill run — under Strava's 100 reads / 15 min, leaving room for syncs. */
const DETAILS_PER_RUN = 60;
const DETAILS_PAUSE_MS = 15 * 60 * 1000;
/** After Strava says "too many requests", wait this long. */
const RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000;
/** Pages of 1,000 activities per sync — enough for any real history. */
const MAX_ROUNDS = 20;
/** An activity this close in time to a run recorded in the app is the same run. */
const SAME_RUN_WINDOW_MS = 15 * 60 * 1000;

const readNumber = (key: string): number => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

const writeValue = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (err) {
    logger.sync.warn(`strava: could not write ${key}`, err);
  }
};

export const isStravaLinkedHere = (): boolean => {
  try {
    return localStorage.getItem(STRAVA_LINKED_KEY) === '1';
  } catch {
    return false;
  }
};

export function rememberStravaLinked(linked: boolean): void {
  writeValue(STRAVA_LINKED_KEY, linked ? '1' : null);
  if (!linked) {
    writeValue(LAST_SYNC_KEY, null);
    writeValue(DETAILS_NEXT_KEY, null);
  }
}

/** When the last import ran on this device (epoch ms), or null. */
export const lastStravaSyncAt = (): number | null => readNumber(LAST_SYNC_KEY) || null;

async function bodyWeightKg(): Promise<number | null> {
  try {
    const latest = await getLatestBodyWeight();
    if (latest && latest > 0) return latest;
  } catch (err) {
    logger.sync.warn('strava: latest body weight unavailable', err);
  }
  return readAthleteProfile().weightKg;
}

const isImported = (s: WorkoutSession): boolean =>
  (s.exercises ?? []).some((ex) => ex.external?.provider === 'strava');

interface OwnEffort {
  start: number;
  /** End of a cardio-only session; null inside a gym session (its whole hour is not one run). */
  end: number | null;
  discipline: CardioDiscipline;
}

/** Cardio the user recorded in the app itself, to spot the same run arriving from Strava. */
function ownEfforts(sessions: readonly WorkoutSession[]): OwnEffort[] {
  const out: OwnEffort[] = [];
  for (const s of sessions) {
    if (isImported(s) || s.status !== 'completed') continue;
    const start = Date.parse(s.startTime);
    if (!Number.isFinite(start)) continue;
    const end = isCardioSession(s)
      ? s.endTime
        ? Date.parse(s.endTime)
        : start + (s.duration || 0) * 1000
      : null;
    for (const e of cardioEffortsOf(s)) out.push({ start, end, discipline: e.discipline });
  }
  return out;
}

function recordedInApp(a: StravaActivitySummary, own: readonly OwnEffort[]): boolean {
  const activity = activityForStrava(a);
  if (!activity) return false;
  const speed = a.movingSec > 0 ? a.distanceM / 1000 / (a.movingSec / 3600) : null;
  const discipline = cardioDiscipline(activity, speed);
  const start = a.startEpoch * 1000;
  return own.some(
    (o) =>
      o.discipline === discipline &&
      (Math.abs(o.start - start) <= SAME_RUN_WINDOW_MS ||
        (o.end !== null && start >= o.start && start <= o.end))
  );
}

export interface StravaSyncResult {
  /** Sessions added to the app by this run. */
  imported: number;
  /** False when the server says there is no Strava link (never made, or revoked). */
  connected: boolean;
  error?: StravaCallError;
}

let inFlight: Promise<StravaSyncResult> | null = null;

/** Import every new Strava activity. Concurrent calls share one run. */
export function syncStrava(): Promise<StravaSyncResult> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function detailsFor(ids: number[]): Promise<Map<number, StravaActivityDetail>> {
  if (ids.length === 0) return new Map();
  const res = await fetchStravaDetails(ids);
  if (!res.ok || !res.details) return new Map();
  return new Map(res.details.map((d) => [d.id, d]));
}

async function runSync(now: number = Date.now()): Promise<StravaSyncResult> {
  const [weightKg, existing] = await Promise.all([bodyWeightKg(), getAllWorkoutSessions()]);
  const known = new Set(existing.map((s) => s.id));
  const own = ownEfforts(existing);
  let imported = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const page = await fetchNewStravaActivities();
    if (!page.ok) return { imported, connected: true, error: page.error };
    if (!page.connected) {
      rememberStravaLinked(false);
      return { imported, connected: false };
    }
    rememberStravaLinked(true);

    const activities = page.activities ?? [];
    const fresh = activities.filter(
      (a) => activityForStrava(a) !== null && !known.has(a.sessionId) && !recordedInApp(a, own)
    );
    const recentIds = fresh
      .filter((a) => now - a.startEpoch * 1000 <= FRESH_DETAIL_DAYS * DAY_MS)
      .map((a) => a.id)
      .slice(-DETAIL_BATCH);
    const details = await detailsFor(recentIds);

    const sessions: WorkoutSession[] = [];
    for (const a of fresh) {
      const session = stravaSessionFrom(a, details.get(a.id) ?? null, weightKg, now);
      if (session) sessions.push(session);
    }
    await saveImportedWorkoutSessions(sessions);
    for (const s of sessions) known.add(s.id);
    imported += sessions.length;

    if (activities.length > 0 && typeof page.newestEpoch === 'number') {
      const acked = await ackStravaActivities(
        page.newestEpoch,
        activities.map((a) => a.id)
      );
      // Saved but not acknowledged: the next sync sees these again and the
      // fixed ids skip them, so this is safe to stop on.
      if (!acked.ok) return { imported, connected: true, error: acked.error };
    }
    if (page.rateLimited) {
      writeValue(DETAILS_NEXT_KEY, String(now + RATE_LIMIT_PAUSE_MS));
      break;
    }
    if (!page.hasMore) break;
  }

  writeValue(LAST_SYNC_KEY, String(now));
  if (imported > 0) logger.sync.info(`strava: imported ${imported} activities`);
  return { imported, connected: true };
}

let backfillInFlight: Promise<number> | null = null;

/**
 * Fill in calories and km splits of imported sessions that came in without
 * them, newest first, a bounded number per run. Returns how many were updated.
 * Concurrent calls share one run.
 */
export function backfillStravaDetails(now: number = Date.now()): Promise<number> {
  if (!backfillInFlight) {
    backfillInFlight = runBackfill(now).finally(() => {
      backfillInFlight = null;
    });
  }
  return backfillInFlight;
}

async function runBackfill(now: number): Promise<number> {
  if (readNumber(DETAILS_NEXT_KEY) > now) return 0;

  const pending = (await getAllWorkoutSessions()).filter((s) => pendingStravaDetailId(s) !== null);
  if (pending.length === 0) return 0;

  let updated = 0;
  for (let i = 0; i < DETAILS_PER_RUN && i < pending.length; i += DETAIL_BATCH) {
    const batch = pending.slice(i, i + DETAIL_BATCH);
    const res = await fetchStravaDetails(batch.map((s) => pendingStravaDetailId(s) as number));
    if (!res.ok) {
      const limited = res.error === 'strava_rate_limited' || res.error === 'rate_limited';
      writeValue(
        DETAILS_NEXT_KEY,
        String(now + (limited ? RATE_LIMIT_PAUSE_MS : DETAILS_PAUSE_MS))
      );
      return updated;
    }
    if (!res.connected) {
      rememberStravaLinked(false);
      return updated;
    }
    const byId = new Map((res.details ?? []).map((d) => [d.id, d]));
    const next: WorkoutSession[] = [];
    for (const s of batch) {
      const detail = byId.get(pendingStravaDetailId(s) as number);
      // Re-read: the user may have deleted or edited it while Strava answered.
      const current = detail ? await getWorkoutSession(s.id) : null;
      if (detail && current && pendingStravaDetailId(current) !== null) {
        next.push(withStravaDetail(current, detail, now));
      }
    }
    await saveImportedWorkoutSessions(next);
    updated += next.length;
    if (res.rateLimited) {
      writeValue(DETAILS_NEXT_KEY, String(now + RATE_LIMIT_PAUSE_MS));
      return updated;
    }
  }

  writeValue(DETAILS_NEXT_KEY, String(now + DETAILS_PAUSE_MS));
  return updated;
}
