-- ============================================================================
-- Strava connections
-- ----------------------------------------------------------------------------
-- One row per user who linked Strava (Garmin → Strava → this app). The `strava`
-- edge function is the only reader and writer: it holds the OAuth tokens, the
-- one-time `state` of a connect in progress, and the import cursor. Disconnecting
-- clears the tokens but keeps the row, so a reconnect resumes where it stopped.
--
-- The tokens must never reach a browser, so RLS is on with NO policies and the
-- client roles lose every grant — exactly like account_deletion_audit. The app
-- learns "connected or not" through the function's `status` action.
--
-- Imported activities are NOT stored here: the app turns them into ordinary
-- workout_sessions (cardio), so the calendar, progress, records and sync work
-- unchanged.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.strava_connections (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id              bigint UNIQUE,
  athlete_name            text,
  access_token            text,
  refresh_token           text,
  expires_at              timestamptz,
  scope                   text,
  -- Epoch seconds of the newest activity start the app has saved. The next
  -- import asks Strava only for activities that started after it.
  cursor_epoch            bigint NOT NULL DEFAULT 0,
  -- Activity ids already handed to the app (the newest few hundred). Each sync
  -- re-reads 48 h behind the cursor to catch late uploads; these keep that
  -- window from re-delivering a run the app took — or the user deleted since.
  recent_ids              bigint[] NOT NULL DEFAULT '{}',
  -- A connect in progress: the random `state` sent to Strava and its expiry.
  oauth_state             text UNIQUE,
  oauth_state_expires_at  timestamptz,
  connected_at            timestamptz,
  last_sync_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS on with no policies: only the service role (which bypasses RLS) may read
-- or write. Clients must never see an OAuth token.
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.strava_connections FROM anon, authenticated;

COMMENT ON TABLE public.strava_connections IS
  'Service-role-only Strava OAuth link per user (tokens, connect state, import cursor). Read and written by the strava edge function.';
