// ============================================================================
// saveImportedWorkoutSessions — a Strava history lands as one local write and
// one cloud upsert per 50 workouts, with the same safety net as a single save.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true }));
vi.mock('../supabaseAuth', () => {
  const getCurrentUser = vi.fn(async () => null);
  return {
    getCurrentUser,
    resolveCurrentUserOrNull: () => getCurrentUser().catch(() => null),
  };
});
vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));

// offlineQueue's replay destructures the whole cloud-sync surface, so the mock
// has to cover it even though only syncWorkoutSession is asserted on.
vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(),
  syncWorkoutSessionsBatch: vi.fn(),
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

import type { WorkoutSession } from '../../types';
import { clearDatabase } from '../indexedDBCore';
import { clearMutationQueue, getQueueDepth } from '../offlineQueue';
import {
  getUnsyncedSessionCount,
  getWorkoutSession,
  saveImportedWorkoutSessions,
} from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';
import { syncWorkoutSessionsBatch } from '../supabaseSync';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockBatch = syncWorkoutSessionsBatch as ReturnType<typeof vi.fn>;

const makeSession = (n: number): WorkoutSession => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  date: '2026-10-20',
  startTime: new Date(Date.UTC(2026, 9, 20, 6, 0) - n * 60_000).toISOString(),
  endTime: null,
  exercises: [],
  duration: 1800,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: '2026-10-20T06:00:00.000Z',
  updatedAt: '2026-10-20T06:00:00.000Z',
});

const many = (count: number) => Array.from({ length: count }, (_, i) => makeSession(i + 1));

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
  mockBatch.mockResolvedValue(undefined);
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  await clearDatabase();
  await clearMutationQueue();
});

describe('saveImportedWorkoutSessions', () => {
  it('writes every session locally and pushes them 50 at a time', async () => {
    await saveImportedWorkoutSessions(many(120));

    expect(await getWorkoutSession(makeSession(120).id)).not.toBeNull();
    expect(mockBatch).toHaveBeenCalledTimes(3);
    expect(mockBatch.mock.calls.map((c) => (c[1] as WorkoutSession[]).length)).toEqual([
      50, 50, 20,
    ]);
    expect(mockBatch.mock.calls[0]?.[0]).toBe('user-1');
    expect(await getUnsyncedSessionCount()).toBe(0);
    expect(await getQueueDepth()).toBe(0);
  });

  it('queues the sessions of a batch the cloud refused, and keeps them counted', async () => {
    mockBatch.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('503'));

    await saveImportedWorkoutSessions(many(70));

    expect(await getQueueDepth()).toBe(20);
    expect(await getUnsyncedSessionCount()).toBe(20);
  });

  it('queues everything when no account answers', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await saveImportedWorkoutSessions(many(3));

    expect(mockBatch).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(3);
    expect(await getWorkoutSession(makeSession(2).id)).not.toBeNull();
  });

  it('does nothing for an empty import', async () => {
    await saveImportedWorkoutSessions([]);
    expect(mockBatch).not.toHaveBeenCalled();
  });
});
