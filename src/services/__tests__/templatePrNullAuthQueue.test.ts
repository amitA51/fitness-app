// ============================================================================
// T-118 — the same silent data-loss shape in workout templates and PRs.
// ============================================================================
// THE HOLE THESE TESTS PIN, identical to T-111 (sessions) and T-115 (water,
// nutrition, body stats). Every defence this app has against losing a write keys
// off the OFFLINE QUEUE: the retry engine, the dead-letter store, the owner
// stamping, the sign-out guard. In this codebase the enqueue IS the 4th argument
// to `syncWithRetry` (services/syncEngine.ts), so when the guarded call never
// runs, NO queue row is created at all — which is why the shape is silent
// everywhere it appears.
//
// `getCurrentUser()` returns null not only for a guest but for a signed-in user
// whose token refresh just failed with a 401 (services/supabaseAuth models that
// path). For that user an authored template — or a PR broken in a real workout —
// was written to IndexedDB with nothing scheduled to push it: sign-in only PULLS,
// the sign-out warning read queue depth and said "nothing pending", and the local
// wipe (`Object.values(STORES)`) destroyed it.
//
// The delete paths carry a SECOND, worse asymmetry: the LOCAL delete runs
// regardless of auth while the cloud tombstone sat inside the guard, so the next
// pull RESURRECTED a record the user had deliberately deleted.
//
// Every "still enqueues" assertion below reads 1 where the pre-fix code produces
// 0, and every tombstone assertion reads a queued soft-delete where the pre-fix
// code queued nothing.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cloud must read as CONFIGURED: with no cloud there is nothing to sync to and
// nothing at risk, which is the one case where NOT queueing is correct.
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

import type { PersonalRecord, WorkoutTemplate } from '../../types';
import { STORES, clearDatabase, dbGetAll } from '../indexedDBCore';
import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  listDeadLetters,
  processQueue,
  retryAllDeadLetters,
} from '../offlineQueue';
import { deletePR, savePR } from '../prService';
import { getUnsyncedRecordCounts } from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';
import { deleteCloudWorkoutTemplate, syncPersonalRecord } from '../supabaseSync';
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  mergeWorkoutTemplatesFromCloud,
  updateWorkoutTemplate,
} from '../templateDb';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockSyncPersonalRecord = syncPersonalRecord as ReturnType<typeof vi.fn>;
const mockDeleteCloudWorkoutTemplate = deleteCloudWorkoutTemplate as ReturnType<typeof vi.fn>;

const makeTemplateInput = (name = 'דחיפה א'): Omit<WorkoutTemplate, 'id' | 'createdAt'> => ({
  name,
  description: 'חזה, כתפיים ויד אחורית',
  exercises: [
    {
      id: 'row-1',
      exerciseId: 'bench-press',
      exerciseName: 'לחיצת חזה',
      targetMuscle: 'chest',
      targetSets: 3,
      targetReps: 8,
      targetWeight: 80,
      restSeconds: 120,
      order: 0,
      notes: '',
    },
  ],
  updatedAt: '2026-08-30T10:00:00.000Z',
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
});

const makePR = (id = 'pr-1'): PersonalRecord => ({
  id,
  exerciseId: 'לחיצת חזה',
  exerciseName: 'לחיצת חזה',
  date: '2026-08-30T10:05:00.000Z',
  weight: 100,
  reps: 5,
  type: 'weight',
  maxWeight: 100,
  oneRepMax: 116.7,
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

// ── SITE 1 · templateDb.createWorkoutTemplate ───────────────────────────────

describe('createWorkoutTemplate when getCurrentUser() returns null', () => {
  it('still enqueues the template, so it is not outside every defence', async () => {
    await createWorkoutTemplate(makeTemplateInput());

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps the authored template recoverable once an account resolves again', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput('דחיפה א'));

    // Replay refuses to ADOPT an ownerless entry (that is how one person's data
    // ends up in another's account on a shared device) and quarantines it into
    // the dead-letter store instead, which Settings surfaces for claiming.
    // Quarantined is recoverable; nothing-was-ever-queued is not.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect(await getDeadLetterCount()).toBe(1);
    const [held] = await listDeadLetters();
    expect(held?.type).toBe('template:update');
    expect(held?.reason).toBe('ownerless');
    // The full authored content is still there — not just a marker that
    // "something" was lost.
    expect((held?.payload as WorkoutTemplate).id).toBe(template.id);
    expect((held?.payload as WorkoutTemplate).name).toBe('דחיפה א');
    expect((held?.payload as WorkoutTemplate).exercises).toHaveLength(1);
  });

  it('counts the template as unsynced local data while nothing has confirmed a cloud copy', async () => {
    await createWorkoutTemplate(makeTemplateInput());

    const counts = await getUnsyncedRecordCounts();
    expect(counts.others).toBe(1);
    // Not a workout — the sign-out copy must not call it one.
    expect(counts.sessions).toBe(0);
  });
});

// ── SITE 2 · templateDb.updateWorkoutTemplate ───────────────────────────────

describe('updateWorkoutTemplate when getCurrentUser() returns null', () => {
  it('enqueues the edit rather than dropping it', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    await clearMutationQueue();

    await updateWorkoutTemplate(template.id, { name: 'דחיפה א — גרסה 2' });

    expect(await getQueueDepth()).toBe(1);
  });

  it('queues the NEW revision, so the next pull cannot silently revert the edit', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    await clearMutationQueue();

    await updateWorkoutTemplate(template.id, { name: 'דחיפה א — גרסה 2' });

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    const [held] = await listDeadLetters();
    expect((held?.payload as WorkoutTemplate).name).toBe('דחיפה א — גרסה 2');
  });
});

// ── SITE 3 · templateDb.deleteWorkoutTemplate ──────────────────────────────

describe('deleteWorkoutTemplate when getCurrentUser() returns null', () => {
  it('queues the cloud tombstone it used to skip entirely', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    await clearMutationQueue();

    await deleteWorkoutTemplate(template.id);

    // The local row is hard-deleted regardless of auth…
    expect(await dbGetAll(STORES.WORKOUT_TEMPLATES)).toHaveLength(0);
    // …so without this row the deletion existed nowhere but this device.
    expect(await getQueueDepth()).toBe(1);
    // And the deleted template is no longer counted as at-risk local data.
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });

  it('reaches the cloud as a SOFT delete, so a pull cannot resurrect the template', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    await clearMutationQueue();
    await deleteWorkoutTemplate(template.id);

    // Sign back in, quarantine the ownerless entry, then claim it the way
    // Settings does.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    expect((await listDeadLetters())[0]?.type).toBe('template:delete');

    await retryAllDeadLetters();

    // deleteCloudWorkoutTemplate stamps deleted_at rather than removing the row
    // (supabaseSync) — the only representation that propagates a deletion to a
    // device that was offline when it happened.
    expect(mockDeleteCloudWorkoutTemplate).toHaveBeenCalledWith('user-1', template.id);
    expect(await getDeadLetterCount()).toBe(0);
  });
});

// ── SITE 4 · prService.savePR ───────────────────────────────────────────────

describe('savePR when getCurrentUser() returns null', () => {
  it('still enqueues the record, so it is not outside every defence', async () => {
    await savePR(makePR());

    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps the record recoverable once an account resolves again', async () => {
    await savePR(makePR());

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    const [held] = await listDeadLetters();
    expect(held?.type).toBe('record:create');
    expect(held?.reason).toBe('ownerless');
    expect((held?.payload as { id: string; weight: number }).id).toBe('pr-1');
    expect((held?.payload as { id: string; weight: number }).weight).toBe(100);
  });
});

// ── SITE 5 · prService.deletePR ─────────────────────────────────────────────

describe('deletePR when getCurrentUser() returns null', () => {
  it('leaves a queued TOMBSTONE instead of returning early after the local delete', async () => {
    await savePR(makePR());
    await clearMutationQueue();

    await deletePR('pr-1');

    // The local row is already gone at this point — this function deletes it
    // ABOVE the auth guard.
    expect(await dbGetAll(STORES.PERSONAL_RECORDS)).toHaveLength(0);
    expect(await getQueueDepth()).toBe(1);

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    const [held] = await listDeadLetters();
    // record:create, NOT record:delete: replay goes through syncPersonalRecord,
    // which carries deleted_at through as a soft delete. A hard cloud delete
    // would let any other device re-insert the row.
    expect(held?.type).toBe('record:create');
    expect((held?.payload as { deletedAt?: string }).deletedAt).toBeTruthy();
  });

  it('sends that tombstone to the cloud once the record is claimed', async () => {
    await savePR(makePR());
    await clearMutationQueue();
    await deletePR('pr-1');

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();
    await retryAllDeadLetters();

    expect(mockSyncPersonalRecord).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'pr-1', deletedAt: expect.any(String) })
    );
  });
});

// ── Ledger hygiene · the fix must not warn forever ──────────────────────────

describe('the template half of the unsynced ledger', () => {
  it('stops counting a template once the cloud confirms it', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });

    await createWorkoutTemplate(makeTemplateInput());

    // The direct push is deliberately fire-and-forget so template creation does
    // not block on the network, so the marker clears a few microtasks later.
    await vi.waitFor(async () => {
      expect((await getUnsyncedRecordCounts()).total).toBe(0);
    });
    // Confirmed directly, so nothing was queued either.
    expect(await getQueueDepth()).toBe(0);
  });

  it('stops counting a template the cloud has just sent back at the same revision', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    await mergeWorkoutTemplatesFromCloud([template]);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });

  it('keeps counting a template whose local edit is NEWER than the cloud copy', async () => {
    const template = await createWorkoutTemplate(makeTemplateInput());
    const stale = { ...template, updatedAt: '2020-01-01T00:00:00.000Z' };

    await mergeWorkoutTemplatesFromCloud([stale]);

    // The cloud is behind us, so this really is unpushed local work.
    expect((await getUnsyncedRecordCounts()).total).toBe(1);
  });
});
