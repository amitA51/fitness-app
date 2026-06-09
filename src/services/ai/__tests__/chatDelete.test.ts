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

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}));

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
