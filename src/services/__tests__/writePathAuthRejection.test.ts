// ============================================================================
// T-132 — DEFECT #5: one auth rule for every write path, not sixteen copies.
// ============================================================================
// Every offline-capable write here has the same shape: local write, then
// `const user = await getCurrentUser()`, then either a direct push or
// `queueMutation` in the `else`. A REJECTION at that read is the same situation
// as a null user — auth cannot answer — but a bare `await` turns it into a throw
// that escapes BEFORE `markRecordUnsynced` and BEFORE `queueMutation`. The row
// then sits in IndexedDB, in no queue and in no ledger: the retry engine, the
// dead-letter store and the sign-out guard all read the queue, so none of them
// can see it.
//
// The codebase had already reached that conclusion three times and implemented
// it three different ways (nutritionService's `.catch(() => null)`, exerciseDb's
// try/catch, offlineQueue's `catch { userId = UNKNOWN_OWNER }`) while thirteen
// other write paths still had the bare `await`. The fix is one helper,
// `supabaseAuth.resolveCurrentUserOrNull`, used at all of them.
//
// This file deliberately does NOT mock `supabaseAuth`: it drives the real
// `getCurrentUser` through a stubbed Supabase client, so the helper itself is
// under test. `reject` mode models the plausible real sources of a rejection —
// a NavigatorLockAcquireTimeoutError in a multi-tab race, or a storage adapter
// that throws in a partitioned context — which `getSession()` surfaces as a
// throw rather than as an `{ error }` field.
//
// The assertion is a comparison, not a hard-coded expectation: for each write
// function, a REJECTING auth read must produce exactly what a NULL-resolving one
// produces. Before the fix the reject column produced a rejected promise and an
// empty queue.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Hoisted so the `lib/supabase` factory can read it during module init. */
const authState = vi.hoisted(() => ({ mode: 'null' as 'null' | 'reject' | 'user' | 'hang' }));

const lockTimeout = () => new Error('NavigatorLockAcquireTimeoutError: lock sb-auth-token');

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: async () => {
        // A token refresh stuck on an overloaded server.
        if (authState.mode === 'hang') return new Promise(() => {});
        if (authState.mode === 'reject') throw lockTimeout();
        if (authState.mode === 'user') {
          return { data: { session: { user: { id: 'user-1' } } }, error: null };
        }
        return { data: { session: null }, error: null };
      },
      getUser: async () => {
        if (authState.mode === 'reject') throw lockTimeout();
        if (authState.mode === 'user') return { data: { user: { id: 'user-1' } }, error: null };
        return { data: { user: null }, error: null };
      },
      signOut: async () => ({ error: null }),
    },
  },
}));

vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));
vi.mock('../localStateMirror', () => ({ mirrorLocalKey: vi.fn(), mirrorAllLocalKeys: vi.fn() }));

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

vi.mock('../ai/core', () => ({ getAIProvider: () => ({ chat: async () => 'תשובה מהמאמן' }) }));

import type { MealType, PersonalRecord, WorkoutSession, WorkoutTemplate } from '../../types';
import { deleteConversation, sendMessage } from '../ai/chat';
import {
  type RecoveryLog,
  addBodyMeasurement,
  addBodyWeight,
  addRecoveryLog,
  deleteBodyWeight,
  deleteRecoveryLog,
  updateBodyWeight,
} from '../bodyStatsService';
import { createPersonalExercise, deletePersonalExercise } from '../exerciseDb';
import { clearDatabase, dbGetAll } from '../indexedDBCore';
import {
  addFoodFromPreset,
  addMealEntry,
  deleteMealEntry,
  updateMealEntry,
} from '../nutritionService';
import { clearMutationQueue, getQueueDepth, listDeadLetters, processQueue } from '../offlineQueue';
import { deletePR, savePR } from '../prService';
import { deleteWorkoutSession, saveWorkoutSession, settleSessionCloudHandoffs } from '../sessionDb';
import { resolveCurrentUserOrNull } from '../supabaseAuth';
import { createWorkoutTemplate, deleteWorkoutTemplate, updateWorkoutTemplate } from '../templateDb';
import { addWaterEntry } from '../waterService';

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

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
  updatedAt: '2026-09-29T10:00:00.000Z',
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
});

const makeSession = (id: string): WorkoutSession => ({
  id,
  templateId: null,
  date: '2026-09-29',
  startTime: '2026-09-29T10:00:00.000Z',
  endTime: '2026-09-29T11:00:00.000Z',
  exercises: [],
  duration: 3600,
  status: 'completed',
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: '2026-09-29T10:00:00.000Z',
  updatedAt: '2026-09-29T11:00:00.000Z',
});

const makePR = (id: string): PersonalRecord => ({
  id,
  exerciseId: 'לחיצת חזה',
  exerciseName: 'לחיצת חזה',
  date: '2026-09-29T10:05:00.000Z',
  weight: 100,
  reps: 5,
  type: 'weight',
  maxWeight: 100,
  oneRepMax: 116.7,
});

const recoveryInput = (date: string): Omit<RecoveryLog, 'id' | 'createdAt'> => ({
  date,
  sleepHours: 8,
  sleepQuality: 4,
  sorenessLevel: 4,
  energyLevel: 4,
  stressLevel: 4,
  tightAreas: [],
  notes: '',
});

const makeMeal = () => ({
  date: '2026-09-29',
  name: 'ארוחת בוקר',
  meals: [
    {
      id: 'inner-1',
      name: 'breakfast' as MealType,
      foods: [],
      time: '08:30',
      totalMacros: { calories: 400, protein: 30, carbs: 40, fat: 12, fiber: 4 },
    },
  ],
  totalMacros: { calories: 400, protein: 30, carbs: 40, fat: 12, fiber: 4 },
  notes: '',
});

/**
 * Every write path in the sweep's DEFECT #5 list, plus the two AI paths from
 * #1/#2 and the two exerciseDb paths that were already defended (they must not
 * regress now that they share the helper).
 *
 * `seed` runs with auth already in the mode under test, so an update/delete case
 * exercises the same auth read twice rather than smuggling a signed-in write in.
 */
const writePaths: { label: string; seed?: () => Promise<void>; run: () => Promise<void> }[] = [
  {
    label: 'nutritionService.addMealEntry',
    run: async () => void (await addMealEntry(makeMeal())),
  },
  {
    label: 'nutritionService.updateMealEntry',
    run: async () => {
      const entry = await addMealEntry(makeMeal());
      await clearMutationQueue();
      await updateMealEntry({ ...entry, notes: 'עודכן' });
    },
  },
  {
    label: 'nutritionService.deleteMealEntry',
    run: async () => {
      const entry = await addMealEntry(makeMeal());
      await clearMutationQueue();
      await deleteMealEntry(entry.id);
    },
  },
  {
    label: 'nutritionService.addFoodFromPreset',
    run: async () => {
      await addFoodFromPreset('preset-1', 'breakfast' as MealType, '2026-09-29');
      // The cloud leg is deliberately off the caller's critical path here, so
      // give the detached async block its turn before the queue is read.
      await vi.waitFor(async () => {
        expect(await getQueueDepth()).toBeGreaterThan(0);
      });
    },
  },
  {
    label: 'bodyStatsService.addBodyWeight',
    run: async () => void (await addBodyWeight({ date: '2026-09-29', weight: 82.5 })),
  },
  {
    label: 'bodyStatsService.updateBodyWeight',
    run: async () => {
      const row = await addBodyWeight({ date: '2026-09-29', weight: 82.5 });
      await clearMutationQueue();
      await updateBodyWeight({ ...row, weight: 83 });
    },
  },
  {
    label: 'bodyStatsService.deleteBodyWeight',
    run: async () => {
      const row = await addBodyWeight({ date: '2026-09-29', weight: 82.5 });
      await clearMutationQueue();
      await deleteBodyWeight(row.id);
    },
  },
  {
    label: 'bodyStatsService.addBodyMeasurement',
    run: async () => void (await addBodyMeasurement({ date: '2026-09-29', waist: 82 })),
  },
  {
    label: 'bodyStatsService.addRecoveryLog',
    run: async () => void (await addRecoveryLog(recoveryInput('2026-09-29'))),
  },
  {
    label: 'bodyStatsService.deleteRecoveryLog',
    run: async () => {
      const log = await addRecoveryLog(recoveryInput('2026-09-29'));
      await clearMutationQueue();
      await deleteRecoveryLog(log.id);
    },
  },
  {
    label: 'templateDb.createWorkoutTemplate',
    run: async () => void (await createWorkoutTemplate(makeTemplateInput())),
  },
  {
    label: 'templateDb.updateWorkoutTemplate',
    run: async () => {
      const template = await createWorkoutTemplate(makeTemplateInput());
      await clearMutationQueue();
      await updateWorkoutTemplate(template.id, { name: 'דחיפה א — גרסה 2' });
    },
  },
  {
    label: 'templateDb.deleteWorkoutTemplate',
    run: async () => {
      const template = await createWorkoutTemplate(makeTemplateInput());
      await clearMutationQueue();
      await deleteWorkoutTemplate(template.id);
    },
  },
  { label: 'prService.savePR', run: async () => void (await savePR(makePR('pr-1'))) },
  {
    label: 'prService.deletePR',
    run: async () => {
      await savePR(makePR('pr-1'));
      await clearMutationQueue();
      await deletePR('pr-1');
    },
  },
  {
    label: 'sessionDb.saveWorkoutSession',
    run: async () => {
      await saveWorkoutSession(makeSession('sess-1'));
      // The cloud hand-off runs after the save resolves: the save UI must not
      // wait on auth. Settle it before reading the queue.
      await settleSessionCloudHandoffs();
    },
  },
  {
    label: 'sessionDb.deleteWorkoutSession',
    run: async () => {
      await saveWorkoutSession(makeSession('sess-1'));
      await settleSessionCloudHandoffs();
      await clearMutationQueue();
      await deleteWorkoutSession('sess-1');
    },
  },
  { label: 'waterService.addWaterEntry', run: async () => void (await addWaterEntry(250)) },
  {
    label: 'exerciseDb.createPersonalExercise',
    run: async () => {
      await createPersonalExercise({
        name: 'מתח בהנעה',
        category: 'strength',
        primaryMuscle: 'back',
        equipment: 'bodyweight',
      });
      await vi.waitFor(async () => {
        expect(await getQueueDepth()).toBeGreaterThan(0);
      });
    },
  },
  {
    label: 'exerciseDb.deletePersonalExercise',
    run: async () => {
      const exercise = await createPersonalExercise({
        name: 'מתח בהנעה',
        category: 'strength',
        primaryMuscle: 'back',
        equipment: 'bodyweight',
      });
      await vi.waitFor(async () => {
        expect(await getQueueDepth()).toBeGreaterThan(0);
      });
      await clearMutationQueue();
      await deletePersonalExercise(exercise.id);
      await vi.waitFor(async () => {
        expect(await getQueueDepth()).toBeGreaterThan(0);
      });
    },
  },
  { label: 'ai/chat.sendMessage', run: async () => void (await sendMessage('שאלה לאימון')) },
  {
    label: 'ai/chat.deleteConversation',
    run: async () => {
      const { conversation } = await sendMessage('שאלה לאימון');
      await clearMutationQueue();
      await deleteConversation(conversation.id);
    },
  },
];

/**
 * Run one write path under one auth mode and describe what it left behind.
 *
 * The queue exposes no listing API, so the rows are read back the way Settings
 * does: replay them with a resolved account, which quarantines every ownerless
 * entry into the dead-letter store with its type intact.
 */
const captureQueueOutcome = async (
  mode: 'null' | 'reject',
  run: () => Promise<void>
): Promise<{ depth: number; types: string[] }> => {
  await clearDatabase();
  await clearMutationQueue();
  authState.mode = mode;

  await run();

  const depth = await getQueueDepth();

  authState.mode = 'user';
  await processQueue();
  const types = (await listDeadLetters()).map((d) => d.type).sort();

  return { depth, types };
};

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  authState.mode = 'null';
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  authState.mode = 'null';
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

describe('resolveCurrentUserOrNull', () => {
  it('maps a REJECTING auth read to null instead of propagating the throw', async () => {
    authState.mode = 'reject';

    await expect(resolveCurrentUserOrNull()).resolves.toBeNull();
  });

  it('still returns the user when auth can answer', async () => {
    authState.mode = 'user';

    expect((await resolveCurrentUserOrNull())?.id).toBe('user-1');
  });

  it('gives up after 2 s on a lookup stuck behind a token refresh, answering null', async () => {
    // Every write path awaits this between its local write and its enqueue; a
    // stuck refresh used to hold the meal / glass of water out of the queue.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    authState.mode = 'hang';
    let answer: unknown = 'pending';
    const lookup = resolveCurrentUserOrNull().then((user) => {
      answer = user;
    });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(answer).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await lookup;
    vi.useRealTimers();

    expect(answer).toBeNull();
  });
});

describe('a rejecting getCurrentUser takes the same road as a null one', () => {
  for (const { label, run } of writePaths) {
    it(`${label} queues the same thing either way`, async () => {
      const whenNull = await captureQueueOutcome('null', run);
      const whenRejected = await captureQueueOutcome('reject', run);

      // Guard against a vacuous pass: the null column is the known-good
      // behaviour every earlier batch pinned, so it must really have queued.
      expect(whenNull.depth).toBeGreaterThan(0);
      expect(whenRejected).toEqual(whenNull);
    });
  }
});

describe('the local write still lands when auth rejects', () => {
  it('keeps the body-weight row, so the queue row is not compensating for a lost write', async () => {
    authState.mode = 'reject';

    await addBodyWeight({ date: '2026-09-29', weight: 82.5 });

    expect(await dbGetAll('body_weight')).toHaveLength(1);
    expect(await getQueueDepth()).toBe(1);
  });
});
