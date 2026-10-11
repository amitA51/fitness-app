// ============================================================================
// T-132 — DEFECT #1 and #2 of the silent-write final sweep: AI conversations.
// ============================================================================
// The last member of the family. `syncConversation` opened with
// `if (!user) return;` and both delete paths had an `if (user)` with no `else`.
// In this codebase the enqueue IS `syncWithRetry`'s 4th argument
// (services/syncEngine), so those branches produced NO QUEUE ROW AT ALL — and
// `getCurrentUser()` answers null not only for a guest but for a real account
// holder whose token refresh just failed with a 401 (services/supabaseAuth
// models that path).
//
// End state before the fix: the chat was in IndexedDB, in no queue and in no
// ledger; the sign-out dialog (which counts queue depth + dead letters + ledger
// markers) reported nothing to lose, and `clearUserScopedLocalData` wiped
// `ai_conversations`. The delete half was worse — the local delete is
// unconditional, so `mergeAIConversationsFromCloud` re-added the conversation
// the user had deliberately deleted.
//
// Every "still enqueues" assertion below reads 1 where the pre-fix code
// produces 0. A rejecting (rather than null-resolving) auth read is covered for
// these same three functions in writePathAuthRejection.test.ts.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cloud must read as CONFIGURED: with no cloud there is nothing to sync to and
// nothing at risk, which is the one case where NOT queueing is correct.
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true, supabase: null }));
vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
  resolveCurrentUserOrNull: vi.fn(async () => null),
}));

vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(),
  deleteCloudWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
  deleteCloudWorkoutTemplate: vi.fn(),
  syncPersonalExercise: vi.fn(),
  deleteCloudPersonalExercise: vi.fn(),
  syncBodyWeight: vi.fn(),
  deleteCloudBodyWeight: vi.fn(),
  syncBodyMeasurement: vi.fn(),
  deleteCloudBodyMeasurement: vi.fn(),
  syncPersonalRecord: vi.fn(),
  deleteCloudPersonalRecord: vi.fn(),
  syncRecoveryLog: vi.fn(),
  deleteCloudRecoveryLog: vi.fn(),
  syncNutritionLog: vi.fn(),
  deleteCloudNutritionLog: vi.fn(),
  syncUserSetting: vi.fn(),
  syncAIConversation: vi.fn(),
  softDeleteCloudAIConversation: vi.fn(),
}));

const mockChat = vi.fn(async () => 'תשובה מהמאמן');
vi.mock('../ai/core', () => ({
  getAIProvider: () => ({ chat: mockChat }),
}));

import { clearConversation, createConversation, deleteConversation, sendMessage } from '../ai/chat';
import { STORES, clearDatabase, dbGetAll } from '../indexedDBCore';
import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  listDeadLetters,
  processQueue,
  retryAllDeadLetters,
} from '../offlineQueue';
import { getUnsyncedRecordCounts } from '../sessionDb';
import { getCurrentUser, resolveCurrentUserOrNull } from '../supabaseAuth';
import { softDeleteCloudAIConversation } from '../supabaseSync';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockResolveUser = resolveCurrentUserOrNull as ReturnType<typeof vi.fn>;
const mockSoftDelete = softDeleteCloudAIConversation as ReturnType<typeof vi.fn>;

interface QueuedConversation {
  id: string;
  title: string;
  messages: { id: string; role: string; content: string; timestamp: string }[];
}

/** jsdom's navigator.onLine is read-only, so redefine it per test. */
const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

/**
 * Read the queued row back the only way the queue exposes it: replay it with a
 * resolved account, which quarantines the ownerless entry into the dead-letter
 * store with its type and payload intact.
 */
const drainToDeadLetters = async () => {
  // `processQueue` stamps/validates ownership through `getCurrentUser` itself,
  // so both auth reads have to resolve for the replay to run at all.
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
  mockResolveUser.mockResolvedValue({ id: 'user-1' });
  await processQueue();
  return listDeadLetters();
};

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  mockChat.mockResolvedValue('תשובה מהמאמן');
  mockGetCurrentUser.mockResolvedValue(null);
  mockResolveUser.mockResolvedValue(null);
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

// ── DEFECT #1 · sendMessage → syncConversation ──────────────────────────────

describe('sendMessage when auth cannot answer', () => {
  it('still enqueues the conversation, so it is not outside every defence', async () => {
    await sendMessage('מה לעשות היום באימון?');

    expect(await getQueueDepth()).toBe(1);
  });

  it('has the queue row durable before it returns (the caller may be a closing tab)', async () => {
    // No waitFor: the assertion runs on the microtask right after the await, so
    // it fails if the enqueue is left floating as it was before the fix.
    await sendMessage('שאלה');

    expect(await getQueueDepth()).toBe(1);
  });

  it('queues the FULL turn, not an empty shell', async () => {
    await sendMessage('מה לעשות היום באימון?');

    const [held] = await drainToDeadLetters();
    expect(held?.type).toBe('ai:create');
    expect(held?.reason).toBe('ownerless');
    const payload = held?.payload as QueuedConversation;
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]?.content).toBe('מה לעשות היום באימון?');
    expect(payload.messages[1]?.content).toBe('תשובה מהמאמן');
    // id + timestamp are the union key in cloudMerge.unionMessagesById; a
    // message missing either is dropped on the way back down.
    for (const m of payload.messages) {
      expect(m.id).toBeTruthy();
      expect(m.timestamp).toBeTruthy();
    }
  });

  it('keeps the chat recoverable once an account claims it', async () => {
    await sendMessage('שאלה');

    // Replay refuses to ADOPT an ownerless entry (that is how one person's data
    // ends up in another's account on a shared device) and quarantines it
    // instead, which Settings surfaces for claiming. Quarantined is recoverable;
    // nothing-was-ever-queued is not.
    await drainToDeadLetters();
    expect(await getDeadLetterCount()).toBe(1);

    await retryAllDeadLetters();
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('does not mark the conversation in the unsynced ledger (chats have no clear-on-pull)', async () => {
    await sendMessage('שאלה');

    // A marker here would stick forever and turn the sign-out warning into
    // permanent noise — DEFECT #3's shape. Chats stay marker-less like PRs.
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });
});

// ── DEFECT #2 · clearConversation / deleteConversation ──────────────────────

describe('deleteConversation when auth cannot answer', () => {
  it('queues the cloud tombstone it used to skip entirely', async () => {
    const conversation = await createConversation('שיחה לבדיקה');
    await clearMutationQueue();

    await deleteConversation(conversation.id);

    // The local row is hard-deleted regardless of auth…
    expect(await dbGetAll(STORES.AI_CONVERSATIONS)).toHaveLength(0);
    // …so without this row the deletion existed nowhere but this device.
    expect(await getQueueDepth()).toBe(1);
    const [held] = await drainToDeadLetters();
    expect(held?.type).toBe('ai:delete');
    expect(held?.payload).toBe(conversation.id);
  });

  it('reaches the cloud as a SOFT delete, so a pull cannot resurrect the chat', async () => {
    const conversation = await createConversation('שיחה לבדיקה');
    await clearMutationQueue();
    await deleteConversation(conversation.id);

    await drainToDeadLetters();
    await retryAllDeadLetters();

    // softDeleteCloudAIConversation stamps deleted_at rather than removing the
    // row — the only representation that propagates a deletion to a device that
    // was offline when it happened.
    expect(mockSoftDelete).toHaveBeenCalledWith('user-1', conversation.id);
    expect(await getDeadLetterCount()).toBe(0);
  });
});

describe('clearConversation when auth cannot answer', () => {
  it('queues the tombstone for the current conversation', async () => {
    const conversation = await createConversation('שיחה לבדיקה');
    await clearMutationQueue();

    await clearConversation();

    expect(await dbGetAll(STORES.AI_CONVERSATIONS)).toHaveLength(0);
    expect(await getQueueDepth()).toBe(1);
    const [held] = await drainToDeadLetters();
    expect(held?.type).toBe('ai:delete');
    expect(held?.payload).toBe(conversation.id);
  });

  it('queues nothing when there is no conversation to delete', async () => {
    await clearConversation();

    expect(await getQueueDepth()).toBe(0);
  });
});
