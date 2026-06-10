import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks for deleteAllUserData (cloud purge + queue clear + local wipe) ─────
const { fromSpy, deleteEqSpy, dbClearSpy, getCurrentUserSpy, clearMutationQueueSpy } = vi.hoisted(
  () => {
    const deleteEqSpy = vi.fn(async () => ({ error: null as { message: string } | null }));
    return {
      fromSpy: vi.fn((_table: string) => ({ delete: vi.fn(() => ({ eq: deleteEqSpy })) })),
      deleteEqSpy,
      dbClearSpy: vi.fn(async () => {}),
      getCurrentUserSpy: vi.fn(async (): Promise<{ id: string } | null> => null),
      clearMutationQueueSpy: vi.fn(async () => {}),
    };
  }
);

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: fromSpy },
}));
vi.mock('../indexedDBCore', () => ({
  STORES: { WORKOUT_SESSIONS: 'workout_sessions', NUTRITION_LOGS: 'nutrition_logs' },
  dbClear: dbClearSpy,
  dbGetAll: vi.fn(async () => []),
}));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: getCurrentUserSpy }));
vi.mock('../offlineQueue', () => ({ clearMutationQueue: clearMutationQueueSpy }));
vi.mock('../exportService', () => ({ exportWorkoutHistoryCSV: vi.fn() }));

import { computeMacrosFromProfile, deleteAllUserData } from '../settingsService';

describe('settingsService', () => {
  describe('computeMacrosFromProfile', () => {
    it('returns correct macros for a standard male profile', () => {
      const result = computeMacrosFromProfile({
        weightKg: 80,
        heightCm: 180,
        age: 30,
        gender: 'male',
        activityLevel: 'פעיל מתון',
        weightGoal: 'שמירה על משקל',
      });
      expect(result.calories).toBeGreaterThan(0);
      expect(result.protein).toBeGreaterThan(0);
      expect(result.carbs).toBeGreaterThan(0);
      expect(result.fat).toBeGreaterThan(0);
      // Macros should sum close to calories (rounding may cause ±1)
      const macroCalories = result.protein * 4 + result.carbs * 4 + result.fat * 9;
      expect(Math.abs(macroCalories - result.calories)).toBeLessThanOrEqual(1);
    });

    it('returns lower calories for weight loss goal', () => {
      const base = {
        weightKg: 70,
        heightCm: 175,
        age: 25,
        gender: 'male' as const,
        activityLevel: 'פעיל מתון',
      };
      const maintain = computeMacrosFromProfile({ ...base, weightGoal: 'שמירה על משקל' });
      const lose = computeMacrosFromProfile({ ...base, weightGoal: 'ירידה במשקל' });
      expect(lose.calories).toBeLessThan(maintain.calories);
    });

    it('returns higher calories for bulk goal', () => {
      const base = {
        weightKg: 70,
        heightCm: 175,
        age: 25,
        gender: 'male' as const,
        activityLevel: 'פעיל מתון',
      };
      const maintain = computeMacrosFromProfile({ ...base, weightGoal: 'שמירה על משקל' });
      const bulk = computeMacrosFromProfile({ ...base, weightGoal: 'עלייה במסה' });
      expect(bulk.calories).toBeGreaterThan(maintain.calories);
    });

    it('handles zero/invalid inputs gracefully', () => {
      const result = computeMacrosFromProfile({
        weightKg: 0,
        heightCm: 0,
        age: 0,
        gender: 'male',
        activityLevel: 'פעיל מתון',
        weightGoal: 'שמירה על משקל',
      });
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });
  });

  describe('deleteAllUserData', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      deleteEqSpy.mockResolvedValue({ error: null });
      getCurrentUserSpy.mockResolvedValue({ id: 'user-1' });
    });

    it('purges each cloud table with ONE bulk delete keyed by user_id (no per-row N+1)', async () => {
      await deleteAllUserData();

      const tables = fromSpy.mock.calls.map((c) => c[0]);
      expect(tables).toEqual(
        expect.arrayContaining([
          'workout_templates',
          'workout_sessions',
          'personal_exercises',
          'body_weight',
          'body_measurements',
          'personal_records',
          'recovery_logs',
          'nutrition_logs',
          'user_settings',
          'ai_conversations',
          'water_logs',
        ])
      );
      // Exactly one delete per table — no fetch-then-delete-by-id storm.
      expect(fromSpy).toHaveBeenCalledTimes(11);
      expect(deleteEqSpy).toHaveBeenCalledTimes(11);
      for (const call of deleteEqSpy.mock.calls as unknown as [string, string][]) {
        expect(call).toEqual(['user_id', 'user-1']);
      }
    });

    it('clears the offline mutation queue so replays cannot re-create deleted data', async () => {
      await deleteAllUserData();
      expect(clearMutationQueueSpy).toHaveBeenCalledTimes(1);
    });

    it('aborts BEFORE wiping local data when a cloud purge fails', async () => {
      deleteEqSpy.mockResolvedValue({ error: { message: 'rls denied' } });

      await expect(deleteAllUserData()).rejects.toThrow();
      expect(dbClearSpy).not.toHaveBeenCalled();
    });

    it('still wipes local data when signed out (no cloud purge)', async () => {
      getCurrentUserSpy.mockResolvedValue(null);

      await deleteAllUserData();

      expect(fromSpy).not.toHaveBeenCalled();
      expect(dbClearSpy).toHaveBeenCalled();
    });
  });
});
