import { describe, expect, it, vi } from 'vitest';

// deleteConversation must propagate a CLOUD soft-delete (tombstone) — previously
// it only removed the local row, so a deleted AI conversation resurrected on the
// next pull and never reached the user's other devices.

const softDeleteSpy = vi.fn();
const dbDeleteSpy = vi.fn();

vi.mock('../../indexedDBCore', () => ({
  STORES: { AI_CONVERSATIONS: 'ai_conversations' },
  dbDelete: (...args: unknown[]) => dbDeleteSpy(...args),
  dbGet: vi.fn(),
  dbGetAll: vi.fn(async () => []),
  dbPut: vi.fn(),
}));

// The cloud leg is now gated on `isSupabaseConfigured()` (no cloud means nothing
// to sync to and nothing at risk), so it has to read as configured here.
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: () => true, supabase: null }));

vi.mock('../../supabaseAuth', () => {
  const getCurrentUser = vi.fn(async () => ({ id: 'user-1' }));
  return {
    getCurrentUser,
    resolveCurrentUserOrNull: () => getCurrentUser().catch(() => null),
  };
});

// Only reached when auth resolves NO user; with a user the direct push is used.
vi.mock('../../offlineQueue', () => ({ queueMutation: vi.fn() }));

vi.mock('../../supabaseSync', () => ({
  softDeleteCloudAIConversation: (...args: unknown[]) => softDeleteSpy(...args),
}));

// syncWithRetry is fire-and-forget in production; invoke its fn immediately so
// the test can assert the cloud call happened.
vi.mock('../../syncEngine', () => ({
  syncWithRetry: (fn: () => Promise<unknown>) => {
    void fn();
  },
}));

vi.mock('../core', () => ({ getAIProvider: vi.fn() }));

describe('createConversation — UUID ids', () => {
  it('mints a UUID conversation id (cloud ai_conversations.id is uuid — 22P02 on conv- ids)', async () => {
    const { createConversation } = await import('../chat');

    const conversation = await createConversation();

    expect(conversation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

describe('deleteConversation — cloud soft-delete propagation', () => {
  it('soft-deletes the conversation in the cloud after removing it locally', async () => {
    const { deleteConversation } = await import('../chat');

    await deleteConversation('conv-123');
    // allow the fire-and-forget cloud call to resolve
    await Promise.resolve();

    expect(dbDeleteSpy).toHaveBeenCalledWith('ai_conversations', 'conv-123');
    expect(softDeleteSpy).toHaveBeenCalledWith('user-1', 'conv-123');
  });
});
