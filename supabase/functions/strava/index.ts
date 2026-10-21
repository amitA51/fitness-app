// ============================================================================
// Supabase Edge Function: strava
// ----------------------------------------------------------------------------
// Garmin → Strava → this app. The function owns the Strava link: it runs the
// OAuth handshake, keeps the tokens (strava_connections, service role only),
// and hands the app trimmed activity lists. The app turns each activity into an
// ordinary cardio WorkoutSession and saves it like any other workout.
//
// Body: { action, ... }
//   start      { redirectUri, mobile }  → { ok, url }        (user)
//   exchange   { code, state, scope }   → { ok, athleteName } (no user — see below)
//   status                              → { ok, connected, athleteName, connectedAt, lastSyncAt }
//   sync                                → { ok, connected, activities, hasMore, newestEpoch, rateLimited }
//   ack        { cursorEpoch }          → { ok }
//   details    { ids }                  → { ok, details, rateLimited }
//   disconnect                          → { ok }
//
// `exchange` runs WITHOUT a user session on purpose: on an iPhone the Strava
// redirect lands in Safari (or the in-app browser), whose storage is not the
// installed app's, so there is no login there. The one-time `state` minted by
// `start` for a signed-in user is what ties the code to that user.
//
// Secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, ALLOWED_ORIGIN.
// Deploy:  supabase functions deploy strava
// ============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeRateLimits } from '../_shared/rateLimit.ts';
import {
  type ActivityDetail,
  type ActivitySummary,
  PAGE_SIZE,
  StravaError,
  activityDetail,
  deauthorize,
  exchangeCode,
  listActivities,
  refreshTokens,
  tokenWorks,
} from './stravaApi.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';

// Same fail-closed CORS posture as coach-invite-accept: without ALLOWED_ORIGIN
// only the local dev servers are allowed.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

const CALLBACK_PATH = '/strava/callback';
const STATE_TTL_MS = 15 * 60 * 1000;
/** Pages of 200 per sync call — 1,000 activities, well inside Strava's 100 reads / 15 min. */
const MAX_PAGES_PER_SYNC = 5;
/** Ceiling when Strava does not return oldest-first and the cursor cannot be advanced safely. */
const MAX_PAGES_UNORDERED = 50;
const MAX_DETAIL_IDS = 30;
/**
 * Each sync re-reads this far behind the cursor: Garmin can hand Strava an
 * older activity after a newer one (two watches, a late Bluetooth sync, a
 * manual entry dated in the past). `recent_ids` stops that window from
 * re-delivering what the app already took — including runs deleted since.
 */
const LOOKBACK_SEC = 48 * 60 * 60;
/** Ids remembered for the look-back window; far more than 48 h of activities. */
const MAX_RECENT_IDS = 500;
const MAX_ACK_IDS = PAGE_SIZE * MAX_PAGES_UNORDERED;
/** Refresh the access token when it has less than this left, seconds. */
const REFRESH_MARGIN_SEC = 120;
const SCOPE = 'read,activity:read_all';

type Json = Record<string, unknown>;

interface ConnectionRow {
  user_id: string;
  athlete_id: number | null;
  athlete_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  cursor_epoch: number;
  recent_ids: number[] | null;
  oauth_state_expires_at: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
}

function allowedOrigins(): string[] {
  const raw = env('ALLOWED_ORIGIN');
  return (raw ? raw.split(',') : DEFAULT_ORIGINS).map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins().includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, req: Request): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });

const creds = () => ({
  clientId: env('STRAVA_CLIENT_ID'),
  clientSecret: env('STRAVA_CLIENT_SECRET'),
});

async function readRow(admin: SupabaseClient, userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await admin
    .from('strava_connections')
    .select(
      'user_id, athlete_id, athlete_name, access_token, refresh_token, expires_at, cursor_epoch, recent_ids, oauth_state_expires_at, connected_at, last_sync_at'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`strava_connections read failed: ${error.message}`);
  return (data as ConnectionRow | null) ?? null;
}

/** Forget the tokens Strava stopped honouring (the athlete revoked access on strava.com). */
async function dropTokens(admin: SupabaseClient, userId: string): Promise<void> {
  await admin
    .from('strava_connections')
    .update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

/** A usable access token, refreshing it first when it is about to expire. */
async function accessTokenFor(admin: SupabaseClient, row: ConnectionRow): Promise<string> {
  const expiresAt = row.expires_at ? Date.parse(row.expires_at) / 1000 : 0;
  if (row.access_token && expiresAt - Date.now() / 1000 > REFRESH_MARGIN_SEC)
    return row.access_token;
  if (!row.refresh_token) throw new StravaError('unauthorized', 'no refresh token');
  const fresh = await refreshTokens(creds(), row.refresh_token);
  const { error } = await admin
    .from('strava_connections')
    .update({
      access_token: fresh.accessToken,
      refresh_token: fresh.refreshToken,
      expires_at: new Date(fresh.expiresAt * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id);
  if (error) throw new Error(`token save failed: ${error.message}`);
  return fresh.accessToken;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function start(admin: SupabaseClient, userId: string, body: Json, req: Request) {
  let redirect: URL;
  try {
    redirect = new URL(String(body.redirectUri ?? ''));
  } catch {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  if (!allowedOrigins().includes(redirect.origin) || redirect.pathname !== CALLBACK_PATH) {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  const state = crypto.randomUUID();
  const { error } = await admin.from('strava_connections').upsert({
    user_id: userId,
    oauth_state: state,
    oauth_state_expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`state save failed: ${error.message}`);

  // The mobile endpoint opens the Strava app when it is installed (already
  // signed in) and falls back to the web page when it is not.
  const base =
    body.mobile === true
      ? 'https://www.strava.com/oauth/mobile/authorize'
      : 'https://www.strava.com/oauth/authorize';
  const params = new URLSearchParams({
    client_id: creds().clientId,
    redirect_uri: `${redirect.origin}${CALLBACK_PATH}`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return json({ ok: true, url: `${base}?${params}` }, 200, req);
}

async function exchange(admin: SupabaseClient, body: Json, req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  const verdict = await consumeRateLimits(
    admin,
    [{ bucket: 'strava_exchange_ip', subject: ip, windowSeconds: 60, maxEvents: 20 }],
    '[strava]'
  );
  if (!verdict.allowed) {
    return json({ ok: false, error: 'rate_limited' }, verdict.unavailable ? 503 : 429, req);
  }

  const code = String(body.code ?? '');
  const state = String(body.state ?? '');
  const scope = String(body.scope ?? '');
  if (!code || code.length > 200 || !state || state.length > 100) {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  // Without an activity scope there is nothing to import — the athlete
  // unticked "view data about your activities" on Strava's consent page.
  if (!/\bactivity:read(_all)?\b/.test(scope)) return json({ ok: false, error: 'scope' }, 200, req);

  const { data, error } = await admin
    .from('strava_connections')
    .select('user_id, athlete_id, cursor_epoch, oauth_state_expires_at')
    .eq('oauth_state', state)
    .maybeSingle();
  if (error) throw new Error(`state lookup failed: ${error.message}`);
  const row = data as Pick<
    ConnectionRow,
    'user_id' | 'athlete_id' | 'cursor_epoch' | 'oauth_state_expires_at'
  > | null;
  if (!row || !row.oauth_state_expires_at || Date.parse(row.oauth_state_expires_at) < Date.now()) {
    return json({ ok: false, error: 'expired' }, 200, req);
  }

  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(creds(), code);
  } catch (err) {
    // A used or forged code is a 400 from Strava, not a server fault.
    console.warn('[strava] code exchange refused:', err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'denied' }, 200, req);
  }

  // One Strava athlete feeds one account: the newest link wins.
  if (tokens.athleteId !== null) {
    await admin
      .from('strava_connections')
      .delete()
      .eq('athlete_id', tokens.athleteId)
      .neq('user_id', row.user_id);
  }

  const now = new Date().toISOString();
  const sameAthlete = row.athlete_id !== null && row.athlete_id === tokens.athleteId;
  const { error: saveError } = await admin
    .from('strava_connections')
    .update({
      athlete_id: tokens.athleteId,
      athlete_name: tokens.athleteName,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
      scope,
      // Reconnecting the same athlete resumes where the import stopped; a
      // different athlete starts from the beginning of their history.
      cursor_epoch: sameAthlete ? row.cursor_epoch : 0,
      ...(sameAthlete ? {} : { recent_ids: [] }),
      oauth_state: null,
      oauth_state_expires_at: null,
      connected_at: now,
      updated_at: now,
    })
    .eq('user_id', row.user_id);
  if (saveError) throw new Error(`token save failed: ${saveError.message}`);
  return json({ ok: true, athleteName: tokens.athleteName }, 200, req);
}

async function status(admin: SupabaseClient, userId: string, req: Request) {
  const row = await readRow(admin, userId);
  const connected = !!row?.access_token || !!row?.refresh_token;
  return json(
    {
      ok: true,
      connected,
      athleteName: connected ? (row?.athlete_name ?? null) : null,
      connectedAt: connected ? (row?.connected_at ?? null) : null,
      lastSyncAt: connected ? (row?.last_sync_at ?? null) : null,
    },
    200,
    req
  );
}

/**
 * The app's session id for one activity: a uuid derived from the user and the
 * activity, so every device computes the same one (nothing is saved twice) and
 * two accounts that once linked the same athlete never collide on a row.
 */
async function sessionIdFor(userId: string, activityId: number): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`strava:${userId}:${activityId}`)
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function sync(admin: SupabaseClient, userId: string, req: Request) {
  const row = await readRow(admin, userId);
  if (!row || (!row.access_token && !row.refresh_token)) {
    return json({ ok: true, connected: false }, 200, req);
  }
  const token = await accessTokenFor(admin, row);
  const cursor = row.cursor_epoch;
  const after = Math.max(0, cursor - LOOKBACK_SEC);
  const recent = new Set((row.recent_ids ?? []).map(Number));
  // Past the cursor: new. Inside the look-back window: only what was never handed over.
  const isNew = (a: ActivitySummary) =>
    a.startEpoch > cursor || (a.startEpoch > after && !recent.has(a.id));

  const activities: ActivitySummary[] = [];
  let maxPages = MAX_PAGES_PER_SYNC;
  let unordered = false;
  let hasMore = false;
  let rateLimited = false;
  for (let page = 1; page <= maxPages; page++) {
    let result: { activities: ActivitySummary[]; rawCount: number };
    try {
      result = await listActivities(token, after, page);
    } catch (err) {
      // Stopping half-way is safe only oldest-first, where what was read is a
      // prefix of the history and the cursor can stop at its end.
      if (
        err instanceof StravaError &&
        err.kind === 'rate_limited' &&
        !unordered &&
        activities.length > 0
      ) {
        rateLimited = true;
        hasMore = true;
        break;
      }
      throw err;
    }
    // If a page ever comes back newest first, the whole range must be read in
    // this one call — a cursor at the newest would skip the unread older pages.
    const first = result.activities[0];
    const last = result.activities[result.activities.length - 1];
    if (page === 1 && first && last && first.startEpoch > last.startEpoch) {
      unordered = true;
      maxPages = MAX_PAGES_UNORDERED;
    }
    activities.push(...result.activities.filter(isNew));
    if (result.rawCount < PAGE_SIZE) break;
    if (page === maxPages) hasMore = true;
  }
  if (unordered && hasMore) throw new Error('newest-first history did not fit one call');

  activities.sort((a, b) => a.startEpoch - b.startEpoch);
  const newestEpoch = activities.reduce((max, a) => Math.max(max, a.startEpoch), cursor);
  const withIds = await Promise.all(
    activities.map(async (a) => ({ ...a, sessionId: await sessionIdFor(userId, a.id) }))
  );
  await admin
    .from('strava_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId);
  return json(
    { ok: true, connected: true, activities: withIds, hasMore, newestEpoch, rateLimited },
    200,
    req
  );
}

/** The app saved a page: move the cursor and remember the ids it took. */
async function ack(admin: SupabaseClient, userId: string, body: Json, req: Request) {
  const requested = Number(body.cursorEpoch);
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (
    !Number.isInteger(requested) ||
    requested < 0 ||
    ids.length > MAX_ACK_IDS ||
    !ids.every((id) => Number.isSafeInteger(id) && id > 0)
  ) {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  // A watch with a wrong clock can date an activity in the future; never let
  // that park the cursor beyond tomorrow.
  const cursor = Math.min(requested, Math.floor(Date.now() / 1000) + 86_400);
  const row = await readRow(admin, userId);
  if (!row) return json({ ok: false, error: 'not_connected' }, 200, req);

  const merged = [...new Set([...(row.recent_ids ?? []).map(Number), ...(ids as number[])])];
  const { error } = await admin
    .from('strava_connections')
    .update({
      cursor_epoch: Math.max(cursor, row.cursor_epoch),
      recent_ids: merged.slice(-MAX_RECENT_IDS),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(`cursor save failed: ${error.message}`);
  return json({ ok: true }, 200, req);
}

async function details(admin: SupabaseClient, userId: string, body: Json, req: Request) {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (
    ids.length === 0 ||
    ids.length > MAX_DETAIL_IDS ||
    !ids.every((id) => Number.isSafeInteger(id) && id > 0)
  ) {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  const row = await readRow(admin, userId);
  if (!row || (!row.access_token && !row.refresh_token)) {
    return json({ ok: true, connected: false, details: [] }, 200, req);
  }
  const token = await accessTokenFor(admin, row);
  const out: ActivityDetail[] = [];
  let rateLimited = false;
  let tokenChecked = false;
  for (const id of ids as number[]) {
    try {
      out.push(await activityDetail(token, id));
    } catch (err) {
      if (!(err instanceof StravaError)) throw err;
      if (err.kind === 'rate_limited') {
        rateLimited = true;
        break;
      }
      // A 401 on ONE activity is how Strava refuses an activity the scope does
      // not cover (made private later). Only a token that fails everywhere is
      // a revoked link — check once with the athlete endpoint.
      if (err.kind === 'unauthorized' && !tokenChecked) {
        tokenChecked = true;
        if (!(await tokenWorks(token))) throw err;
      }
      // One unreadable activity must not block the batch forever: give up on
      // its detail; the run itself is already in the app.
      console.warn(`[strava] detail ${id} skipped: ${err.message}`);
      out.push({ id, calories: null, splits: [], missing: true });
    }
  }
  return json({ ok: true, connected: true, details: out, rateLimited }, 200, req);
}

/**
 * Revoke on Strava and forget the tokens, but keep the cursor and the recent
 * ids: reconnecting the same athlete must not bring back runs deleted here.
 */
async function disconnect(admin: SupabaseClient, userId: string, req: Request) {
  const row = await readRow(admin, userId);
  if (row && (row.access_token || row.refresh_token)) {
    try {
      await deauthorize(await accessTokenFor(admin, row));
    } catch (err) {
      console.warn('[strava] deauthorize skipped:', err instanceof Error ? err.message : err);
    }
  }
  if (row) await dropTokens(admin, userId);
  return json({ ok: true }, 200, req);
}

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, req);
  if (!creds().clientId || !creds().clientSecret) {
    return json({ ok: false, error: 'not_configured' }, 503, req);
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  const action = String(body.action ?? '');
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  let userId: string | undefined;

  try {
    if (action === 'exchange') return await exchange(admin, body, req);

    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData } = await userClient.auth.getUser();
    userId = userData?.user?.id;
    if (!userId) return json({ ok: false, error: 'unauthenticated' }, 401, req);

    const verdict = await consumeRateLimits(
      admin,
      [{ bucket: 'strava_user', subject: userId, windowSeconds: 60, maxEvents: 40 }],
      '[strava]'
    );
    if (!verdict.allowed) {
      return json({ ok: false, error: 'rate_limited' }, verdict.unavailable ? 503 : 429, req);
    }

    switch (action) {
      case 'start':
        return await start(admin, userId, body, req);
      case 'status':
        return await status(admin, userId, req);
      case 'sync':
        return await sync(admin, userId, req);
      case 'ack':
        return await ack(admin, userId, body, req);
      case 'details':
        return await details(admin, userId, body, req);
      case 'disconnect':
        return await disconnect(admin, userId, req);
      default:
        return json({ ok: false, error: 'invalid' }, 400, req);
    }
  } catch (err) {
    if (err instanceof StravaError && err.kind === 'unauthorized' && userId) {
      // Revoked on strava.com: forget the tokens so the app shows "not connected".
      await dropTokens(admin, userId);
      return json({ ok: true, connected: false, error: 'revoked' }, 200, req);
    }
    if (err instanceof StravaError && err.kind === 'rate_limited') {
      return json({ ok: false, error: 'strava_rate_limited' }, 200, req);
    }
    console.error(`[strava] ${action} failed:`, err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'failed' }, 500, req);
  }
});
