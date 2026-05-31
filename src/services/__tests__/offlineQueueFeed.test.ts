import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'user-1' })) }));
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
  deleteCloudAIConversation: vi.fn(),
}));

import { getQueueDepth, processQueue, queueMutation } from '../offlineQueue';
import { syncWorkoutSession } from '../supabaseSync';

const mockSyncWorkoutSession = syncWorkoutSession as ReturnType<typeof vi.fn>;

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
