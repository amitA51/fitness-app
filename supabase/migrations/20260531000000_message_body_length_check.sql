-- ============================================================
-- Enforce max message body length at the DB level
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_body_len'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_body_len CHECK (char_length(body) <= 5000);
  END IF;
END $$;
