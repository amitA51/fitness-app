// ============================================================================
// Supabase Edge Function: coach-invite-accept
// ----------------------------------------------------------------------------
// The trusted server-side endpoint for a trainee accepting a coach invite.
// RLS hides other coaches' invite rows from clients, so the lookup-by-code +
// consent + seat enforcement happen here with the service role.
//
// Body: { code: string }
// Returns: { ok: true, coachId } | { ok: false, error: 'invalid'|'expired'|'seat_limit'|'already'|'unauthenticated'|'coaches_cannot_join' }
//
// Deploy:  supabase functions deploy coach-invite-accept
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeRateLimits } from '../_shared/rateLimit.ts';

// @ts-expect-error Deno global
const env = (k: string): string => (Deno.env.get(k) ?? '') as string;

// SECURITY: do NOT hardcode the production origin as a default. If
// ALLOWED_ORIGIN is unset we fall back to localhost-only (dev) so a
// misconfigured deploy fails CLOSED for browsers (cross-origin requests get
// 'null'), consistent with ai-chat. Set ALLOWED_ORIGIN in prod secrets.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

function corsHeaders(req: Request): Record<string, string> {
  const raw = env('ALLOWED_ORIGIN');
  const allowed = (raw ? raw.split(',') : DEFAULT_ORIGINS).map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
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

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, req);

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = env('SUPABASE_ANON_KEY');

  // Identify the caller from their JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ ok: false, error: 'unauthenticated' }, 401, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Rate-limit accept attempts (brute-forcing invite codes), per-user and
  // per-IP, through the atomic RPC. The previous read-then-insert let concurrent
  // attempts all observe a below-limit count, and read a PostgREST error as zero
  // usage — see supabase/migrations/20260726130000_rate_limit_atomic.sql.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const rateVerdict = await consumeRateLimits(
    admin,
    [
      { bucket: 'invite_accept_user', subject: caller.id, windowSeconds: 60, maxEvents: 8 },
      { bucket: 'invite_accept_ip', subject: ip, windowSeconds: 60, maxEvents: 20 },
    ],
    '[coach-invite-accept]'
  );
  if (!rateVerdict.allowed) {
    // Fail CLOSED on an unavailable limiter (503) vs an exhausted quota (429).
    return json({ ok: false, error: 'rate_limited' }, rateVerdict.unavailable ? 503 : 429, req);
  }

  // Role split: a coach has no coach of their own. Reject coach callers before
  // any invite lookup (service role read — RLS cannot hide the row).
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();
  if (callerProfile?.role === 'coach') {
    return json({ ok: false, error: 'coaches_cannot_join' }, 200, req);
  }

  let code = '';
  try {
    code = String((await req.json()).code ?? '')
      .trim()
      .toUpperCase();
  } catch {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  if (!code || code.length > 64) return json({ ok: false, error: 'invalid' }, 400, req);

  // Look up the invite.
  const { data: invite } = await admin
    .from('coach_invites')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (!invite || invite.status !== 'pending')
    return json({ ok: false, error: 'invalid' }, 200, req);
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('coach_invites').update({ status: 'expired' }).eq('id', invite.id);
    return json({ ok: false, error: 'expired' }, 200, req);
  }
  if (invite.coach_id === caller.id) return json({ ok: false, error: 'invalid' }, 200, req);

  // Seat enforcement (clean error before the DB trigger fires).
  const { data: sub } = await admin
    .from('coach_subscriptions')
    .select('seat_limit')
    .eq('coach_id', invite.coach_id)
    .maybeSingle();
  const seatLimit = sub?.seat_limit ?? 1;
  const { count } = await admin
    .from('coach_clients')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', invite.coach_id)
    .eq('status', 'active');
  // Allow re-activation of an existing link without consuming a new seat.
  const { data: existing } = await admin
    .from('coach_clients')
    .select('id, status')
    .eq('coach_id', invite.coach_id)
    .eq('client_id', caller.id)
    .maybeSingle();
  // Re-accepting a coach you're already actively linked to is NOT a new
  // connection — tell the client so it can say "כבר מחוברים" instead of
  // celebrating a fresh link. The invite stays pending (still usable).
  if (existing?.status === 'active') {
    return json({ ok: false, error: 'already' }, 200, req);
  }
  if ((count ?? 0) >= seatLimit) {
    return json({ ok: false, error: 'seat_limit' }, 200, req);
  }

  // Create / activate the link with consent.
  const { error: upsertError } = await admin.from('coach_clients').upsert(
    {
      coach_id: invite.coach_id,
      client_id: caller.id,
      status: 'active',
      consent_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id,client_id' }
  );
  if (upsertError) {
    const seat = upsertError.message?.includes('seat_limit_reached');
    return json({ ok: false, error: seat ? 'seat_limit' : 'invalid' }, 200, req);
  }

  await admin
    .from('coach_invites')
    .update({ status: 'accepted', client_id: caller.id })
    .eq('id', invite.id);

  return json({ ok: true, coachId: invite.coach_id }, 200, req);
});
