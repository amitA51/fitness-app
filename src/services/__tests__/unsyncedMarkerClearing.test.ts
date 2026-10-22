// ============================================================================
// T-132 — DEFECT #3: the unsynced marker that never cleared.
// ============================================================================
// Markers are written for seven stores. They were cleared on (a) same-call sync
// success, (b) a local delete, or (c) a cloud pull — and (c) existed for only
// three of the seven. Nothing in `offlineQueue` cleared one at all, so the most
// common offline flow left a permanent false warning:
//
//   log a meal offline → marker written → queueMutation → back online →
//   the queue replays SUCCESSFULLY → the marker survives.
//
// `getUnsyncedRecords` reconciles markers against live ids, and the row IS live,
// so it is not pruned as stale — it is counted forever. The sign-out dialog
// (pages/Settings) and the offline indicator then warn about data that is safely
// in the cloud, with no user action able to clear it. That is the same
// "a marker would stick forever" reasoning that correctly kept markers OFF PRs
// and exercises, applied to stores where the markers were added anyway.
//
// Two fixes, two halves of this file: the confirmed-replay path in
// `processQueue`, and the pull path through `cloudMerge.mergeGenericRecords`.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: null,
  readStoredAuthSession: () => null,
}));
vi.mock('../supabaseAuth', () => {
  const getCurrentUser = vi.fn(async () => null);
  return {
    getCurrentUser,
    resolveCurrentUserOrNull: () => getCurrentUser().catch(() => null),
  };
});
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

import type { MealType } from '../../types';
import { addBodyWeight } from '../bodyStatsService';
import { mergeBodyWeightFromCloud } from '../bodyWeightDb';
import { mergeNutritionLogsFromCloud } from '../cloudMerge';
import { STORES, clearDatabase } from '../indexedDBCore';
import { addMealEntry } from '../nutritionService';
import { clearMutationQueue, getQueueDepth, processQueue, queueMutation } from '../offlineQueue';
import { getUnsyncedRecordCounts, markRecordUnsynced } from '../sessionDb';
import { getCurrentUser } from '../supabaseAuth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
};

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

// ── Half 1 · the replay path (offlineQueue.processQueue) ─────────────────────

describe('a successful queue replay clears the marker it was queued with', () => {
  it('stops counting a record once its queued mutation has been confirmed', async () => {
    // The offline write path leaves exactly this pair: a live local row with an
    // unsynced marker, and a queue row for the same record owned by the account
    // that wrote it. Built directly here because reproducing it through
    // syncWithRetry means waiting out three real retry backoffs.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    const entry = await addMealEntry(makeMeal());
    await clearMutationQueue();

    await markRecordUnsynced(STORES.NUTRITION_LOGS, entry.id);
    await queueMutation('nutrition:update', { id: entry.id, date: entry.date, calories: 400 });
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    await processQueue();

    // Pre-fix this read 1 — forever, on every sign-out and every offline-indicator
    // poll, for a row that is safely in the cloud.
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
    expect(await getQueueDepth()).toBe(0);
  });

  it('does NOT clear the marker when the mutation was quarantined rather than sent', async () => {
    // Queued with no resolvable account (the null-auth path), so replay refuses to
    // adopt it and moves it to the dead-letter store. Nothing reached the cloud,
    // so the warning must stay.
    const entry = await addMealEntry(makeMeal());
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    await processQueue();

    expect((await getUnsyncedRecordCounts()).total).toBe(1);
    expect(entry.id).toBeTruthy();
  });
});

// ── Half 2 · the pull path (cloudMerge.mergeGenericRecords) ──────────────────

describe('a pull clears markers for rows the cloud already holds', () => {
  it('stops counting a nutrition log the cloud sent back at the same revision', async () => {
    const entry = await addMealEntry(makeMeal());
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    // The cloud copy carries the same createdAt, so it is at the same revision.
    await mergeNutritionLogsFromCloud([{ id: entry.id, createdAt: entry.createdAt }]);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });

  it('keeps counting a nutrition log whose local copy is NEWER than the cloud one', async () => {
    const entry = await addMealEntry(makeMeal());

    await mergeNutritionLogsFromCloud([
      {
        id: entry.id,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    // The cloud is behind us, so this really is unpushed local work.
    expect((await getUnsyncedRecordCounts()).total).toBe(1);
  });

  it('stops counting a body weight row the cloud sent back ahead of local', async () => {
    const row = await addBodyWeight({ date: '2026-09-29', weight: 82.5 });
    expect((await getUnsyncedRecordCounts()).total).toBe(1);

    await mergeBodyWeightFromCloud([
      {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: '2099-01-01T00:00:00.000Z',
      },
    ]);

    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });

  it('keeps the marker for a body weight row the cloud has an older copy of', async () => {
    const row = await addBodyWeight({ date: '2026-09-29', weight: 82.5 });

    await mergeBodyWeightFromCloud([
      { id: row.id, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
    ]);

    expect((await getUnsyncedRecordCounts()).total).toBe(1);
  });
});
