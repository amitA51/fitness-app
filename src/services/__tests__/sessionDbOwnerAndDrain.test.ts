// ============================================================================
// sessionDb — owners on every queued workout write, and a ledger that drains
// ============================================================================
// While the database was overloaded:
//   - a workout DELETED during the auth refresh cooldown was queued as a guest's
//     change, quarantined on replay, and the next pull brought it back;
//   - a direct push that failed after a sign-out fell back to the queue as a
//     guest's change, for the next sign-up on the device to adopt;
//   - an import asked auth once per queued session, and kept pushing batch after
//     batch at a server that had already refused one;
//   - and nothing drained the unsynced ledger unless the user tapped "sync now".
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(async (): Promise<{ id: string } | null> => null),
}));
vi.mock('../supabaseAuth', () => ({
  getCurrentUser: () => auth.getCurrentUser(),
  resolveCurrentUserOrNull: () => auth.getCurrentUser().catch(() => null),
}));

const stored = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: null,
  readStoredAuthSession: () => (stored.userId ? { user: { id: stored.userId } } : null),
}));
vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));
// offlineQueue's replay destructures the whole cloud-sync surface.
vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(async () => undefined),
  syncWorkoutSessionsBatch: vi.fn(async () => undefined),
  deleteCloudWorkoutSession: vi.fn(async () => undefined),
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

import type { WorkoutSession } from '../../types';
import { clearDatabase } from '../indexedDBCore';
import {
  clearMutationQueue,
  drainUnsyncedLedger,
  getQueueDepth,
  listDeadLetters,
  processQueue,
  queueMutation,
} from '../offlineQueue';
import {
  deleteWorkoutSession,
  drainUnsyncedSessions,
  flushUnsyncedSessions,
  getUnsyncedSessionIds,
  markRecordUnsynced,
  reAddWorkoutSession,
  saveImportedWorkoutSessions,
  saveWorkoutSession,
  settleSessionCloudHandoffs,
} from '../sessionDb';
import {
  deleteCloudWorkoutSession,
  syncWorkoutSession,
  syncWorkoutSessionsBatch,
} from '../supabaseSync';
import { LAST_SIGNED_IN_USER_ID_KEY } from '../userScopedLocalData';

const mockSync = vi.mocked(syncWorkoutSession);
const mockBatch = vi.mocked(syncWorkoutSessionsBatch);
const mockDelete = vi.mocked(deleteCloudWorkoutSession);

const makeSession = (id: string): WorkoutSession => ({
  id,
  date: '2026-10-22',
  startTime: '2026-10-22T08:00:00.000Z',
  endTime: '2026-10-22T09:00:00.000Z',
  exercises: [],
  duration: 3600,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 1000,
  caloriesBurned: null,
  createdAt: '2026-10-22T08:00:00.000Z',
  updatedAt: '2026-10-22T09:00:00.000Z',
});

const many = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    makeSession(`00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
  );

/** A workout that is on this device and on the ledger, in no queue. */
const ledgeredOnly = async (id: string) => {
  await reAddWorkoutSession(makeSession(id));
  await markRecordUnsynced('workout_sessions', id);
};

/** Signed in as user-1 here, with the local data marked as user-1's. */
const signedInAs = (userId: string) => {
  stored.userId = userId;
  localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, userId);
  auth.getCurrentUser.mockResolvedValue({ id: userId });
};

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  auth.getCurrentUser.mockResolvedValue(null);
  stored.userId = null;
  localStorage.removeItem(LAST_SIGNED_IN_USER_ID_KEY);
  mockSync.mockResolvedValue(undefined);
  mockBatch.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  vi.useRealTimers();
  await settleSessionCloudHandoffs();
  await clearDatabase();
  await clearMutationQueue();
  localStorage.removeItem(LAST_SIGNED_IN_USER_ID_KEY);
});

describe('deleteWorkoutSession during the auth refresh cooldown', () => {
  it('queues the tombstone for the signed-in account, so it replays instead of being quarantined', async () => {
    stored.userId = 'user-1';
    await reAddWorkoutSession(makeSession('s-del'));
    // getCurrentUser() answers null for a minute after a failed refresh.
    auth.getCurrentUser.mockResolvedValue(null);

    await deleteWorkoutSession('s-del');
    expect(await getQueueDepth()).toBe(1);

    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(mockDelete).toHaveBeenCalledWith('user-1', 's-del');
    expect(await listDeadLetters()).toEqual([]);
  });
});

describe('a direct push that falls back to the queue after a sign-out', () => {
  it('keeps the workout owned by the account that saved it', async () => {
    signedInAs('user-1');
    // The push is refused while the user signs out underneath it.
    mockSync.mockImplementationOnce(async () => {
      stored.userId = null;
      auth.getCurrentUser.mockResolvedValue(null);
      throw { status: 400, message: 'Bad Request' };
    });

    await saveWorkoutSession(makeSession('s-late'));
    await settleSessionCloudHandoffs();
    await vi.waitFor(async () => expect(await getQueueDepth()).toBe(1));

    // user-1 is back: the workout replays into user-1, not quarantined as a
    // guest's change that the next sign-up on this device would adopt.
    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect(mockSync).toHaveBeenLastCalledWith('user-1', expect.objectContaining({ id: 's-late' }));
    expect(await listDeadLetters()).toEqual([]);
  });
});

describe('flushUnsyncedSessions', () => {
  it('stamps the stored account on what it queues when auth names nobody', async () => {
    stored.userId = 'user-1';
    await ledgeredOnly('s-flush');

    expect(await flushUnsyncedSessions()).toEqual({ pushed: 0, queued: 1 });

    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect(mockSync).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 's-flush' }));
    expect(await listDeadLetters()).toEqual([]);
  });

  it('queues the rest instead of pushing each one after the first push fails', async () => {
    signedInAs('user-1');
    for (const id of ['f-1', 'f-2', 'f-3']) await ledgeredOnly(id);
    mockSync.mockRejectedValue({ status: 400, message: 'Bad Request' });

    expect(await flushUnsyncedSessions()).toEqual({ pushed: 0, queued: 3 });
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(await getQueueDepth()).toBe(3);
  });

  it('runs one flush at a time', async () => {
    signedInAs('user-1');
    await ledgeredOnly('s-once');

    const [a, b] = await Promise.all([flushUnsyncedSessions(), flushUnsyncedSessions()]);

    expect(a).toEqual({ pushed: 1, queued: 0 });
    expect(b).toBe(a);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('leaves a workout whose save hand-off is still running to that hand-off', async () => {
    signedInAs('user-1');
    let answerAuth = (_user: { id: string } | null) => {};
    auth.getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerAuth = resolve;
        })
    );
    await saveWorkoutSession(makeSession('s-busy'));

    expect(await flushUnsyncedSessions()).toEqual({ pushed: 0, queued: 0 });
    expect(mockSync).not.toHaveBeenCalled();

    answerAuth({ id: 'user-1' });
    await settleSessionCloudHandoffs();
    await vi.waitFor(() => expect(mockSync).toHaveBeenCalledOnce());
  });
});

describe('drainUnsyncedSessions — the flush the app runs on its own', () => {
  it('pushes a ledgered workout that is in no queue', async () => {
    signedInAs('user-1');
    await ledgeredOnly('s-stranded');

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 1, queued: 0 });
    expect(mockSync).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 's-stranded' }));
    expect(await getUnsyncedSessionIds()).toEqual([]);
  });

  it('runs through drainUnsyncedLedger, the start-up / online / after-pull trigger', async () => {
    signedInAs('user-1');
    await ledgeredOnly('s-trigger');

    await drainUnsyncedLedger();

    expect(mockSync).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 's-trigger' }));
  });

  it('leaves a workout that is already queued to the queue, backoff and all', async () => {
    signedInAs('user-1');
    await ledgeredOnly('s-queued');
    await queueMutation('session:update', { ...makeSession('s-queued') }, { ownerId: 'user-1' });

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 0, queued: 0 });
    expect(mockSync).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(1);
  });

  it('leaves a held workout to the user', async () => {
    signedInAs('user-1');
    await ledgeredOnly('s-held');
    // A guest's change, quarantined by the queue: only the user may claim it.
    await queueMutation('session:update', { ...makeSession('s-held') }, { ownerId: '__guest__' });
    await processQueue();
    expect(await listDeadLetters()).toHaveLength(1);

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 0, queued: 0 });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does nothing while the local data belongs to another account', async () => {
    // Signed in as user-2, but the wipe of user-1's rows has not run yet.
    signedInAs('user-2');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-1');
    await ledgeredOnly('s-user-1');

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 0, queued: 0 });
    expect(mockSync).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(0);
  });

  it('does nothing for a guest', async () => {
    await ledgeredOnly('s-guest');

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 0, queued: 0 });
    expect(await getQueueDepth()).toBe(0);
  });

  it('queues for the stored account when auth cannot name the user', async () => {
    signedInAs('user-1');
    auth.getCurrentUser.mockResolvedValue(null); // the refresh cooldown
    await ledgeredOnly('s-cooldown');

    expect(await drainUnsyncedSessions()).toEqual({ pushed: 0, queued: 1 });

    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect(mockSync).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 's-cooldown' }));
  });
});

describe('saveImportedWorkoutSessions', () => {
  it('asks auth once for the whole import, and stamps the stored account', async () => {
    stored.userId = 'user-1';

    await saveImportedWorkoutSessions(many(3));

    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(await getQueueDepth()).toBe(3);
    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect(mockSync).toHaveBeenCalledTimes(3);
    expect(await listDeadLetters()).toEqual([]);
  });

  it('stops pushing after the first refused batch and queues the rest', async () => {
    signedInAs('user-1');
    mockBatch.mockRejectedValue({ status: 503 });

    await saveImportedWorkoutSessions(many(120));

    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(await getQueueDepth()).toBe(120);
    expect((await getUnsyncedSessionIds()).length).toBe(120);
  });
});
