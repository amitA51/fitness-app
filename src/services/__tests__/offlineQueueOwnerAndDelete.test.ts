// ============================================================================
// Offline queue — who owns a queued change, and a delete that overtakes an edit
// ============================================================================
// Two ways a workout the user DELETED came back while the server was overloaded:
//   1. `getCurrentUser()` answers null for about a minute after a failed token
//      refresh, while the session is still stored. The queue stamped such a
//      change GUEST_OWNER, replay quarantined it as ownerless, and a quarantined
//      delete tombstone never reached the cloud — the next pull restored the row.
//   2. Dedup keys include the type, so `session:update::S` and
//      `session:delete::S` sat side by side. An update parked by outage backoff
//      replayed AFTER the delete (which matched 0 rows) and inserted S live.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'user-1' })),
}));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: () => auth.getCurrentUser() }));

const stored = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: null,
  readStoredAuthSession: () => (stored.userId ? { user: { id: stored.userId } } : null),
}));

vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));
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

import {
  clearMutationQueue,
  discardWritesObsoletedBy,
  getQueueDepth,
  getQueuedRecordIds,
  listDeadLetters,
  processQueue,
  queueMutation,
} from '../offlineQueue';
import {
  deleteCloudNutritionLog,
  deleteCloudWorkoutSession,
  syncNutritionLog,
  syncWorkoutSession,
} from '../supabaseSync';

const mockSync = vi.mocked(syncWorkoutSession);
const mockDelete = vi.mocked(deleteCloudWorkoutSession);

/** A promise plus the function that resolves it — for "wait until X was called". */
const signal = () => {
  let fire = () => {};
  const fired = new Promise<void>((resolve) => {
    fire = resolve;
  });
  return { fire, fired };
};

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  stored.userId = null;
  mockSync.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  await clearMutationQueue();
});

afterEach(async () => {
  vi.useRealTimers();
  await clearMutationQueue();
});

describe('queueMutation names the owner from the stored session when auth says "no user"', () => {
  it('stamps the stored account during the refresh cooldown, so a delete replays', async () => {
    // Signed in here; auth answers null (the cooldown after a failed refresh).
    stored.userId = 'user-1';
    auth.getCurrentUser.mockResolvedValue(null);
    await queueMutation('session:delete', 's-cooldown');

    // Auth recovers: the tombstone replays into user-1 — not into quarantine.
    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(mockDelete).toHaveBeenCalledWith('user-1', 's-cooldown');
    expect(await listDeadLetters()).toEqual([]);
  });

  it('stamps the stored account when the auth lookup rejects', async () => {
    stored.userId = 'user-1';
    auth.getCurrentUser.mockRejectedValue(new Error('NavigatorLockAcquireTimeoutError'));
    await queueMutation('session:update', { id: 's-reject', duration: 10 });

    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(mockSync).toHaveBeenCalledWith('user-1', { id: 's-reject', duration: 10 });
    expect(await listDeadLetters()).toEqual([]);
  });

  it('still files a change as a guest one when nobody is signed in on this device', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await queueMutation('session:update', { id: 's-guest', duration: 10 });

    auth.getCurrentUser.mockResolvedValue({ id: 'user-2' });
    await processQueue();

    // Never adopted by whoever signs in next: quarantined for an explicit claim.
    expect(mockSync).not.toHaveBeenCalled();
    const [held] = await listDeadLetters();
    expect(held).toMatchObject({ reason: 'ownerless', userId: '__guest__' });
  });

  it('keeps an explicit owner over anything auth or storage say', async () => {
    stored.userId = 'user-2';
    await queueMutation('session:update', { id: 's-own', duration: 10 }, { ownerId: 'user-1' });

    auth.getCurrentUser.mockResolvedValue({ id: 'user-2' });
    await processQueue();

    // Owned by user-1, so it can never replay into user-2's account.
    expect(mockSync).not.toHaveBeenCalled();
  });
});

describe('a queued delete supersedes the pending writes of the same record', () => {
  it('removes a pending update when the delete is queued, so it cannot resurrect the row', async () => {
    // The update fails through an outage and is parked by backoff.
    mockSync.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await queueMutation('session:update', { id: 's-1', duration: 60 });
    await processQueue();
    expect(await getQueueDepth()).toBe(1);

    // The user deletes the workout before the update got through.
    await queueMutation('session:delete', 's-1');

    expect(await getQueueDepth()).toBe(1);
    mockSync.mockClear();
    await processQueue();
    expect(mockDelete).toHaveBeenCalledWith('user-1', 's-1');
    // The update never runs after the delete, so the cloud row is not re-inserted.
    expect(mockSync).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(0);
  });

  it('removes both a create and an update, for every entity that follows the naming', async () => {
    await queueMutation('nutrition:create', { id: 'n-1', calories: 100 });
    await queueMutation('nutrition:update', { id: 'n-1', calories: 200 });
    await queueMutation('nutrition:update', { id: 'n-other', calories: 300 });

    await queueMutation('nutrition:delete', 'n-1');

    // n-1's create and update are gone; the unrelated record and the delete stay.
    expect(await getQueueDepth()).toBe(2);
    await processQueue();
    expect(vi.mocked(deleteCloudNutritionLog)).toHaveBeenCalledWith('user-1', 'n-1');
    expect(vi.mocked(syncNutritionLog)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(syncNutritionLog)).toHaveBeenCalledWith('user-1', {
      id: 'n-other',
      calories: 300,
    });
  });

  it('leaves the writes of other entities with the same id alone', async () => {
    await queueMutation('template:update', { id: 'same-id', name: 'א' });
    await queueMutation('session:delete', 'same-id');

    expect(await getQueueDepth()).toBe(2);
  });

  it('does not replay an update that a delete removed while the pass was running', async () => {
    // The pass starts with [a, s]; while `a` is in flight the user deletes `s`.
    await queueMutation('session:update', { id: 'a', duration: 1 });
    await queueMutation('session:update', { id: 's', duration: 2 });
    const started = signal();
    let release = () => {};
    mockSync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
          started.fire();
        })
    );

    const pass = processQueue();
    await started.fired;
    await queueMutation('session:delete', 's');
    release();
    await pass;

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).not.toHaveBeenCalledWith('user-1', { id: 's', duration: 2 });

    // The next pass sends the tombstone.
    await processQueue();
    expect(mockDelete).toHaveBeenCalledWith('user-1', 's');
    expect(await getQueueDepth()).toBe(0);
  });
});

describe('discardWritesObsoletedBy (a delete pushed directly, never queued)', () => {
  it("drops the record's pending create/update and nothing else", async () => {
    await queueMutation('session:update', { id: 's-direct', duration: 60 });
    await queueMutation('session:update', { id: 's-keep', duration: 60 });

    await expect(discardWritesObsoletedBy('session:delete', 's-direct')).resolves.toBe(1);

    expect(await getQueueDepth()).toBe(1);
    expect([...(await getQueuedRecordIds('session'))]).toEqual(['s-keep']);
  });

  it('is a no-op for anything but a delete', async () => {
    await queueMutation('session:update', { id: 's-x', duration: 60 });

    await expect(
      discardWritesObsoletedBy('session:update', { id: 's-x', duration: 1 })
    ).resolves.toBe(0);
    expect(await getQueueDepth()).toBe(1);
  });
});

describe('getQueuedRecordIds', () => {
  it('lists the records with a queued or held write, per entity', async () => {
    // Held: an ownerless (guest) write is quarantined by the next pass.
    auth.getCurrentUser.mockResolvedValueOnce(null);
    await queueMutation('session:update', { id: 's-held', duration: 1 });
    await processQueue();
    expect(await listDeadLetters()).toHaveLength(1);
    await queueMutation('session:update', { id: 's-queued', duration: 1 });
    await queueMutation('nutrition:update', { id: 'n-queued', calories: 1 });

    const ids = await getQueuedRecordIds('session');
    expect([...ids].sort()).toEqual(['s-held', 's-queued']);
  });
});
