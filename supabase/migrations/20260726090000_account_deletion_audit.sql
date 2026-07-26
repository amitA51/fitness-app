-- ============================================================================
-- Account deletion audit trail
-- ----------------------------------------------------------------------------
-- The `account-delete` edge function erases every row a user owns and then
-- removes the auth.users record itself. Once that happens there is no longer any
-- trace that the request was honoured, which is exactly what a data-subject
-- erasure request needs to be able to prove.
--
-- This table therefore keeps the MINIMUM viable evidence: the (now dangling)
-- user id, when it was deleted, what the outcome was, and how many storage
-- objects were removed. It deliberately stores no email, name or content, so it
-- is not itself personal data beyond the opaque identifier.
--
-- There is intentionally NO foreign key to auth.users: the row must survive the
-- user it describes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  outcome         text NOT NULL DEFAULT 'started'
                    CHECK (outcome IN ('started', 'completed', 'failed')),
  storage_objects_removed integer NOT NULL DEFAULT 0,
  failure_reason  text
);

CREATE INDEX IF NOT EXISTS account_deletion_audit_user_idx
  ON public.account_deletion_audit (deleted_user_id, requested_at DESC);

-- RLS on with no policies at all: only the service role (which bypasses RLS)
-- may read or write this ledger. Clients must never see other users' erasures.
ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_deletion_audit FROM anon, authenticated;

COMMENT ON TABLE public.account_deletion_audit IS
  'Service-role-only evidence that an account erasure request was executed. Survives the deleted auth.users row on purpose.';
