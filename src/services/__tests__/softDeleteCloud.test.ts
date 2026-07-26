import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression guard for the tombstone-delete fix: deleting a synced record must
// issue a targeted `UPDATE ... SET deleted_at` (soft delete, house pattern —
// see waterService.deleteCloudWaterEntry), NOT a physical `.delete()`. A hard
// delete is simply re-inserted by other devices on their next push, and the
// old empty-field tombstone upsert (date/startTime: '') failed Postgres
// timestamp validation (22007), losing the deletion entirely.

// ── Supabase mock ────────────────────────────────────────────────────────────
const { fromSpy, updateSpy, deleteSpy, eqIdSpy, eqUserSpy } = vi.hoisted(() => {
  const eqUserSpy = vi.fn(async (..._args: unknown[]) => ({
    error: null as { message: string } | null,
  }));
  const eqIdSpy = vi.fn((..._args: unknown[]) => ({ eq: eqUserSpy }));
  const updateSpy = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqIdSpy }));
  const deleteSpy = vi.fn(() => ({ eq: eqIdSpy }));
  const fromSpy = vi.fn((_table: string) => ({ update: updateSpy, delete: deleteSpy }));
  return { fromSpy, updateSpy, deleteSpy, eqIdSpy, eqUserSpy };
});

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: fromSpy },
}));

import {
  deleteCloudBodyMeasurement,
  deleteCloudBodyWeight,
  deleteCloudNutritionLog,
  deleteCloudPersonalExercise,
  deleteCloudPersonalRecord,
  deleteCloudRecoveryLog,
  deleteCloudWorkoutSession,
  deleteCloudWorkoutTemplate,
} from '../supabaseSync';

const cases: Array<{
  name: string;
  table: string;
  fn: (userId: string, id: string) => Promise<void>;
}> = [
  { name: 'deleteCloudWorkoutSession', table: 'workout_sessions', fn: deleteCloudWorkoutSession },
  { name: 'deleteCloudBodyWeight', table: 'body_weight', fn: deleteCloudBodyWeight },
  { name: 'deleteCloudRecoveryLog', table: 'recovery_logs', fn: deleteCloudRecoveryLog },
  { name: 'deleteCloudNutritionLog', table: 'nutrition_logs', fn: deleteCloudNutritionLog },
  // Converted from physical `.delete()` — a hard delete left no tombstone, so a
  // device that was offline during the deletion re-inserted the row on its next
  // push and the user's deletion silently reverted.
  {
    name: 'deleteCloudWorkoutTemplate',
    table: 'workout_templates',
    fn: deleteCloudWorkoutTemplate,
  },
  {
    name: 'deleteCloudPersonalExercise',
    table: 'personal_exercises',
    fn: deleteCloudPersonalExercise,
  },
  {
    name: 'deleteCloudBodyMeasurement',
    table: 'body_measurements',
    fn: deleteCloudBodyMeasurement,
  },
  { name: 'deleteCloudPersonalRecord', table: 'personal_records', fn: deleteCloudPersonalRecord },
];

beforeEach(() => {
  vi.clearAllMocks();
  eqUserSpy.mockResolvedValue({ error: null });
});

describe.each(cases)('$name — soft delete', ({ table, fn }) => {
  it(`stamps deleted_at on ${table} instead of hard-deleting the row`, async () => {
    // Act
    await fn('user-1', 'rec-1');

    // Assert — targeted UPDATE, scoped to id + owner; never a physical delete.
    expect(fromSpy).toHaveBeenCalledWith(table);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const payload = updateSpy.mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(typeof payload.deleted_at).toBe('string');
    expect(Number.isNaN(Date.parse(payload.deleted_at as string))).toBe(false);
    expect(eqIdSpy).toHaveBeenCalledWith('id', 'rec-1');
    expect(eqUserSpy).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws when the update reports an error', async () => {
    eqUserSpy.mockResolvedValue({ error: { message: 'boom' } });
    await expect(fn('user-1', 'rec-1')).rejects.toBeTruthy();
  });
});
