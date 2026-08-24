-- ============================================================================
-- Drop the free-template quota trigger (2026-08-24)
--
-- Why: the quota was monetization enforcement shipped before monetization
-- exists. `entitlements` has zero rows, so EVERY user is capped at 3 templates,
-- including coach program-day splits written into a trainee's library (a 4-day
-- split fails). Worse, when local IndexedDB passed and the DB rejected:
--   • syncWorkoutTemplate threw P0001 AFTER the row was already in IndexedDB
--   • offlineQueue classified it permanent → dead-letter, no user-visible error
--   • 3 of 4 save-as-template paths swallowed or mishandled the rejection
-- Net effect: silent data loss for anyone reinstalling or on a second device.
--
-- Nothing is being sold yet (billing_not_configured), so there is nothing to
-- protect. Re-introduce the quota only when billing ships, with grandfathering
-- and a server-authoritative pre-check.
--
-- Also drops the now-orphaned enforcement function. Idempotent: safe to run on
-- any environment state.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforce_free_template_quota ON public.workout_templates;
DROP FUNCTION IF EXISTS public.enforce_free_template_quota();
