// ============================================================================
// Strava HTTP — OAuth tokens, the activity list, one activity's detail.
// ----------------------------------------------------------------------------
// Everything that talks to strava.com lives here, and every answer is cut down
// to the few fields the app turns into a cardio session. The app never sees a
// raw Strava payload, and never sees a token.
//
// API reference: https://developers.strava.com/docs/reference/
// ============================================================================

const OAUTH_URL = 'https://www.strava.com/oauth';
const API_URL = 'https://www.strava.com/api/v3';

/** Strava's largest page. */
export const PAGE_SIZE = 200;

export class StravaError extends Error {
  constructor(
    readonly kind: 'unauthorized' | 'rate_limited' | 'not_found' | 'failed',
    message: string
  ) {
    super(message);
  }
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  athleteId: number | null;
  athleteName: string | null;
}

/** One activity as the list returns it, trimmed to what the app maps. */
export interface ActivitySummary {
  id: number;
  name: string;
  sportType: string;
  startDate: string;
  startEpoch: number;
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  elevationGainM: number;
  avgHr: number | null;
  maxHr: number | null;
  trainer: boolean;
  workoutType: number | null;
  kilojoules: number | null;
  polyline: string | null;
}

export interface ActivitySplit {
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  avgHr: number | null;
}

/** What only the per-activity endpoint knows. */
export interface ActivityDetail {
  id: number;
  calories: number | null;
  splits: ActivitySplit[];
  /** Deleted on Strava, or private and the scope does not cover it. */
  missing?: boolean;
}

type Json = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

async function call(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (res.status === 401) throw new StravaError('unauthorized', `strava ${res.status}`);
  if (res.status === 429) throw new StravaError('rate_limited', 'strava 429');
  if (res.status === 404) throw new StravaError('not_found', 'strava 404');
  if (!res.ok) throw new StravaError('failed', `strava ${res.status}`);
  return res.json();
}

function tokensOf(body: unknown): StravaTokens {
  const b = (body ?? {}) as Json;
  const athlete = (b.athlete ?? null) as Json | null;
  const accessToken = str(b.access_token);
  const refreshToken = str(b.refresh_token);
  const expiresAt = num(b.expires_at);
  if (!accessToken || !refreshToken || expiresAt === null) {
    throw new StravaError('failed', 'strava token response incomplete');
  }
  const name = athlete ? `${str(athlete.firstname)} ${str(athlete.lastname)}`.trim() : '';
  return {
    accessToken,
    refreshToken,
    expiresAt,
    athleteId: athlete ? num(athlete.id) : null,
    athleteName: name || null,
  };
}

interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

/** Trade the one-time `code` from the redirect for tokens. */
export async function exchangeCode(creds: ClientCredentials, code: string): Promise<StravaTokens> {
  const body = await call(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  return tokensOf(body);
}

/** A fresh access token (Strava's last six hours). Strava may rotate the refresh token. */
export async function refreshTokens(
  creds: ClientCredentials,
  refreshToken: string
): Promise<StravaTokens> {
  const body = await call(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  return tokensOf(body);
}

/** Revoke the app's access on Strava's side. Best effort — the row is deleted either way. */
export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(`${OAUTH_URL}/deauthorize`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: accessToken }),
  }).catch(() => undefined);
}

function summaryOf(raw: Json): ActivitySummary | null {
  const id = num(raw.id);
  const startDate = str(raw.start_date);
  const startMs = Date.parse(startDate);
  if (id === null || !Number.isFinite(startMs)) return null;
  const map = (raw.map ?? null) as Json | null;
  return {
    id,
    name: str(raw.name).slice(0, 200),
    sportType: str(raw.sport_type) || str(raw.type),
    startDate,
    startEpoch: Math.floor(startMs / 1000),
    distanceM: num(raw.distance) ?? 0,
    movingSec: num(raw.moving_time) ?? 0,
    elapsedSec: num(raw.elapsed_time) ?? 0,
    elevationGainM: num(raw.total_elevation_gain) ?? 0,
    avgHr: raw.has_heartrate === false ? null : num(raw.average_heartrate),
    maxHr: raw.has_heartrate === false ? null : num(raw.max_heartrate),
    trainer: raw.trainer === true,
    workoutType: num(raw.workout_type),
    kilojoules: num(raw.kilojoules),
    polyline: map ? str(map.summary_polyline) || null : null,
  };
}

/** One page of activities that started after `afterEpoch` (Strava returns them oldest first). */
export async function listActivities(
  accessToken: string,
  afterEpoch: number,
  page: number
): Promise<{ activities: ActivitySummary[]; rawCount: number }> {
  const url = `${API_URL}/athlete/activities?after=${afterEpoch}&page=${page}&per_page=${PAGE_SIZE}`;
  const body = await call(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const list = Array.isArray(body) ? (body as Json[]) : [];
  const activities = list.map(summaryOf).filter((a): a is ActivitySummary => a !== null);
  return { activities, rawCount: list.length };
}

/** Whether the token still opens the athlete's own profile (one read). */
export async function tokenWorks(accessToken: string): Promise<boolean> {
  try {
    await call(`${API_URL}/athlete`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return true;
  } catch {
    return false;
  }
}

/** Calories and the per-km splits of one activity. */
export async function activityDetail(accessToken: string, id: number): Promise<ActivityDetail> {
  let body: Json;
  try {
    body = (await call(`${API_URL}/activities/${id}?include_all_efforts=false`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })) as Json;
  } catch (err) {
    if (err instanceof StravaError && err.kind === 'not_found') {
      return { id, calories: null, splits: [], missing: true };
    }
    throw err;
  }
  const rawSplits = Array.isArray(body.splits_metric) ? (body.splits_metric as Json[]) : [];
  return {
    id,
    calories: num(body.calories),
    splits: rawSplits.map((s) => ({
      distanceM: num(s.distance) ?? 0,
      movingSec: num(s.moving_time) ?? 0,
      elapsedSec: num(s.elapsed_time) ?? 0,
      avgHr: num(s.average_heartrate),
    })),
  };
}
