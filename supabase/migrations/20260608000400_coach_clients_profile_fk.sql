-- ============================================================
-- COACH ROSTER FIX — let PostgREST embed public.profiles on coach_clients.
-- coach_clients.{coach_id,client_id} only had FKs to auth.users, so the
-- roster/client-profile embeds (profiles!coach_clients_*_fkey) could never
-- resolve — the coach roster showed "no clients" with real data.
-- Add explicit FKs to public.profiles (every coach/client is an auth user and
-- thus always has a profiles row via handle_new_user + backfill) so the embed
-- can traverse coach_clients -> profiles.
-- ============================================================

ALTER TABLE public.coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_client_id_profile_fkey;
ALTER TABLE public.coach_clients
  ADD CONSTRAINT coach_clients_client_id_profile_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_coach_id_profile_fkey;
ALTER TABLE public.coach_clients
  ADD CONSTRAINT coach_clients_coach_id_profile_fkey
  FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Refresh the PostgREST schema cache so the new relationships resolve immediately.
NOTIFY pgrst, 'reload schema';
