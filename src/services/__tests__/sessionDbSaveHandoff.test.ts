// ============================================================================
// Finishing a workout must not wait on auth
// ============================================================================
// saveWorkoutSession used to await the auth lookup (which can run a token
// refresh against the server) BEFORE marking the session unsynced and before
// queueing it. On an overloaded server the save spinner turned for as long as
// that took, and meanwhile the workout was neither queued nor on the ledger.
// Now: local write + ledger first, the save resolves, and the cloud hand-off
// (auth capped at 2 s, then push or queue) runs behind it.
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
  getDeadLetterCount,
  getQueueDepth,
  processQueue,
} from '../offlineQueue';
import {
  getUnsyncedSessionIds,
  getWorkoutSession,
  saveWorkoutSession,
  settleSessionCloudHandoffs,
} from '../sessionDb';
import { syncWorkoutSession } from '../supabaseSync';

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

beforeEach(async () => {
  vi.clearAllMocks();
  auth.getCurrentUser.mockResolvedValue(null);
  stored.userId = null;
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  vi.useRealTimers();
  await settleSessionCloudHandoffs();
  await clearDatabase();
  await clearMutationQueue();
});

describe('saveWorkoutSession with a slow auth server', () => {
  it('resolves before auth answers, with the workout stored and on the ledger', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stored.userId = 'user-1';
    // Auth never answers — a token refresh stuck on an overloaded server.
    auth.getCurrentUser.mockImplementation(() => new Promise(() => {}));

    // Must resolve with NO time passing: nothing in the save waits on auth.
    await saveWorkoutSession(makeSession('s-fast'));

    expect(await getWorkoutSession('s-fast')).not.toBeNull();
    expect(await getUnsyncedSessionIds()).toEqual(['s-fast']);

    // Behind the save: the write-path cap (2 s) gives up on auth, and the queue
    // stamps the account stored on this device (its own 2 s cap).
    for (let i = 0; i < 20 && (await getQueueDepth()) === 0; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }
    await settleSessionCloudHandoffs();

    expect(await getQueueDepth()).toBe(1);
    expect(syncWorkoutSession).not.toHaveBeenCalled();
    // Still counted as unsynced until the cloud confirms it.
    expect(await getUnsyncedSessionIds()).toEqual(['s-fast']);
  });

  it('puts the session on the ledger before it asks auth anything', async () => {
    let ledgerWhenAuthAsked: string[] | null = null;
    auth.getCurrentUser.mockImplementation(async () => {
      ledgerWhenAuthAsked ??= await getUnsyncedSessionIds();
      return null;
    });

    await saveWorkoutSession(makeSession('s-order'));
    await settleSessionCloudHandoffs();

    expect(ledgerWhenAuthAsked).toEqual(['s-order']);
    expect(await getQueueDepth()).toBe(1);
  });

  it('does not queue a workout that a sign-out wiped before its hand-off ran', async () => {
    let releaseAuth = (_user: { id: string } | null) => {};
    auth.getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAuth = resolve;
        })
    );

    await saveWorkoutSession(makeSession('s-signed-out'));
    // Sign-out wipes local data while the hand-off is still asking auth.
    await clearDatabase();
    await clearMutationQueue();
    releaseAuth(null);
    await settleSessionCloudHandoffs();

    // Nothing of the previous account's workout comes back as a guest entry.
    expect(await getQueueDepth()).toBe(0);
  });

  it('keeps the workout owned by the account that saved it when that account signs out', async () => {
    // Saved while user-1 was signed in; the session then expires (credentials
    // dropped, local data kept) before the hand-off asks auth.
    stored.userId = 'user-1';
    let releaseAuth = (_user: { id: string } | null) => {};
    auth.getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAuth = resolve;
        })
    );
    await saveWorkoutSession(makeSession('s-expired'));
    stored.userId = null;
    releaseAuth(null);
    await settleSessionCloudHandoffs();
    expect(await getQueueDepth()).toBe(1);

    // user-1 signs back in: the workout replays into user-1 — not quarantined
    // as a guest's change that the next sign-up on this device would adopt.
    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect(syncWorkoutSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 's-expired' })
    );
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('never pushes the workout into an account that signed in after it was saved', async () => {
    stored.userId = 'user-1';
    let releaseAuth = (_user: { id: string } | null) => {};
    auth.getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAuth = resolve;
        })
    );
    await saveWorkoutSession(makeSession('s-switched'));
    // Account switch while the hand-off is still asking auth.
    stored.userId = 'user-2';
    releaseAuth({ id: 'user-2' });
    await settleSessionCloudHandoffs();

    auth.getCurrentUser.mockResolvedValue({ id: 'user-2' });
    await processQueue();

    expect(syncWorkoutSession).not.toHaveBeenCalledWith('user-2', expect.anything());
  });

  it('pushes directly when auth answers in time', async () => {
    auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });

    await saveWorkoutSession(makeSession('s-direct'));
    await settleSessionCloudHandoffs();

    await vi.waitFor(() => expect(syncWorkoutSession).toHaveBeenCalledOnce());
    expect(syncWorkoutSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 's-direct' })
    );
    await vi.waitFor(async () => expect(await getUnsyncedSessionIds()).toEqual([]));
  });
});
