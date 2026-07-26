import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'user-1' })) }));
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

import { showToast } from '../../components/ui/GlobalToast';
import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  listDeadLetters,
  notifyRetriableFailures,
  processQueue,
  queueMutation,
  retryDeadLetter,
} from '../offlineQueue';
import { getCurrentUser } from '../supabaseAuth';
import { syncWorkoutSession } from '../supabaseSync';

const mockSyncWorkoutSession = syncWorkoutSession as ReturnType<typeof vi.fn>;
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockShowToast = showToast as ReturnType<typeof vi.fn>;

/** jsdom's navigator.onLine is read-only, so redefine it per test. */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  // Dead-letter entries now persist, so each test needs a clean slate.
  await clearMutationQueue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('offlineQueue processQueue replay', () => {
  it('calls syncWorkoutSession and empties queue on success', async () => {
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    await queueMutation('session:update', { id: 's1', duration: 60 });
    expect(await getQueueDepth()).toBe(1);

    await processQueue();

    expect(mockSyncWorkoutSession).toHaveBeenCalledOnce();
    expect(mockSyncWorkoutSession).toHaveBeenCalledWith('user-1', { id: 's1', duration: 60 });
    expect(await getQueueDepth()).toBe(0);
  });

  it('keeps entry queued with incremented retryCount on retriable failure', async () => {
    const err = new TypeError('failed to fetch');
    mockSyncWorkoutSession.mockRejectedValue(err);
    await queueMutation('session:update', { id: 's1', duration: 60 });

    await processQueue();

    expect(await getQueueDepth()).toBe(1);
  });

  it('moves entry to the dead-letter store on non-retriable failure (status 400)', async () => {
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 's1', duration: 60 });

    await processQueue();

    // Out of the active queue, but the payload is retained for recovery.
    expect(await getQueueDepth()).toBe(0);
    expect(await getDeadLetterCount()).toBe(1);
    const held = await listDeadLetters();
    expect(held[0]).toMatchObject({
      type: 'session:update',
      reason: 'permanent_error',
      payload: { id: 's1', duration: 60 },
    });
  });
});

describe('offlineQueue offline guard', () => {
  it('does not process or charge a retry while the browser is offline', async () => {
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    await queueMutation('session:update', { id: 's-offline', duration: 60 });

    setOnline(false);
    const result = await processQueue();
    setOnline(true);

    // Nothing attempted, nothing consumed: the entry survives an offline start.
    expect(result).toEqual({ success: 0, failed: 0 });
    expect(mockSyncWorkoutSession).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(1);
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('survives five consecutive offline app starts', async () => {
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    await queueMutation('session:update', { id: 's-five', duration: 60 });

    setOnline(false);
    for (let i = 0; i < 5; i++) await processQueue();
    setOnline(true);

    // This is the regression: previously each offline start burned one of
    // MAX_RETRIES and the fifth deleted the workout outright.
    expect(await getQueueDepth()).toBe(1);
    expect(await getDeadLetterCount()).toBe(0);
  });
});

describe('offlineQueue backoff', () => {
  it('skips an entry that is still inside its backoff window', async () => {
    mockSyncWorkoutSession.mockRejectedValue(new TypeError('failed to fetch'));
    await queueMutation('session:update', { id: 's-backoff', duration: 60 });

    await processQueue();
    expect(mockSyncWorkoutSession).toHaveBeenCalledTimes(1);

    // Immediately re-running must NOT attempt again — the first failure set
    // nextAttemptAt a few seconds out.
    await processQueue();
    expect(mockSyncWorkoutSession).toHaveBeenCalledTimes(1);
    expect(await getQueueDepth()).toBe(1);
  });
});

describe('offlineQueue MAX_RETRIES exhaustion', () => {
  it('holds the mutation for recovery after 5 retriable failures instead of deleting it', async () => {
    const err = new TypeError('failed to fetch');
    mockSyncWorkoutSession.mockRejectedValue(err);
    await queueMutation('session:update', { id: 's2', duration: 30 });

    // Each pass increments retryCount once, but a failure also arms an
    // exponential backoff window — so real time has to move forward between
    // attempts. The longest window in the schedule is 30 minutes.
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(start + i * 3_600_000);
      await processQueue();
    }
    vi.setSystemTime(start);

    expect(await getQueueDepth()).toBe(0);
    // The payload is preserved rather than destroyed.
    expect(await getDeadLetterCount()).toBe(1);
    const held = await listDeadLetters();
    expect(held[0]).toMatchObject({ reason: 'max_retries', payload: { id: 's2', duration: 30 } });
  });

  it('re-queues a held mutation and syncs it once the cause is fixed', async () => {
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 's-recover', duration: 45 });
    await processQueue();
    expect(await getDeadLetterCount()).toBe(1);

    const [held] = await listDeadLetters();
    expect(held).toBeDefined();
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    const requeued = await retryDeadLetter(held?.id ?? '');

    expect(requeued).toBe(true);
    expect(mockSyncWorkoutSession).toHaveBeenLastCalledWith('user-1', {
      id: 's-recover',
      duration: 45,
    });
    expect(await getDeadLetterCount()).toBe(0);
    expect(await getQueueDepth()).toBe(0);
  });
});

describe('offlineQueue cross-account guard', () => {
  it('stamps entries with the enqueueing user and drops them for a different user', async () => {
    // Enqueue while user-1 is signed in.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await queueMutation('session:update', { id: 's-leak', duration: 10 });
    expect(await getQueueDepth()).toBe(1);

    // Switch accounts on the same device, then process.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-2' });
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    const result = await processQueue();

    // The foreign entry must be dropped, never synced into user-2's account.
    expect(mockSyncWorkoutSession).not.toHaveBeenCalled();
    expect(result).toEqual({ success: 0, failed: 0 });
    expect(await getQueueDepth()).toBe(0);

    // Restore the default for subsequent tests.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('quarantines an entry with no owner instead of adopting it', async () => {
    // Enqueued with nobody signed in: guest mode, or an auth lookup that failed.
    mockGetCurrentUser.mockResolvedValue(null);
    await queueMutation('session:update', { id: 's-legacy', duration: 10 });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    await processQueue();

    // The old behaviour wrote this into whoever was signed in — on a shared
    // device that is one person's data landing in another person's account.
    expect(mockSyncWorkoutSession).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(0);

    const held = await listDeadLetters();
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ reason: 'ownerless', payload: { id: 's-legacy' } });
  });

  it('claims a quarantined change for the current account only when retried', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await queueMutation('session:update', { id: 's-claim', duration: 20 });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.reason).toBe('ownerless');

    // Retry is the user's explicit act of claiming it.
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    const claimed = await retryDeadLetter(held?.id ?? '');

    expect(claimed).toBe(true);
    expect(mockSyncWorkoutSession).toHaveBeenCalledWith('user-1', {
      id: 's-claim',
      duration: 20,
    });
    expect(await getDeadLetterCount()).toBe(0);
    expect(await getQueueDepth()).toBe(0);
  });

  it('refuses to claim a quarantined change while signed out', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await queueMutation('session:update', { id: 's-noclaim', duration: 5 });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();

    mockGetCurrentUser.mockResolvedValue(null);
    const claimed = await retryDeadLetter(held?.id ?? '');

    expect(claimed).toBe(false);
    // Still held, not lost.
    expect(await getDeadLetterCount()).toBe(1);
  });
});

describe('offlineQueue user-facing toasts', () => {
  it('pluralizes the dropped-changes toast when several mutations are dropped', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 'drop-1', duration: 1 });
    await queueMutation('session:update', { id: 'drop-2', duration: 2 });

    await processQueue();

    expect(mockShowToast).toHaveBeenCalledWith(
      '2 שינויים לא נשמרו בענן. הם נשמרו במכשיר וניתן לנסות שוב מההגדרות',
      'error'
    );
  });

  it('uses singular copy when exactly one mutation is dropped', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 'drop-solo', duration: 1 });

    await processQueue();

    expect(mockShowToast).toHaveBeenCalledWith(
      'שינוי אחד לא נשמר בענן. הוא נשמר במכשיר וניתן לנסות שוב מההגדרות',
      'error'
    );
  });

  it('debounces the retriable-failure toast to once per episode, re-armed on a clean pass', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    // A clean pass over the (empty) queue ends any prior episode.
    await processQueue();
    mockShowToast.mockClear();

    await notifyRetriableFailures();
    await notifyRetriableFailures();
    expect(mockShowToast).toHaveBeenCalledTimes(1);

    // Another clean pass (queue drained) re-arms the notice.
    await processQueue();
    await notifyRetriableFailures();
    expect(mockShowToast).toHaveBeenCalledTimes(2);
  });
});
