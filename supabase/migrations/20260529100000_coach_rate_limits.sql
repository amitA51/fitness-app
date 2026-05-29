-- ============================================================
-- COACH PLATFORM — rate-limit ledger (defense-in-depth)
-- Backs edge-function throttling of sensitive actions, primarily brute-forcing
-- invite codes via `coach-invite-accept`. Written ONLY by the service role
-- (RLS enabled with no policies => denied to anon/authenticated). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
    ON public.rate_limit_events(bucket, subject, created_at DESC);

-- Service role bypasses RLS; enabling it with no policies denies everyone else.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Prune old rows periodically (e.g. a scheduled job / pg_cron):
--   DELETE FROM public.rate_limit_events WHERE created_at < NOW() - INTERVAL '1 day';
