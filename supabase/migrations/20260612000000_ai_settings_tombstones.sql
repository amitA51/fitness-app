-- Extend tombstone / soft-delete support to ai_conversations and user_settings.
-- Companion to 20260531140000_tombstones.sql, which covered the other eight
-- syncable tables but omitted these two. Idempotent (ADD COLUMN IF NOT EXISTS).
--
-- Why: an AI-conversation deleted on one device had no deleted_at column to
-- carry a tombstone, so the deletion never propagated and the conversation
-- resurrected on the next pull. With the column present, the single-conversation
-- delete path soft-deletes and the already-tombstone-aware merge
-- (mergeAIConversationsFromCloud / mergeGenericRecords) removes it on other
-- devices. user_settings gains the column for parity / future-proofing.

ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes: only index rows that ARE deleted (sparse), useful for pull queries.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_deleted ON ai_conversations (user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_deleted ON user_settings (user_id, deleted_at) WHERE deleted_at IS NOT NULL;
