// ============================================================================
// T-115 — the same silent data-loss shape in water, nutrition and body stats.
// ============================================================================
// THE HOLE THIS PINS, identical to the one sessionDb closed in T-111. Every
// defence this app has against losing a write keys off the OFFLINE QUEUE: the
// retry engine, the dead-letter store, the owner stamping, the sign-out guard.
// In this codebase the enqueue IS the 4th argument to `syncWithRetry` (see
// services/syncEngine.ts), so when the guarded call never runs, NO queue row is
// created at all — which is why the shape is silent everywhere it appears.
//
// `getCurrentUser()` returns null not only for a guest but for a signed-in user
// whose token refresh just failed with a 401 (services/supabaseAuth models that
// path). For that user a glass of water, a logged meal or a weigh-in was written
// to IndexedDB with nothing scheduled to push it: sign-in only PULLS, the
// sign-out warning counted queue depth alone and said "nothing pending", and the
// local wipe (`Object.values(STORES)`) destroyed it.
//
// Each "still enqueues" test below asserts 1 where the pre-fix code produces 0.
// The ledger tests assert the second half: an unsynced record in ANY store is
// countable while the queue is EMPTY — the exact state the old guard read as
// safe.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cloud must read as CONFIGURED: with no cloud there is nothing to sync to and
// nothing at risk, which is the one case where not queueing is correct.
// `supabase: null` makes the direct water upsert a no-op success without a
// network stub, which is what the "marker is cleared on confirm" test needs.
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true, supabase: null }));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));
vi.mock('../localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

// offlineQueue's replay destructures the whole cloud-sync surface, so the mock
// has to cover it even though only a few members are asserted on.
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
  type RecoveryLog,
  addBodyMeasurement,
  addBodyWeight,
  addRecoveryLog,
  deleteBodyWeight,
  deleteRecoveryLog,
} from '../bodyStatsService';
import { STORES, clearDatabase, dbPut } from '../indexedDBCore';
import { addMealEntry, deleteMealEntry, updateMealEntry } from '../nutritionService';
import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  listDeadLetters,
  processQueue,
} from '../offlineQueue';
import { getUnsyncedRecordCounts, getUnsyncedSessionCount } from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';
import { addWaterEntry, mergeWaterLogsFromCloud } from '../waterService';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

const makeMeal = (name = 'ביצים') => ({
  date: '2026-08-30',
  name,
  meals: [
    {
      id: 'inner-1',
      name: 'breakfast' as const,
      foods: [],
      time: '08:00',
      totalMacros: { calories: 300, protein: 20, carbs: 10, fat: 18, fiber: 0 },
    },
  ],
  totalMacros: { calories: 300, protein: 20, carbs: 10, fat: 18, fiber: 0 },
  notes: '',
});

const makeRecovery = (): Omit<RecoveryLog, 'id' | 'createdAt'> => ({
  date: '2026-08-30',
  sleepHours: 7,
  sleepQuality: 4,
  sorenessLevel: 3,
  energyLevel: 4,
  stressLevel: 3,
  tightAreas: [],
  notes: '',
});

/** jsdom's navigator.onLine is read-only, so redefine it per test. */
const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  mockGetCurrentUser.mockResolvedValue(null);
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  await clearDatabase();
  await clearMutationQueue();
});

// ── STEP 1a · water ─────────────────────────────────────────────────────────

describe('addWaterEntry when getCurrentUser() returns null', () => {
  it('still enqueues the entry, so it is not outside every defence', async () => {
    await addWaterEntry(250);

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps that entry recoverable once an account resolves again', async () => {
    await addWaterEntry(250);

    // Replay refuses to ADOPT an ownerless entry (that is how one person's data
    // ends up in another's account on a shared device) and quarantines it into
    // the dead-letter store instead, which Settings surfaces for claiming.
    // Quarantined is recoverable; dropped is not.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(await getDeadLetterCount()).toBe(1);
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('water:create');
    expect(held?.reason).toBe('ownerless');
  });

  it('counts the entry as unsynced local data while nothing has confirmed a cloud copy', async () => {
    await addWaterEntry(250);

    const counts = await getUnsyncedRecordCounts();
    expect(counts.others).toBe(1);
    // Not a workout — the sign-out copy must not call it one.
    expect(counts.sessions).toBe(0);
  });
});

describe('the water half of the ledger', () => {
  it('stops counting an entry once the cloud confirms it', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });

    await addWaterEntry(300);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
    // Confirmed directly, so nothing was queued either.
    expect(await getQueueDepth()).toBe(0);
  });

  it('stops counting an entry the cloud has just sent back to us', async () => {
    const entry = await addWaterEntry(300);
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    await mergeWaterLogsFromCloud([{ ...entry, amountMl: 300 }]);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });
});

// ── STEP 1b · nutrition ─────────────────────────────────────────────────────

describe('addMealEntry when getCurrentUser() returns null', () => {
  it('still enqueues the meal, so it is not outside every defence', async () => {
    await addMealEntry(makeMeal());

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps that meal recoverable once an account resolves again', async () => {
    await addMealEntry(makeMeal());

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    const [held] = await listDeadLetters();
    expect(held?.type).toBe('nutrition:update');
    expect(held?.reason).toBe('ownerless');
  });

  it('counts the meal as unsynced local data', async () => {
    await addMealEntry(makeMeal());

    expect((await getUnsyncedRecordCounts()).others).toBe(1);
  });
});

describe('the rest of the nutrition write paths with a null user', () => {
  it('enqueues an edit rather than dropping it', async () => {
    const entry = await addMealEntry(makeMeal());
    await clearMutationQueue();

    await updateMealEntry({ ...entry, notes: 'עוד קצת חלבון' });

    expect(await getQueueDepth()).toBe(1);
  });

  it('enqueues the cloud tombstone on delete, so the next pull cannot resurrect the meal', async () => {
    const entry = await addMealEntry(makeMeal());
    await clearMutationQueue();

    await deleteMealEntry(entry.id);

    // The local row is hard-deleted regardless of auth; the cloud delete used to
    // be reachable only with a resolved user.
    expect(await getQueueDepth()).toBe(1);
    // And the deleted meal is no longer counted as at-risk local data.
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });
});

// ── STEP 1c · body stats ────────────────────────────────────────────────────

describe('addBodyWeight when getCurrentUser() returns null', () => {
  it('still enqueues the weigh-in, so it is not outside every defence', async () => {
    await addBodyWeight({ date: '2026-08-30', weight: 81.4 });

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps that weigh-in recoverable once an account resolves again', async () => {
    await addBodyWeight({ date: '2026-08-30', weight: 81.4 });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    const [held] = await listDeadLetters();
    expect(held?.type).toBe('bodyweight:create');
    expect(held?.reason).toBe('ownerless');
  });

  it('counts the weigh-in as unsynced local data', async () => {
    await addBodyWeight({ date: '2026-08-30', weight: 81.4 });

    expect((await getUnsyncedRecordCounts()).others).toBe(1);
  });

  it('enqueues the tombstone on delete instead of only deleting locally', async () => {
    const entry = await addBodyWeight({ date: '2026-08-30', weight: 81.4 });
    await clearMutationQueue();

    await deleteBodyWeight(entry.id);

    expect(await getQueueDepth()).toBe(1);
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });
});

describe('addBodyMeasurement and addRecoveryLog with a null user', () => {
  it('enqueues a measurement', async () => {
    await addBodyMeasurement({ date: '2026-08-30', waist: 88 });

    expect(await getQueueDepth()).toBe(1);
    expect((await getUnsyncedRecordCounts()).others).toBe(1);
  });

  it('enqueues a recovery log', async () => {
    await addRecoveryLog(makeRecovery());

    expect(await getQueueDepth()).toBe(1);
    expect((await getUnsyncedRecordCounts()).others).toBe(1);
  });

  it('enqueues a recovery log tombstone on delete', async () => {
    const log = await addRecoveryLog(makeRecovery());
    await clearMutationQueue();

    await deleteRecoveryLog(log.id);

    expect(await getQueueDepth()).toBe(1);
  });

  // THE SECOND, DIFFERENT ASYMMETRY. addRecoveryLog hard-deletes same-day
  // duplicates LOCALLY, outside the auth guard, while their cloud tombstones sat
  // INSIDE it. With a null user the local delete happened and the cloud delete
  // did not, so the next pull RESURRECTED the duplicate the user had replaced.
  it('queues the cloud tombstones for the same-day duplicates it deletes locally', async () => {
    await dbPut(STORES.RECOVERY_LOGS, {
      ...makeRecovery(),
      id: 'rec-canonical',
      createdAt: '2026-08-30T06:00:00.000Z',
    });
    await dbPut(STORES.RECOVERY_LOGS, {
      ...makeRecovery(),
      id: 'rec-duplicate',
      createdAt: '2026-08-30T05:00:00.000Z',
    });

    await addRecoveryLog(makeRecovery());

    // One create for the canonical row + one delete for the duplicate.
    expect(await getQueueDepth()).toBe(2);

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const types = (await listDeadLetters()).map((row) => row.type);
    expect(types).toContain('recovery:create');
    expect(types).toContain('recovery:delete');
  });
});

// ── STEP 2 · the visibility half ────────────────────────────────────────────

describe('the unsynced ledger with an EMPTY queue', () => {
  // This is the exact state the sign-out guard used to read as safe: nothing in
  // the active queue, nothing held, and a record in every store that exists
  // only on this device.
  it('counts an unsynced record in every store, not just workouts', async () => {
    await addWaterEntry(250);
    await addMealEntry(makeMeal());
    await addBodyWeight({ date: '2026-08-30', weight: 81.4 });
    await addBodyMeasurement({ date: '2026-08-30', waist: 88 });
    await addRecoveryLog(makeRecovery());

    // Empty the queue AND the held store, so the count below can only be coming
    // from the ledger.
    await clearMutationQueue();
    expect(await getQueueDepth()).toBe(0);
    expect(await getDeadLetterCount()).toBe(0);

    const counts = await getUnsyncedRecordCounts();
    expect(counts.others).toBe(5);
    expect(counts.sessions).toBe(0);
    expect(counts.total).toBe(5);
  });

  it('leaves the workout count alone, so the sign-out copy still names workouts correctly', async () => {
    await addWaterEntry(250);

    expect(await getUnsyncedSessionCount()).toBe(0);
  });

  it('does not report a record that no longer exists locally', async () => {
    const entry = await addMealEntry(makeMeal());
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    await deleteMealEntry(entry.id);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });
});
