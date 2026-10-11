// ============================================================================
// T-132 — DEFECT #4 (a restore nobody can see) and DEFECT #6 (water_settings).
// ============================================================================
// #4: `importFullBackup` writes up to 50,000 rows per store across ten stores
// plus the localStorage settings and used to schedule NOTHING — no queue row, no
// marker, no push. A restore is the one moment the user has explicitly said
// "this data matters", and it landed outside every defence: the sign-out guard
// counted zero, and the wipe destroyed the whole restore. The fix marks the
// restored rows in the unsynced ledger (not 50,000 queue rows — the bulk push is
// what that is for) and returns them so the caller can push once.
//
// #6: `water_settings` is in USER_SCOPED_STORAGE_REGISTRY.localStorageKeys (so
// `clearUserScopedLocalData` deletes it) but was absent from
// MIRRORED_LOCAL_KEYS, so a custom hydration goal reverted to the default on an
// account switch with no copy anywhere.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true, supabase: null }));
vi.mock('../supabaseAuth', () => {
  const getCurrentUser = vi.fn(async () => null);
  return {
    getCurrentUser,
    resolveCurrentUserOrNull: () => getCurrentUser().catch(() => null),
  };
});

const mirrorLocalKeySpy = vi.fn();
vi.mock('../localStateMirror', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localStateMirror')>();
  return {
    ...actual,
    mirrorLocalKey: (key: string) => mirrorLocalKeySpy(key),
  };
});

import { WATER_SETTINGS_KEY } from '../../constants/nutrition';
import { STORES, clearDatabase, dbGetAll } from '../indexedDBCore';
import { MIRRORED_LOCAL_KEYS } from '../localStateMirror';
import { clearMutationQueue, getQueueDepth } from '../offlineQueue';
import { getUnsyncedRecordCounts } from '../sessionDb';
import { importFullBackup } from '../settingsService';
import { USER_SCOPED_STORAGE_REGISTRY } from '../userScopedLocalData';
import { getWaterSettings, saveWaterSettings } from '../waterService';

const backupWith = (data: Record<string, unknown[]>, settings: Record<string, string> = {}) =>
  JSON.stringify({ version: '1', exportDate: '2026-09-29T10:00:00.000Z', data, settings });

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

afterEach(async () => {
  localStorage.clear();
  await clearDatabase();
  await clearMutationQueue();
});

// ── DEFECT #4 ───────────────────────────────────────────────────────────────

describe('importFullBackup makes the restore visible to the sync defences', () => {
  it('marks every restored row in a ledgered store as unsynced', async () => {
    const result = await importFullBackup(
      backupWith({
        nutritionLogs: [
          { id: 'meal-1', date: '2026-09-20', createdAt: '2026-09-20T08:00:00.000Z' },
          { id: 'meal-2', date: '2026-09-21', createdAt: '2026-09-21T08:00:00.000Z' },
        ],
        bodyWeight: [{ id: 'bw-1', date: '2026-09-20', weight: 81 }],
      })
    );

    expect(result.records).toBe(3);
    // Pre-fix this read 0: the sign-out guard told the user there was nothing to
    // lose, and the wipe took all three rows.
    expect((await getUnsyncedRecordCounts()).total).toBe(3);
    expect(result.written).toHaveLength(3);
  });

  it('counts a restored workout as a workout, which is what the sign-out copy names', async () => {
    await importFullBackup(
      backupWith({
        sessions: [{ id: 'sess-1', date: '2026-09-20', startTime: '2026-09-20T10:00:00.000Z' }],
      })
    );

    expect((await getUnsyncedRecordCounts()).sessions).toBe(1);
  });

  it('does NOT mark stores that are marker-less by design', async () => {
    // PRs, personal exercises, AI conversations and mirrored settings have no
    // clear-on-pull, so a marker there would warn forever — DEFECT #3's shape.
    const result = await importFullBackup(
      backupWith({
        personalRecords: [{ id: 'pr-1', exerciseName: 'לחיצת חזה', weight: 100 }],
        aiConversations: [{ id: 'conv-1', title: 'שיחה', messages: [] }],
      })
    );

    expect(result.records).toBe(2);
    expect(result.written).toHaveLength(0);
    expect((await getUnsyncedRecordCounts()).total).toBe(0);
  });

  it('does not enqueue one mutation per restored row', async () => {
    await importFullBackup(
      backupWith({
        nutritionLogs: Array.from({ length: 25 }, (_, i) => ({
          id: `meal-${i}`,
          date: '2026-09-20',
        })),
      })
    );

    // 50,000 rows is what the single bulk push is for.
    expect(await getQueueDepth()).toBe(0);
    expect(await dbGetAll(STORES.NUTRITION_LOGS)).toHaveLength(25);
  });

  it('still restores the localStorage settings half', async () => {
    const result = await importFullBackup(
      backupWith({}, { nutritionGoals: JSON.stringify({ calories: 2200 }) })
    );

    expect(result.settings).toBe(1);
    expect(localStorage.getItem('nutrition_goals')).toBe(JSON.stringify({ calories: 2200 }));
  });
});

// ── DEFECT #6 ───────────────────────────────────────────────────────────────

describe('water_settings survives an account switch', () => {
  it('is registered for cloud mirroring', () => {
    // The pairing that was broken: the key is wiped on an account switch, so it
    // must also be mirrored.
    expect(USER_SCOPED_STORAGE_REGISTRY.localStorageKeys).toContain(WATER_SETTINGS_KEY);
    expect(MIRRORED_LOCAL_KEYS as readonly string[]).toContain(WATER_SETTINGS_KEY);
  });

  it('mirrors the key on every save, the way saveNutritionGoals does', () => {
    saveWaterSettings({ goalMl: 3200, glassMl: 330 });

    expect(mirrorLocalKeySpy).toHaveBeenCalledWith(WATER_SETTINGS_KEY);
    // The local write is still the synchronous source of truth.
    expect(getWaterSettings()).toEqual({ goalMl: 3200, glassMl: 330 });
  });
});
