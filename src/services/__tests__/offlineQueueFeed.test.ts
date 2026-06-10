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
  getQueueDepth,
  notifyRetriableFailures,
  processQueue,
  queueMutation,
} from '../offlineQueue';
import { getCurrentUser } from '../supabaseAuth';
import { syncWorkoutSession } from '../supabaseSync';

const mockSyncWorkoutSession = syncWorkoutSession as ReturnType<typeof vi.fn>;
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockShowToast = showToast as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
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

  it('drops entry on non-retriable failure (status 400)', async () => {
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 's1', duration: 60 });

    await processQueue();

    expect(await getQueueDepth()).toBe(0);
  });
});

describe('offlineQueue MAX_RETRIES exhaustion', () => {
  it('drops mutation after 5 retriable failures (MAX_RETRIES)', async () => {
    const err = new TypeError('failed to fetch');
    mockSyncWorkoutSession.mockRejectedValue(err);
    await queueMutation('session:update', { id: 's2', duration: 30 });

    // Each processQueue call increments retryCount by 1.
    // MAX_RETRIES = 5, so after 5 calls the mutation is dropped.
    for (let i = 0; i < 5; i++) {
      await processQueue();
    }

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

  it('processes legacy entries without a userId as the current user', async () => {
    // Legacy enqueue: nobody signed in at enqueue time → no userId stamp.
    mockGetCurrentUser.mockResolvedValue(null);
    await queueMutation('session:update', { id: 's-legacy', duration: 10 });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockResolvedValue(undefined);
    await processQueue();

    expect(mockSyncWorkoutSession).toHaveBeenCalledWith('user-1', {
      id: 's-legacy',
      duration: 10,
    });
    expect(await getQueueDepth()).toBe(0);
  });
});

describe('offlineQueue user-facing toasts', () => {
  it('pluralizes the dropped-changes toast when several mutations are dropped', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 'drop-1', duration: 1 });
    await queueMutation('session:update', { id: 'drop-2', duration: 2 });

    await processQueue();

    expect(mockShowToast).toHaveBeenCalledWith('2 שינויים לא נשמרו בענן', 'error');
  });

  it('uses singular copy when exactly one mutation is dropped', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockRejectedValue({ status: 400, message: 'Bad Request' });
    await queueMutation('session:update', { id: 'drop-solo', duration: 1 });

    await processQueue();

    expect(mockShowToast).toHaveBeenCalledWith('שינוי אחד לא נשמר בענן', 'error');
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
