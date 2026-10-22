-- ============================================================================
-- reminders-dispatch: call the function only when a reminder exists
-- ----------------------------------------------------------------------------
-- The pg_cron job from 20260613000000 POSTs to the reminders-dispatch edge
-- function every minute through pg_net — 1,440 HTTP calls a day, each one a
-- cron run record and a stored pg_net response. On 2026-10-22 the reminders
-- table was empty (no coach had ever scheduled one), so all of that was load
-- with no reminder behind it, on a Nano database that was already stalling.
--
-- The job keeps its schedule and its secret; its SELECT just gains a WHERE, so
-- with no reminders it ends without touching pg_net, and the first reminder a
-- coach saves is dispatched on the next minute as before. Rewritten in place
-- (regexp on the stored command) so the dispatch secret never has to appear in
-- a migration; skipped when already applied.
-- ============================================================================

SELECT cron.alter_job(
  jobid,
  command := regexp_replace(
    command,
    '\)\s*;\s*$',
    ') WHERE EXISTS (SELECT 1 FROM public.reminders);'
  )
)
FROM cron.job
WHERE jobname = 'reminders-dispatch-every-minute'
  AND command NOT ILIKE '%FROM public.reminders%';
