-- ============================================================
-- COACH PLATFORM — coaching layer on top of the single-user app
-- Adds: profiles, coach relationships, invites, assignments,
-- messaging, groups, reminders, entitlements, push subscriptions.
-- Cross-user access is driven by is_coach_of()/is_client_of() and
-- gated on an ACTIVE coach_clients link (consent).
-- ============================================================

-- Helper functions reference tables created later in this migration
-- (forward references). Defer body validation so creation order is flexible;
-- names resolve correctly at query time.
SET check_function_bodies = off;

-- ------------------------------------------------------------
-- 1. RELATIONSHIP HELPERS (SECURITY DEFINER to avoid RLS recursion)
-- ------------------------------------------------------------
-- NB: coach_clients is created below; helpers are CREATE OR REPLACE and only
-- executed at query time, so defining them first is safe.

CREATE OR REPLACE FUNCTION public.is_coach_of(_client UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.client_id = _client
      AND cc.coach_id = auth.uid()
      AND cc.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_of(_coach UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.coach_id = _coach
      AND cc.client_id = auth.uid()
      AND cc.status = 'active'
  );
$$;

-- True when the current user is an active member of the given group.
CREATE OR REPLACE FUNCTION public.is_group_member(_group UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_group_members m
    WHERE m.group_id = _group
      AND m.client_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 2. PROFILES (1:1 with auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Own row, plus profiles of a linked coach or client (so each side can show names).
CREATE POLICY "profiles_select_visible" ON public.profiles
    FOR SELECT USING (
        id = (SELECT auth.uid())
        OR public.is_coach_of(id)
        OR public.is_client_of(id)
    );
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- Auto-create a profile when a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users.
INSERT INTO public.profiles (id, display_name)
SELECT id,
    COALESCE(
        raw_user_meta_data->>'display_name',
        raw_user_meta_data->>'name',
        split_part(email, '@', 1)
    )
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. COACH PROFILES (created when coach mode is enabled)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    bio TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_profiles_select_visible" ON public.coach_profiles
    FOR SELECT USING (id = (SELECT auth.uid()) OR public.is_client_of(id));
CREATE POLICY "coach_profiles_insert_own" ON public.coach_profiles
    FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "coach_profiles_update_own" ON public.coach_profiles
    FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "coach_profiles_delete_own" ON public.coach_profiles
    FOR DELETE USING (id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 4. COACH SUBSCRIPTIONS (design-only entitlements / seats)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_subscriptions (
    coach_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','solo','starter','pro','elite')),
    seat_limit INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_subscriptions_select_own" ON public.coach_subscriptions
    FOR SELECT USING (coach_id = (SELECT auth.uid()));
CREATE POLICY "coach_subscriptions_insert_own" ON public.coach_subscriptions
    FOR INSERT WITH CHECK (coach_id = (SELECT auth.uid()));
CREATE POLICY "coach_subscriptions_update_own" ON public.coach_subscriptions
    FOR UPDATE USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 5. COACH ↔ CLIENT LINK (the security linchpin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','ended')),
    consent_at TIMESTAMPTZ,
    scopes JSONB NOT NULL DEFAULT '{"read":true,"write":true}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (coach_id, client_id),
    CHECK (coach_id <> client_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_clients_lookup ON public.coach_clients(coach_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_clients_client ON public.coach_clients(client_id, status);

ALTER TABLE public.coach_clients ENABLE ROW LEVEL SECURITY;

-- Either side can see the link.
CREATE POLICY "coach_clients_select_party" ON public.coach_clients
    FOR SELECT USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()));
-- A client creates the link when accepting (consent). Coaches go through the
-- invite edge function (service role) which bypasses RLS.
CREATE POLICY "coach_clients_insert_client" ON public.coach_clients
    FOR INSERT WITH CHECK (client_id = (SELECT auth.uid()));
-- Both parties may change status (coach pause/end; client consent/end).
CREATE POLICY "coach_clients_update_party" ON public.coach_clients
    FOR UPDATE USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
    WITH CHECK (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()));
CREATE POLICY "coach_clients_delete_party" ON public.coach_clients
    FOR DELETE USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()));

-- Seat enforcement: a link may only become active within the coach's seat limit.
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    lim INTEGER;
    active_count INTEGER;
BEGIN
    IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
        SELECT seat_limit INTO lim FROM public.coach_subscriptions WHERE coach_id = NEW.coach_id;
        IF lim IS NULL THEN
            lim := 1; -- no subscription row => solo default
        END IF;
        SELECT COUNT(*) INTO active_count
        FROM public.coach_clients
        WHERE coach_id = NEW.coach_id AND status = 'active' AND id <> NEW.id;
        IF active_count >= lim THEN
            RAISE EXCEPTION 'seat_limit_reached' USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_seat_limit ON public.coach_clients;
CREATE TRIGGER trg_enforce_seat_limit
    BEFORE INSERT OR UPDATE ON public.coach_clients
    FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

-- ------------------------------------------------------------
-- 6. INVITES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_invites_code ON public.coach_invites(code);
CREATE INDEX IF NOT EXISTS idx_coach_invites_coach ON public.coach_invites(coach_id);

ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;

-- Only the coach manages their invites. Lookup-by-code at accept time goes
-- through the invite edge function (service role).
CREATE POLICY "coach_invites_all_own" ON public.coach_invites
    FOR ALL USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 7. GROUPS / SEGMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_groups_all_own" ON public.client_groups
    FOR ALL USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));
CREATE POLICY "client_groups_select_member" ON public.client_groups
    FOR SELECT USING (public.is_group_member(id));

CREATE TABLE IF NOT EXISTS public.client_group_members (
    group_id UUID NOT NULL REFERENCES public.client_groups(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, client_id)
);

ALTER TABLE public.client_group_members ENABLE ROW LEVEL SECURITY;

-- Coach who owns the group manages membership; members can read their own rows.
CREATE POLICY "client_group_members_coach_all" ON public.client_group_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.client_groups g
                WHERE g.id = group_id AND g.coach_id = (SELECT auth.uid()))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.client_groups g
                WHERE g.id = group_id AND g.coach_id = (SELECT auth.uid()))
    );
CREATE POLICY "client_group_members_select_self" ON public.client_group_members
    FOR SELECT USING (client_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 8. ASSIGNMENTS (programs / nutrition targets / notes / announcements)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.client_groups(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('program','nutrition_target','note','announcement')),
    title TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_id UUID,
    schedule JSONB,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (client_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_assignments_client ON public.assignments(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_group ON public.assignments(group_id, created_at DESC);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_all_own" ON public.assignments
    FOR ALL USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));
CREATE POLICY "assignments_select_target" ON public.assignments
    FOR SELECT USING (
        client_id = (SELECT auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_member(group_id))
    );

-- ------------------------------------------------------------
-- 9. MESSAGES (async)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(coach_id, client_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_party" ON public.messages
    FOR SELECT USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()));
CREATE POLICY "messages_insert_party" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
    );
-- Mark-as-read by the receiving party.
CREATE POLICY "messages_update_party" ON public.messages
    FOR UPDATE USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
    WITH CHECK (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 10. REMINDERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.client_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (client_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reminders_client ON public.reminders(client_id);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_all_own" ON public.reminders
    FOR ALL USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));
CREATE POLICY "reminders_select_target" ON public.reminders
    FOR SELECT USING (
        client_id = (SELECT auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_member(group_id))
    );

-- ------------------------------------------------------------
-- 11. PUSH SUBSCRIPTIONS (Web Push)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_all_own" ON public.push_subscriptions
    FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 12. AUDIT — attribute coach edits to a trainee's data
-- ------------------------------------------------------------
ALTER TABLE public.workout_sessions   ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.workout_templates  ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.personal_exercises ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.nutrition_logs     ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ------------------------------------------------------------
-- 13. CROSS-USER COACH ACCESS to trainee-owned data tables.
-- Full control (select/insert/update/delete) gated on an ACTIVE link.
-- user_settings and ai_conversations are intentionally excluded (private).
-- ------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'workout_templates','workout_sessions','personal_exercises',
        'body_weight','body_measurements','personal_records',
        'recovery_logs','nutrition_logs','water_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Skip tables that don't exist in this deployment (e.g. water_logs).
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP POLICY IF EXISTS "coach_select_%1$s" ON public.%1$I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "coach_insert_%1$s" ON public.%1$I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "coach_update_%1$s" ON public.%1$I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "coach_delete_%1$s" ON public.%1$I;', t);

        EXECUTE format(
            'CREATE POLICY "coach_select_%1$s" ON public.%1$I FOR SELECT USING (public.is_coach_of(user_id));', t);
        EXECUTE format(
            'CREATE POLICY "coach_insert_%1$s" ON public.%1$I FOR INSERT WITH CHECK (public.is_coach_of(user_id));', t);
        EXECUTE format(
            'CREATE POLICY "coach_update_%1$s" ON public.%1$I FOR UPDATE USING (public.is_coach_of(user_id)) WITH CHECK (public.is_coach_of(user_id));', t);
        EXECUTE format(
            'CREATE POLICY "coach_delete_%1$s" ON public.%1$I FOR DELETE USING (public.is_coach_of(user_id));', t);
    END LOOP;
END $$;

-- updated_at triggers for the new mutable tables.
-- Defensively (re)create the shared helper so this migration is self-contained.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_coach_profiles_updated_at ON public.coach_profiles;
CREATE TRIGGER update_coach_profiles_updated_at BEFORE UPDATE ON public.coach_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_coach_clients_updated_at ON public.coach_clients;
CREATE TRIGGER update_coach_clients_updated_at BEFORE UPDATE ON public.coach_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_assignments_updated_at ON public.assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_coach_subscriptions_updated_at ON public.coach_subscriptions;
CREATE TRIGGER update_coach_subscriptions_updated_at BEFORE UPDATE ON public.coach_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
