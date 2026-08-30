// ============================================================================
// T-119 — a custom exercise, and a workout DELETION, made while
// getCurrentUser() returns null must still reach the cloud.
// ============================================================================
// THE HOLE THESE PIN, the same family as T-111 (sessionDb save) and T-115
// (water / nutrition / body stats). In this codebase the enqueue IS the 4th
// argument to `syncWithRetry` (services/syncEngine.ts). When that call sits
// INSIDE an auth guard, a null `getCurrentUser()` creates NO QUEUE ROW AT ALL —
// and it answers null not only for a guest but for a real account holder whose
// token refresh just failed with a 401 (services/supabaseAuth models that path).
// Every defence the app has — the retry engine, the dead-letter store, the owner
// stamping, the sign-out guard — reads the queue, so the write was invisible to
// all of them and the sign-out wipe took it.
//
// Two distinct losses are covered:
//   · SAVE side (exerciseDb create/update) — a CUSTOM exercise cannot be
//     regenerated. Built-ins re-seed themselves (`loadAndSeedBuiltIns`).
//   · DELETE side (sessionDb.deleteWorkoutSession, exerciseDb's two tombstone
//     paths) — the local delete is UNCONDITIONAL while the cloud tombstone was
//     not, so the cloud row stayed LIVE and the next pull RESURRECTED a record
//     the user had deleted.
//
// Load-bearing vs regression guard is called out on each `describe` below.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cloud must read as CONFIGURED: with no cloud there is nothing to sync to and
// nothing at risk, which is the one case where not queueing is correct.
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true, supabase: null }));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));

// A stand-in for the `workout_sessions` table, so the resurrection test can do
// the real round trip: push -> delete under null auth -> claim -> pull.
const { cloudSessions } = vi.hoisted(() => ({
  cloudSessions: new Map<string, { id: string; deletedAt?: string | null }>(),
}));

// offlineQueue's replay destructures the whole cloud-sync surface, so the mock
// has to cover it even though only a few members are asserted on.
vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(async (_userId: string, session: { id: string }) => {
    cloudSessions.set(session.id, { ...session, deletedAt: null });
  }),
  deleteCloudWorkoutSession: vi.fn(async (_userId: string, id: string) => {
    const row = cloudSessions.get(id);
    if (row) cloudSessions.set(id, { ...row, deletedAt: new Date().toISOString() });
  }),
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

import type { PersonalExercise, WorkoutSession } from '../../types';
import {
  createPersonalExercise,
  deletePersonalExercise,
  getPersonalExercise,
  removeDuplicateExercises,
  updatePersonalExercise,
} from '../exerciseDb';
import { STORES, clearDatabase, dbPut } from '../indexedDBCore';
import {
  clearMutationQueue,
  getQueueDepth,
  listDeadLetters,
  processQueue,
  retryDeadLetter,
} from '../offlineQueue';
import {
  deleteWorkoutSession,
  flushUnsyncedSessions,
  getWorkoutSessions,
  markRecordUnsynced,
  mergeWorkoutSessionsFromCloud,
  reAddWorkoutSession,
} from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';
import {
  deleteCloudPersonalExercise,
  deleteCloudWorkoutSession,
  syncPersonalExercise,
  syncWorkoutSession,
} from '../supabaseSync';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockSyncPersonalExercise = syncPersonalExercise as ReturnType<typeof vi.fn>;
const mockDeleteCloudPersonalExercise = deleteCloudPersonalExercise as ReturnType<typeof vi.fn>;
const mockDeleteCloudWorkoutSession = deleteCloudWorkoutSession as ReturnType<typeof vi.fn>;
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

const makeExercise = (id: string, overrides: Partial<PersonalExercise> = {}): PersonalExercise =>
  ({
    id,
    name: 'תרגיל כפול לבדיקה',
    createdAt: new Date('2026-08-01T08:00:00Z').toISOString(),
    useCount: 1,
    lastUsed: new Date('2026-08-20T08:00:00Z').toISOString(),
    ...overrides,
  }) as PersonalExercise;

/** jsdom's navigator.onLine is read-only, so redefine it per test. */
const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  mockGetCurrentUser.mockResolvedValue(null);
  cloudSessions.clear();
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  cloudSessions.clear();
  await clearDatabase();
  await clearMutationQueue();
});

// ── SITE 1 · exerciseDb.createPersonalExercise (was exerciseDb.ts:153) ───────

describe('createPersonalExercise when getCurrentUser() returns null', () => {
  // LOAD-BEARING: 0 on the pre-fix code.
  it('still enqueues the custom exercise, so it is not outside every defence', async () => {
    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });

    expect(await getQueueDepth()).toBe(1);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [queued] = await listDeadLetters();
    expect(queued?.type).toBe('exercise:update');
    expect((queued?.payload as { id: string }).id).toBe(created.id);
  });

  // LOAD-BEARING: this is the "still recoverable" half — the write actually
  // reaches the cloud once the user claims it from Settings.
  it('reaches the cloud once an account resolves and the entry is claimed', async () => {
    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });

    // Replay refuses to ADOPT an ownerless entry (that is how one person's data
    // ends up in another's account on a shared device) and quarantines it for
    // claiming instead. Quarantined is recoverable; dropped is not.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.reason).toBe('ownerless');

    expect(await retryDeadLetter(String(held?.id))).toBe(true);

    expect(mockSyncPersonalExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: created.id, name: 'מתח בהחזקה' })
    );
  });
});

// ── SITE 2 · exerciseDb.updatePersonalExercise (was exerciseDb.ts:188) ───────

describe('updatePersonalExercise when getCurrentUser() returns null', () => {
  // LOAD-BEARING: 0 on the pre-fix code.
  it('enqueues the edit rather than dropping it', async () => {
    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });
    await clearMutationQueue();

    await updatePersonalExercise(created.id, { notes: 'אחיזה רחבה' });

    expect(await getQueueDepth()).toBe(1);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('exercise:update');
    expect((held?.payload as { notes?: string }).notes).toBe('אחיזה רחבה');
  });
});

// ── SITE 3 · exerciseDb.deletePersonalExercise (was exerciseDb.ts:231) ───────

describe('deletePersonalExercise when getCurrentUser() returns null', () => {
  // LOAD-BEARING: 0 on the pre-fix code. The local hard-delete always happened,
  // so with no tombstone queued the next pull re-inserted the exercise.
  it('queues the cloud tombstone instead of only deleting locally', async () => {
    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });
    await clearMutationQueue();

    await deletePersonalExercise(created.id);

    expect(await getPersonalExercise(created.id)).toBeUndefined();
    expect(await getQueueDepth()).toBe(1);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('exercise:delete');
    expect(held?.payload).toBe(created.id);
  });

  // LOAD-BEARING: proves what is queued is a TOMBSTONE (deleteCloudPersonalExercise
  // stamps deleted_at), not a hard delete that other devices would undo.
  it('stamps the cloud tombstone once the entry is claimed', async () => {
    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });
    await clearMutationQueue();
    await deletePersonalExercise(created.id);

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    await retryDeadLetter(String(held?.id));

    expect(mockDeleteCloudPersonalExercise).toHaveBeenCalledWith('user-1', created.id);
  });
});

// ── SITE 4 · exerciseDb.removeDuplicateExercises (was exerciseDb.ts:331) ─────

describe('removeDuplicateExercises when getCurrentUser() returns null', () => {
  // LOAD-BEARING: 0 on the pre-fix code, which made the cleanup self-undoing —
  // the duplicates were still live in the cloud and came back on the next pull.
  it('queues a tombstone for every duplicate it deletes locally', async () => {
    // useCount > 0 on both, so the built-in self-heal (which is deliberately
    // local-only) leaves them alone and this function is what removes one.
    await dbPut(STORES.PERSONAL_EXERCISES, makeExercise('dup-keep', { useCount: 5 }));
    await dbPut(
      STORES.PERSONAL_EXERCISES,
      makeExercise('dup-drop', {
        useCount: 1,
        lastUsed: new Date('2026-08-02T08:00:00Z').toISOString(),
      })
    );
    await clearMutationQueue();

    const removed = await removeDuplicateExercises();

    expect(removed).toBe(1);
    expect(await getPersonalExercise('dup-drop')).toBeUndefined();
    expect(await getQueueDepth()).toBe(1);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('exercise:delete');
    expect(held?.payload).toBe('dup-drop');
  });
});

// ── SITE 5 · sessionDb.deleteWorkoutSession (was sessionDb.ts:509) ──────────

describe('deleteWorkoutSession when getCurrentUser() returns null', () => {
  // LOAD-BEARING: 0 on the pre-fix code.
  it('queues the cloud tombstone for the deleted workout', async () => {
    await reAddWorkoutSession(makeSession('s-401'));

    await deleteWorkoutSession('s-401');

    expect(await getQueueDepth()).toBe(1);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('session:delete');
    expect(held?.payload).toBe('s-401');
  });

  // LOAD-BEARING, and the most visible symptom in the ticket: the full round
  // trip. Pre-fix this ends with the workout back in the list.
  it('keeps the workout deleted across the next pull', async () => {
    // On the device AND in the cloud, the normal state before a delete.
    await reAddWorkoutSession(makeSession('s-401'));
    cloudSessions.set('s-401', { ...makeSession('s-401'), deletedAt: null });

    // The 401-during-token-refresh shape: the account exists, auth does not answer.
    await deleteWorkoutSession('s-401');
    expect(await getWorkoutSessions()).toHaveLength(0);

    // Auth recovers and the user claims the ownerless entry from Settings. On the
    // pre-fix code there is nothing queued and nothing to claim, so this loop is
    // a no-op and the cloud row below is still live.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    for (const held of await listDeadLetters()) {
      await retryDeadLetter(held.id);
    }

    // The next pull. A cloud row with no deleted_at is re-inserted by the merge.
    await mergeWorkoutSessionsFromCloud([...cloudSessions.values()] as WorkoutSession[]);

    expect(await getWorkoutSessions()).toHaveLength(0);
  });
});

// ── Regression guards ───────────────────────────────────────────────────────

describe('the signed-in paths still push directly', () => {
  // REGRESSION GUARD: the fix must not turn a healthy signed-in write into a
  // queued one — that would delay every save behind the retry machinery.
  it('creates an exercise straight to the cloud without queueing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });

    const created = await createPersonalExercise({ name: 'מתח בהחזקה' });

    expect(mockSyncPersonalExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: created.id })
    );
    expect(await getQueueDepth()).toBe(0);
  });

  it('deletes a workout straight to the cloud without queueing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await reAddWorkoutSession(makeSession('s-ok'));

    await deleteWorkoutSession('s-ok');

    expect(mockDeleteCloudWorkoutSession).toHaveBeenCalledWith('user-1', 's-ok');
    expect(await getQueueDepth()).toBe(0);
  });
});

describe('the shared unsynced ledger is untouched by this change', () => {
  // REGRESSION GUARD on the hard constraint: flushUnsyncedSessions pushes through
  // syncWorkoutSession, so a non-session marker down that path would write garbage
  // into the workouts table.
  it('still flushes session markers only', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await markRecordUnsynced(STORES.WATER_LOGS, 'w-1');
    await markRecordUnsynced(STORES.PERSONAL_EXERCISES, 'ex-1');

    const result = await flushUnsyncedSessions();

    expect(mockSyncWorkoutSession).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 0, queued: 0 });
  });
});
