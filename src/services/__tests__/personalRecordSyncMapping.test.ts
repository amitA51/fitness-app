import { beforeEach, describe, expect, it, vi } from 'vitest';

// personal_records.exercise_id is a uuid column with an FK to
// personal_exercises(id), but local PR identity is the NORMALIZED EXERCISE
// NAME (prService.stableExerciseKey). Pushing the name string 400s with 22P02
// and the record is silently dropped. The sync mapping must therefore null
// non-UUID exercise_id values on push, and the pull must derive the local
// identity from exercise_name so name-keyed IDB index lookups keep working.

const upsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => ({
      upsert: (row: Record<string, unknown>) => upsertSpy(row),
    }),
  },
}));

const fetchAllPagesMock = vi.fn(async () => [] as Record<string, unknown>[]);
vi.mock('../supabaseSyncPagination', () => ({
  fetchAllPages: (...args: unknown[]) => fetchAllPagesMock(...(args as [])),
}));

const VALID_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const baseRecord = {
  id: '99999999-8888-4777-a666-555555555555',
  exerciseName: 'לחיצת חזה | Bench Press',
  weight: 100,
  reps: 5,
  date: '2026-06-09',
  recordType: 'weight' as const,
  createdAt: '2026-06-09T10:00:00.000Z',
};

beforeEach(() => {
  upsertSpy.mockClear();
  fetchAllPagesMock.mockReset();
  fetchAllPagesMock.mockResolvedValue([]);
});

describe('syncPersonalRecord — exercise_id push mapping', () => {
  it('nulls a normalized-name exerciseId (not UUID-shaped) instead of 22P02ing', async () => {
    const { syncPersonalRecord } = await import('../supabaseSync');

    await syncPersonalRecord('user-1', {
      ...baseRecord,
      exerciseId: 'לחיצת חזה | bench press',
    });

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const row = upsertSpy.mock.calls[0]![0];
    expect(row.exercise_id).toBeNull();
    // Name identity still rides in exercise_name.
    expect(row.exercise_name).toBe('לחיצת חזה | Bench Press');
  });

  it('passes through a UUID-shaped exerciseId (legacy rows)', async () => {
    const { syncPersonalRecord } = await import('../supabaseSync');

    await syncPersonalRecord('user-1', { ...baseRecord, exerciseId: VALID_UUID });

    const row = upsertSpy.mock.calls[0]![0];
    expect(row.exercise_id).toBe(VALID_UUID);
  });
});

describe('fetchPersonalRecords — pull tolerates null exercise_id', () => {
  it('derives the local exerciseId from the normalized exercise_name when exercise_id is null', async () => {
    fetchAllPagesMock.mockResolvedValue([
      {
        id: baseRecord.id,
        exercise_id: null,
        exercise_name: '  לחיצת חזה |  Bench Press ',
        weight: 100,
        reps: 5,
        date: '2026-06-09',
        record_type: 'weight',
        created_at: baseRecord.createdAt,
        updated_at: baseRecord.createdAt,
        deleted_at: null,
      },
    ]);
    const { fetchPersonalRecords } = await import('../supabaseSync');

    const rows = await fetchPersonalRecords('user-1');

    // Same normalization as prService.stableExerciseKey: trim, collapse
    // whitespace, lowercase — so name-keyed IDB lookups find this record.
    expect(rows[0]?.exerciseId).toBe('לחיצת חזה | bench press');
  });

  it('prefers the name identity even when a legacy uuid exercise_id exists', async () => {
    fetchAllPagesMock.mockResolvedValue([
      {
        id: baseRecord.id,
        exercise_id: VALID_UUID,
        exercise_name: 'Bench Press',
        weight: 100,
        reps: 5,
        date: '2026-06-09',
        record_type: 'weight',
        created_at: baseRecord.createdAt,
        updated_at: baseRecord.createdAt,
        deleted_at: null,
      },
    ]);
    const { fetchPersonalRecords } = await import('../supabaseSync');

    const rows = await fetchPersonalRecords('user-1');

    expect(rows[0]?.exerciseId).toBe('bench press');
  });

  it('falls back to exercise_id, then row id, when the name is empty', async () => {
    fetchAllPagesMock.mockResolvedValue([
      {
        id: baseRecord.id,
        exercise_id: VALID_UUID,
        exercise_name: '   ',
        weight: 100,
        reps: 5,
        date: '2026-06-09',
        record_type: 'weight',
        created_at: baseRecord.createdAt,
        updated_at: baseRecord.createdAt,
        deleted_at: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000001',
        exercise_id: null,
        exercise_name: '',
        weight: 50,
        reps: 8,
        date: '2026-06-08',
        record_type: 'weight',
        created_at: baseRecord.createdAt,
        updated_at: baseRecord.createdAt,
        deleted_at: null,
      },
    ]);
    const { fetchPersonalRecords } = await import('../supabaseSync');

    const rows = await fetchPersonalRecords('user-1');

    expect(rows[0]?.exerciseId).toBe(VALID_UUID);
    expect(rows[1]?.exerciseId).toBe('00000000-0000-4000-8000-000000000001');
  });
});
