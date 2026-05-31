import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../supabaseSync', () => ({
  syncPersonalExercise: vi.fn(),
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import { mergeGenericRecords } from '../cloudMerge';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';

beforeEach(async () => {
  await clearDatabase();
});
afterEach(async () => {
  await clearDatabase();
});

describe('DA-7: Tombstone / soft-delete propagation', () => {
  it('cloud record with deletedAt removes existing local record on merge', async () => {
    // Setup: local record exists
    await dbPut(STORES.PERSONAL_EXERCISES, {
      id: 'ex1',
      name: 'Bench Press',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    // Merge: cloud sends tombstone
    const result = await mergeGenericRecords(STORES.PERSONAL_EXERCISES, [
      {
        id: 'ex1',
        name: 'Bench Press',
        deletedAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ]);

    expect(result.deleted).toBe(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);

    const remaining = await dbGetAll(STORES.PERSONAL_EXERCISES);
    expect(remaining).toHaveLength(0);
  });

  it('cloud tombstone for non-existent local record is a no-op', async () => {
    const result = await mergeGenericRecords(STORES.PERSONAL_EXERCISES, [
      {
        id: 'ghost',
        name: 'Ghost',
        deletedAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ]);

    expect(result.deleted).toBe(0);
    expect(result.added).toBe(0);
  });

  it('non-tombstoned records still merge normally alongside tombstones', async () => {
    await dbPut(STORES.PERSONAL_EXERCISES, {
      id: 'ex1',
      name: 'Bench Press',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const result = await mergeGenericRecords(STORES.PERSONAL_EXERCISES, [
      { id: 'ex1', deletedAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
      {
        id: 'ex2',
        name: 'Squat',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      },
    ]);

    expect(result.deleted).toBe(1);
    expect(result.added).toBe(1);

    const remaining = await dbGetAll(STORES.PERSONAL_EXERCISES);
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as { id: string }).id).toBe('ex2');
  });

  it('deletedAt=null is treated as a normal (non-deleted) record', async () => {
    const result = await mergeGenericRecords(STORES.PERSONAL_EXERCISES, [
      {
        id: 'ex3',
        name: 'Deadlift',
        deletedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);

    expect(result.added).toBe(1);
    expect(result.deleted).toBe(0);
  });
});
