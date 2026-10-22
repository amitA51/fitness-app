-- ============================================================================
-- Keep pg_cron's and pg_net's own logs small
-- ----------------------------------------------------------------------------
-- reminders-dispatch runs every minute through pg_net (20260613000000), so
-- pg_cron writes 1,440 run records a day into cron.job_run_details and pg_net
-- keeps every HTTP response in net._http_response. Both tables are written by
-- long-lived background workers whose table statistics never reach
-- autovacuum, so neither was ever vacuumed: by 2026-10-21 they held 103 MB and
-- 111 MB — the two largest tables in a database whose real data is under 2 MB.
-- On the Nano instance, pg_net's TTL delete scanned that bloat for 11+ minutes
-- at a time, the disk budget ran out, and logins, sync and every cron run
-- stalled for ~12 hours at a stretch.
--
-- Nothing in the app reads either table (the Postgres log already records each
-- cron run), so both are emptied every hour — small enough that the truncate
-- never waits long, and the first one runs within the hour of applying this.
-- The project role cannot VACUUM them (supabase_admin owns them) but may
-- TRUNCATE them, which also returns the space at once.
--
-- Lock order matters. pg_net's own TTL delete can hold net._http_response for
-- minutes on a bloated table, so that truncate may wait (pg_net simply pauses
-- meanwhile). cron.job_run_details goes second with a short wait: holding it
-- would stall the scheduler, and with it every reminder.
-- ============================================================================

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cron-and-net-logs-prune';
SELECT cron.schedule(
  'cron-and-net-logs-prune',
  '7 * * * *',
  $$
    SET LOCAL statement_timeout = '20min';
    SET LOCAL lock_timeout = '15min';
    TRUNCATE net._http_response;
    SET LOCAL lock_timeout = '5s';
    TRUNCATE cron.job_run_details;
  $$
);
