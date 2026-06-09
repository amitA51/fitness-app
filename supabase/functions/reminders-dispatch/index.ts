// ============================================================================
// Supabase Edge Function: reminders-dispatch
// ----------------------------------------------------------------------------
// Server-side reminder delivery so a coach's scheduled reminder reaches the
// trainee even when the app is fully CLOSED (the client-side materializer only
// runs while a tab is open). Intended to be invoked once a minute by pg_cron
// via pg_net — see the matching migration for the (env-specific) schedule.
//
// AUTH: machine-invoked, NOT a user JWT. Deploy with --no-verify-jwt and guard
// with a shared secret: the caller must send  x-dispatch-secret: <CRON_SECRET>.
// If CRON_SECRET is unset the function fails CLOSED (500) so a misconfigured
// deploy never runs unauthenticated.
//
// DEDUP: every (reminder, local-minute) pair is claimed exactly once via an
// INSERT into reminder_deliveries (UNIQUE delivery_key). Overlapping cron runs
// or retries can't double-send.
//
// TZ: schedule.time has no timezone; this app is Israel-only, so "now" is
// evaluated in Asia/Jerusalem (matches how the client fires in local time).
//
// Secrets (set once):
//   supabase secrets set CRON_SECRET=...  VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:you@app
// Deploy:
//   supabase functions deploy reminders-dispatch --no-verify-jwt
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-expect-error remote ESM import (Deno)
import webpush from 'https://esm.sh/web-push@3.6.7';

// @ts-expect-error Deno global
const env = (k: string): string => (Deno.env.get(k) ?? '') as string;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface IsraelNow {
  hhmm: string; // 'HH:MM'
  date: string; // 'YYYY-MM-DD'
  day: number; // 0..6, Sun=0 (matches JS getDay / reminder.schedule.days)
}

function israelNow(now: Date): IsraelNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  // en-GB can emit '24' for midnight; normalise to '00'.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    hhmm: `${hour}:${get('minute')}`,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    day: WEEKDAY_INDEX[get('weekday')] ?? -1,
  };
}

interface ReminderRow {
  id: string;
  client_id: string | null;
  group_id: string | null;
  title: string;
  body: string | null;
  schedule: { time?: string; days?: number[]; date?: string } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  const SECRET = env('CRON_SECRET');
  if (!SECRET) return json({ ok: false, error: 'no_secret' }, 500); // fail closed
  if (req.headers.get('x-dispatch-secret') !== SECRET) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const VAPID_PUBLIC = env('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE = env('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = env('VAPID_SUBJECT') || 'mailto:admin@sparkos.app';
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ ok: false, error: 'no_vapid' }, 500);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const t = israelNow(new Date());

  // Candidate reminders: same minute-of-day. Day/date constraints filtered below.
  const { data: candidates, error } = await admin
    .from('reminders')
    .select('id, client_id, group_id, title, body, schedule')
    .eq('schedule->>time', t.hhmm);
  if (error) return json({ ok: false, error: error.message }, 500);

  const due = (candidates ?? []).filter((r: ReminderRow) => {
    const s = r.schedule ?? {};
    if (s.date && s.date !== t.date) return false;
    if (Array.isArray(s.days) && s.days.length > 0 && !s.days.includes(t.day)) return false;
    return true;
  });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let sent = 0;
  let dispatched = 0;

  for (const r of due as ReminderRow[]) {
    // Claim this (reminder, minute) exactly once. A conflict means another run
    // already handled it — skip without sending.
    const deliveryKey = `${r.id}:${t.date}T${t.hhmm}`;
    const { data: claim, error: claimErr } = await admin
      .from('reminder_deliveries')
      .upsert({ reminder_id: r.id, delivery_key: deliveryKey }, {
        onConflict: 'delivery_key',
        ignoreDuplicates: true,
      })
      .select('id');
    if (claimErr || !claim || claim.length === 0) continue; // already dispatched
    dispatched++;

    // Resolve target users: a single client, or every member of a group.
    let targets: string[] = [];
    if (r.client_id) {
      targets = [r.client_id];
    } else if (r.group_id) {
      const { data: members } = await admin
        .from('client_group_members')
        .select('client_id')
        .eq('group_id', r.group_id);
      targets = (members ?? []).map((m: { client_id: string }) => m.client_id);
    }
    if (targets.length === 0) continue;

    const payload = JSON.stringify({
      title: r.title,
      body: r.body ?? '',
      url: '/my-coach',
      // Stable per-reminder-per-day tag so a client-side local notification for
      // the same reminder coalesces with this push instead of double-showing.
      tag: `reminder:${r.id}:${t.date}`,
    });

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, keys')
      .in('user_id', targets);

    await Promise.all(
      (subs ?? []).map(
        async (sub: { id: string; endpoint: string; keys: Record<string, string> }) => {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
            sent++;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await admin.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      )
    );
  }

  return json({ ok: true, due: due.length, dispatched, sent }, 200);
});
