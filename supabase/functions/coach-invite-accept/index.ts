// ============================================================================
// Supabase Edge Function: coach-invite-accept
// ----------------------------------------------------------------------------
// The trusted server-side endpoint for a trainee accepting a coach invite.
// RLS hides other coaches' invite rows from clients, so the lookup-by-code +
// consent + seat enforcement happen here with the service role.
//
// Body: { code: string }
// Returns: { ok: true, coachId } | { ok: false, error: 'invalid'|'expired'|'seat_limit'|'already'|'unauthenticated' }
//
// Deploy:  supabase functions deploy coach-invite-accept
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-expect-error Deno global
const env = (k: string): string => (Deno.env.get(k) ?? '') as string;

function corsHeaders(req: Request): Record<string, string> {
  const raw = env('ALLOWED_ORIGIN');
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.length > 0 && allowed.includes(origin) ? origin : 'null',
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
  // per-IP. Fails OPEN if the ledger is unavailable (e.g. migration not yet
  // applied) — invite validity, consent and seat checks remain authoritative.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  try {
    await admin.from('rate_limit_events').insert([
      { bucket: 'invite_accept_user', subject: caller.id },
      { bucket: 'invite_accept_ip', subject: ip },
    ]);
    const since = new Date(Date.now() - 60_000).toISOString();
    const [{ count: userHits }, { count: ipHits }] = await Promise.all([
      admin
        .from('rate_limit_events')
        .select('id', { count: 'exact', head: true })
        .eq('bucket', 'invite_accept_user')
        .eq('subject', caller.id)
        .gte('created_at', since),
      admin
        .from('rate_limit_events')
        .select('id', { count: 'exact', head: true })
        .eq('bucket', 'invite_accept_ip')
        .eq('subject', ip)
        .gte('created_at', since),
    ]);
    if ((userHits ?? 0) > 8 || (ipHits ?? 0) > 20) {
      return json({ ok: false, error: 'rate_limited' }, 429, req);
    }
  } catch (_e) {
    // ledger unavailable — fail open
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
  if (!invite || invite.status !== 'pending') return json({ ok: false, error: 'invalid' }, 200, req);
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
  if ((count ?? 0) >= seatLimit && existing?.status !== 'active') {
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
