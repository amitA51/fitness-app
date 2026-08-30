// ============================================================================
// T-111 — a workout written while getCurrentUser() returns null must still be
// recoverable.
// ============================================================================
// THE HOLE THIS PINS. Every defence the app has against losing a workout keys
// off the OFFLINE QUEUE: the retry engine, the dead-letter store, the owner
// stamping, the sign-out guard. The session enqueue used to sit inside an
// `if (user)` block in sessionDb.saveWorkoutSession, and `getCurrentUser()`
// returns null not only for a guest but for a signed-in user whose token refresh
// just failed with a 401 (services/supabaseAuth.ts models that path). For that
// user the session was written to IndexedDB and NOTHING was enqueued — sign-in
// only pulls, so nothing ever pushed it, and the sign-out warning counted a
// queue that was empty and waved the user through the local wipe.
//
// The first two tests below fail on the pre-fix code with a real assertion
// message (queue depth 0, dead-letter count 0); they are the regression guard.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cloud must read as CONFIGURED: with no cloud there is nothing to sync to and
// nothing at risk, which is the one case where not queueing is correct.
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true }));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));

// offlineQueue's replay destructures the whole cloud-sync surface, so the mock
// has to cover it even though only syncWorkoutSession is asserted on.
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

import type { WorkoutSession } from '../../types';
import { clearDatabase } from '../indexedDBCore';
import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  listDeadLetters,
  processQueue,
} from '../offlineQueue';
import {
  deleteWorkoutSession,
  flushUnsyncedSessions,
  getUnsyncedSessionCount,
  mergeWorkoutSessionsFromCloud,
  saveWorkoutSession,
} from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';
import { syncWorkoutSession } from '../supabaseSync';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockSyncWorkoutSession = syncWorkoutSession as ReturnType<typeof vi.fn>;

const makeSession = (id: string, overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  date: '2026-08-30',
  startTime: new Date('2026-08-30T10:00:00Z').toISOString(),
  endTime: new Date('2026-08-30T11:00:00Z').toISOString(),
  exercises: [],
  duration: 3600,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 4200,
  caloriesBurned: null,
  createdAt: new Date('2026-08-30T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-08-30T11:00:00Z').toISOString(),
  ...overrides,
});

/** jsdom's navigator.onLine is read-only, so redefine it per test. */
const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  mockGetCurrentUser.mockResolvedValue(null);
  mockSyncWorkoutSession.mockResolvedValue(undefined);
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  await clearDatabase();
  await clearMutationQueue();
});

describe('saveWorkoutSession when getCurrentUser() returns null', () => {
  it('still enqueues the session, so it is not outside every defence', async () => {
    // The 401-during-token-refresh shape: the account exists, the lookup does not
    // answer. Pre-fix this asserted 0.
    await saveWorkoutSession(makeSession('s-401'));

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps that session recoverable once an account resolves again', async () => {
    await saveWorkoutSession(makeSession('s-401'));

    // Auth recovers. Replay refuses to ADOPT an ownerless entry (that is how one
    // person's data ends up in another's account on a shared device) and
    // quarantines it into the dead-letter store instead — which Settings surfaces
    // for the user to claim. Quarantined is recoverable; dropped is not.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(await getDeadLetterCount()).toBe(1);
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('session:update');
    expect(held?.reason).toBe('ownerless');
    expect((held?.payload as WorkoutSession).id).toBe('s-401');
  });

  it('counts the workout as unsynced local data while nothing has confirmed a cloud copy', async () => {
    await saveWorkoutSession(makeSession('s-401'));

    expect(await getUnsyncedSessionCount()).toBe(1);
  });
});

describe('the unsynced-session ledger', () => {
  it('stops counting a session once the cloud confirms it', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockResolvedValue(undefined);

    await saveWorkoutSession(makeSession('s-ok'));
    // The sync is fire-and-forget; let the confirmation microtasks settle.
    await vi.waitFor(async () => expect(await getUnsyncedSessionCount()).toBe(0));
  });

  it('keeps counting a session whose cloud write failed', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    // A permanent error, so syncWithRetry short-circuits instead of leaving real
    // backoff timers running into the next test.
    mockSyncWorkoutSession.mockRejectedValue(
      Object.assign(new Error('bad request'), { status: 400 })
    );

    await saveWorkoutSession(makeSession('s-fail'));

    expect(await getUnsyncedSessionCount()).toBe(1);
  });

  it('does not report a session that no longer exists locally', async () => {
    await saveWorkoutSession(makeSession('s-gone'));
    expect(await getUnsyncedSessionCount()).toBe(1);

    await deleteWorkoutSession('s-gone');

    expect(await getUnsyncedSessionCount()).toBe(0);
  });

  it('does not report a session the cloud has just sent back to us', async () => {
    await saveWorkoutSession(makeSession('s-pulled'));
    expect(await getUnsyncedSessionCount()).toBe(1);

    // A row arriving from the cloud demonstrably HAS a cloud copy.
    await mergeWorkoutSessionsFromCloud([
      makeSession('s-pulled', { updatedAt: new Date('2026-08-30T12:00:00Z').toISOString() }),
    ]);

    expect(await getUnsyncedSessionCount()).toBe(0);
  });
});

describe('flushUnsyncedSessions', () => {
  it('pushes a ledgered session and clears it when the cloud accepts', async () => {
    await saveWorkoutSession(makeSession('s-flush'));
    expect(await getUnsyncedSessionCount()).toBe(1);

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockResolvedValue(undefined);

    const result = await flushUnsyncedSessions();

    expect(result.pushed).toBe(1);
    expect(await getUnsyncedSessionCount()).toBe(0);
  });

  it('hands the session to the offline queue when the push fails, instead of losing it', async () => {
    // Saved while auth could not answer: ledgered, and queued by the fix.
    await saveWorkoutSession(makeSession('s-queue'));
    // Empty the queue so the assertions below describe the FLUSH only.
    await clearMutationQueue();

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockSyncWorkoutSession.mockRejectedValue(
      Object.assign(new Error('bad request'), { status: 400 })
    );

    const result = await flushUnsyncedSessions();

    expect(result.queued).toBe(1);
    expect(await getQueueDepth()).toBe(1);
    // Still ledgered: nothing confirmed a cloud copy.
    expect(await getUnsyncedSessionCount()).toBe(1);
  });
});
