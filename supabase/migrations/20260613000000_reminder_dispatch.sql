-- ============================================================================
-- Reminder dispatch: server-side delivery dedup for the reminders-dispatch
-- edge function (sends Web Push for due reminders so they reach a closed app).
--
-- This migration is SAFE and INERT to apply on its own: it only creates the
-- dedup table. Turning delivery ON is a separate, explicit step (see the
-- ACTIVATION block at the bottom) because it needs the project URL + secrets,
-- which must NOT live in version control.
-- ============================================================================

-- Each (reminder, local-minute) is claimed exactly once. The edge function
-- INSERTs a row before sending; a UNIQUE conflict means another cron run /
-- retry already handled that minute, so it skips — preventing double-sends.
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
    delivery_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_created_at
    ON public.reminder_deliveries (created_at);

-- RLS on with NO policies: this table is written and read ONLY by the edge
-- function using the service role (which bypasses RLS). No client — anon or
-- authenticated — may touch it. (Same deny-by-default pattern as
-- rate_limit_events.)
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.reminder_deliveries IS
    'Dedup ledger for reminders-dispatch edge function. Service-role only (RLS on, no policies). Prune rows older than ~2 days.';

-- ============================================================================
-- ACTIVATION (run manually per environment — do NOT commit real URLs/secrets):
--
--   1. supabase secrets set CRON_SECRET=<random> VAPID_PUBLIC_KEY=... \
--        VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@app
--   2. supabase functions deploy reminders-dispatch --no-verify-jwt
--   3. Enable extensions + schedule the once-a-minute call (psql / SQL editor):
--
--      create extension if not exists pg_cron;
--      create extension if not exists pg_net;
--
--      select cron.schedule(
--        'reminders-dispatch-every-minute', '* * * * *',
--        $$
--        select net.http_post(
--          url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/reminders-dispatch',
--          headers := jsonb_build_object(
--                       'Content-Type',     'application/json',
--                       'x-dispatch-secret', '<CRON_SECRET>'),
--          body    := '{}'::jsonb
--        );
--        $$
--      );
--
--   4. Prune the dedup ledger daily:
--      select cron.schedule(
--        'reminder-deliveries-prune', '17 3 * * *',
--        $$ delete from public.reminder_deliveries where created_at < now() - interval '2 days'; $$
--      );
-- ============================================================================
