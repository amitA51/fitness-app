// ============================================================================
// Supabase Edge Function: coach-push-send
// ----------------------------------------------------------------------------
// Sends a Web Push notification to a target user's registered devices so a
// coach reminder/message reaches them when the app is CLOSED. Authorization:
// the caller must be an ACTIVE coach of the target (verified server-side), or
// the caller may push to themselves.
//
// Body: { targetUserId: string, title: string, body?: string, url?: string }
//
// Secrets (set once):
//   supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:you@app
// Deploy:  supabase functions deploy coach-push-send
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeRateLimits } from '../_shared/rateLimit.ts';
// @ts-expect-error remote ESM import (Deno)
import webpush from 'https://esm.sh/web-push@3.6.7';

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
  const VAPID_PUBLIC = env('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE = env('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = env('VAPID_SUBJECT') || 'mailto:admin@sparkos.app';
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ ok: false, error: 'no_vapid' }, 500, req);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ ok: false, error: 'unauthenticated' }, 401, req);

  let payload: { targetUserId?: string; title?: string; body?: string; url?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid' }, 400, req);
  }
  const targetUserId = String(payload.targetUserId ?? '');
  const title = String(payload.title ?? '').slice(0, 120);
  const bodyText = String(payload.body ?? '').slice(0, 300);

  // Click target: an INTERNAL path only.
  //
  // This used to accept any absolute `https://` URL, and public/push-sw.js opens
  // whatever it is given on tap. That turned an authorized coach account (or a
  // compromised one) into a way to deliver a system notification that opens an
  // arbitrary site — a credible phishing vector, since the notification carries
  // the app's own name and icon. Absolute URLs are now rejected rather than
  // silently rewritten, so a caller sending one gets a clear error instead of a
  // notification that quietly points somewhere else.
  const rawUrl = String(payload.url ?? '/');
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.length > 300) {
    return json({ ok: false, error: 'invalid_url' }, 400, req);
  }
  // Reject anything that could be parsed as a scheme or a control character.
  if (/[\u0000-\u001f\\]|^\/\s*\w+:/.test(rawUrl)) {
    return json({ ok: false, error: 'invalid_url' }, 400, req);
  }
  const url = rawUrl;

  if (!targetUserId || !title) return json({ ok: false, error: 'invalid' }, 400, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Send quota. Without one, a coach account can push to every client repeatedly;
  // notifications are the most intrusive channel the product has. Per-sender and
  // per-recipient, so neither a broadcast nor a single-target hammer gets through.
  // Self-notifications (reminders the user set) are exempt from the sender cap.
  if (targetUserId !== caller.id) {
    const quota = await consumeRateLimits(
      admin,
      [
        { bucket: 'coach_push_sender_hour', subject: caller.id, windowSeconds: 3600, maxEvents: 60 },
        { bucket: 'coach_push_sender_day', subject: caller.id, windowSeconds: 86_400, maxEvents: 300 },
        {
          bucket: 'coach_push_target_day',
          subject: `${caller.id}:${targetUserId}`,
          windowSeconds: 86_400,
          maxEvents: 10,
        },
      ],
      '[coach-push-send]'
    );
    if (!quota.allowed) {
      return json({ ok: false, error: 'rate_limited' }, quota.unavailable ? 503 : 429, req);
    }
  }

  // Authorize: self-push, or an ACTIVE coach->client link.
  if (targetUserId !== caller.id) {
    const { count, error: linkError } = await admin
      .from('coach_clients')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', caller.id)
      .eq('client_id', targetUserId)
      .eq('status', 'active');
    // A failed lookup must not read as "no link" OR as permission: fail closed.
    if (linkError) {
      console.error('[coach-push-send] coach link check failed:', linkError.message);
      return json({ ok: false, error: 'unavailable' }, 503, req);
    }
    if (!count) return json({ ok: false, error: 'forbidden' }, 403, req);
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', targetUserId);
  if (!subs || subs.length === 0) return json({ ok: true, sent: 0 }, 200, req);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({ title, body: bodyText, url });

  let sent = 0;
  await Promise.all(
    subs.map(async (s: { endpoint: string; keys: Record<string, string>; id: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
        sent++;
      } catch (err) {
        // 404/410 => subscription gone; clean it up.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    })
  );

  return json({ ok: true, sent }, 200, req);
});
