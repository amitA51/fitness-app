-- ============================================================
-- COACH DIRECT-EDIT — uniform columns on all coach-editable trainee tables.
-- The coach-edit writers stamp updated_by (audit attribution) and the edit
-- sheets collect notes, but body_weight / body_measurements / personal_records
-- / recovery_logs were missing one or both columns, so those writes errored at
-- runtime (mocked unit tests couldn't catch it). Adding body_weight.notes also
-- stops the trainee's own weight notes being silently dropped on cloud sync.
-- All additive + nullable = safe on the live DB.
-- ============================================================

ALTER TABLE public.body_weight       ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.body_weight       ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.body_measurements ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.personal_records  ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.personal_records  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.recovery_logs     ADD COLUMN IF NOT EXISTS updated_by UUID;
