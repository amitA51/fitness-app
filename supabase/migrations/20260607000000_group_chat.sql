-- ============================================================
-- COACH PLATFORM — group chat.
-- A real chat thread per client_group: coach + members read and post.
-- Read-state: per-member last_read_at on client_group_members,
-- coach_last_read_at on client_groups (one coach per group).
-- Idempotent. RLS mirrors the conventions of 20260529000000_coach_platform.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.client_groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_thread
    ON public.group_messages(group_id, created_at);

-- Same body cap as 1:1 messages.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_messages_body_len'
  ) THEN
    ALTER TABLE public.group_messages
      ADD CONSTRAINT group_messages_body_len CHECK (char_length(body) <= 5000);
  END IF;
END $$;

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. RLS — participants are the owning coach and current members.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_messages'
      AND policyname = 'group_messages_select_participant'
  ) THEN
    CREATE POLICY "group_messages_select_participant" ON public.group_messages
      FOR SELECT USING (
        public.is_group_member(group_id)
        OR EXISTS (
          SELECT 1 FROM public.client_groups g
          WHERE g.id = group_id AND g.coach_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_messages'
      AND policyname = 'group_messages_insert_participant'
  ) THEN
    CREATE POLICY "group_messages_insert_participant" ON public.group_messages
      FOR INSERT WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND (
          public.is_group_member(group_id)
          OR EXISTS (
            SELECT 1 FROM public.client_groups g
            WHERE g.id = group_id AND g.coach_id = (SELECT auth.uid())
          )
        )
      );
  END IF;
END $$;
-- Chat is immutable: no UPDATE/DELETE policies on purpose.

-- ------------------------------------------------------------
-- 3. Read-state columns
-- ------------------------------------------------------------
ALTER TABLE public.client_group_members
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

ALTER TABLE public.client_groups
    ADD COLUMN IF NOT EXISTS coach_last_read_at TIMESTAMPTZ;

-- Members may update their own membership row (to stamp last_read_at).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_group_members'
      AND policyname = 'client_group_members_update_self'
  ) THEN
    CREATE POLICY "client_group_members_update_self" ON public.client_group_members
      FOR UPDATE USING (client_id = (SELECT auth.uid()))
      WITH CHECK (client_id = (SELECT auth.uid()));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Realtime
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'group_messages')
       AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
          AND tablename = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    END IF;
END $$;
