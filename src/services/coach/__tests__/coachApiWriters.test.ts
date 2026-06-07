import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// A chainable client: insert/upsert resolve directly; update returns an object
// whose .eq().eq() chain resolves. We capture the payload passed to each verb so
// tests can assert the row shape (updated_by, updated_at, tombstones, …).
const mocks = vi.hoisted(() => {
  const insertResult = { error: null as { message: string } | null };
  const upsertResult = { error: null as { message: string } | null };
  const updateResult = { error: null as { message: string } | null };

  // update(...).eq(...).eq(...) → resolves to updateResult
  const mockUpdateEq2 = vi.fn(() => Promise.resolve(updateResult));
  const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }));
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }));
  const mockInsert = vi.fn(() => Promise.resolve(insertResult));
  const mockUpsert = vi.fn(() => Promise.resolve(upsertResult));
  const mockDelete = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) }));

  const lastTable = { name: '' };
  const mockFrom = vi.fn((table: string) => {
    lastTable.name = table;
    return {
      insert: mockInsert,
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete,
    };
  });

  return {
    insertResult,
    upsertResult,
    updateResult,
    mockUpdate,
    mockUpdateEq1,
    mockUpdateEq2,
    mockInsert,
    mockUpsert,
    mockDelete,
    mockFrom,
    lastTable,
  };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

// Spy on the audit write so we can assert it is invoked with the right metadata.
const writeAuditSpy = vi.fn((_args: unknown) => Promise.resolve({ error: null }));
vi.mock('../auditService', () => ({
  writeAudit: (args: unknown) => writeAuditSpy(args),
}));

// New cloud rows get UUID ids via crypto.randomUUID() (cloud id columns are
// UUID — a prefixed IndexedDB id would be rejected). Stub it deterministically.
const FIXED_UUID = '00000000-0000-4000-8000-000000000abc';

import {
  createClientSession,
  deleteClientNutritionLog,
  deleteClientSession,
  deleteClientTemplate,
  updateClientSession,
  upsertClientBodyWeight,
  upsertClientNutritionLog,
} from '../coachApi';

const CLIENT_ID = 'client-9';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertResult.error = null;
  mocks.upsertResult.error = null;
  mocks.updateResult.error = null;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(FIXED_UUID);
});

const lastCallArg = (calls: unknown[][]): Record<string, unknown> =>
  (calls.length ? calls[calls.length - 1]?.[0] : {}) as Record<string, unknown>;

/** Convenience: the row object passed to the last update(...) call. */
const lastUpdatePayload = (): Record<string, unknown> =>
  lastCallArg(mocks.mockUpdate.mock.calls as unknown[][]);

/** Convenience: the row object passed to the last upsert(...) call. */
const lastUpsertPayload = (): Record<string, unknown> =>
  lastCallArg(mocks.mockUpsert.mock.calls as unknown[][]);

/** Convenience: the row object passed to the last insert(...) call. */
const lastInsertPayload = (): Record<string, unknown> =>
  lastCallArg(mocks.mockInsert.mock.calls as unknown[][]);

// ---------------------------------------------------------------------------
// createClientSession
// ---------------------------------------------------------------------------

describe('createClientSession', () => {
  it('inserts with updated_by stamped, a fresh updated_at, and computed total_volume', async () => {
    const exercises = [
      {
        id: 'ex1',
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        targetMuscle: '',
        notes: '',
        restSeconds: 0,
        isCompleted: true,
        order: 0,
        sets: [
          {
            id: 's1',
            setNumber: 1,
            reps: 10,
            weight: 50,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: null,
          },
          {
            id: 's2',
            setNumber: 2,
            reps: 8,
            weight: 60,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: null,
          },
        ],
      },
    ];

    const res = await createClientSession(CLIENT_ID, { date: '2026-06-01', exercises });

    expect(res.error).toBeNull();
    expect(res.id).toBe(FIXED_UUID);
    const row = lastInsertPayload();
    expect(row.user_id).toBe(CLIENT_ID);
    expect(row.updated_by).toBe('coach-1');
    expect(typeof row.updated_at).toBe('string');
    // 10*50 + 8*60 = 980
    expect(row.total_volume).toBe(980);
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectUserId: CLIENT_ID,
        tableName: 'workout_sessions',
        action: 'create',
        rowId: FIXED_UUID,
      })
    );
  });

  it('returns the error and skips the audit write when insert fails', async () => {
    mocks.insertResult.error = { message: 'insert boom' };

    const res = await createClientSession(CLIENT_ID, { date: '2026-06-01', exercises: [] });

    expect(res.error).toBe('insert boom');
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateClientSession
// ---------------------------------------------------------------------------

describe('updateClientSession', () => {
  it('stamps updated_at + updated_by and recomputes total_volume from exercises', async () => {
    const exercises = [
      {
        id: 'ex1',
        exerciseId: 'ex1',
        exerciseName: 'Bench',
        targetMuscle: '',
        notes: '',
        restSeconds: 0,
        isCompleted: true,
        order: 0,
        sets: [
          {
            id: 's1',
            setNumber: 1,
            reps: 5,
            weight: 100,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: null,
          },
        ],
      },
    ];

    const res = await updateClientSession(CLIENT_ID, 'sess-1', { exercises, notes: 'good' });

    expect(res.error).toBeNull();
    const row = lastUpdatePayload();
    expect(row.updated_by).toBe('coach-1');
    expect(typeof row.updated_at).toBe('string');
    expect(row.total_volume).toBe(500);
    expect(mocks.mockUpdateEq1).toHaveBeenCalledWith('id', 'sess-1');
    expect(mocks.mockUpdateEq2).toHaveBeenCalledWith('user_id', CLIENT_ID);
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'workout_sessions', action: 'update', rowId: 'sess-1' })
    );
  });
});

// ---------------------------------------------------------------------------
// deleteClientSession — tombstone, NOT a hard delete
// ---------------------------------------------------------------------------

describe('deleteClientSession', () => {
  it('writes a tombstone (deleted_at + updated_at) via update, never calling delete()', async () => {
    const res = await deleteClientSession(CLIENT_ID, 'sess-2');

    expect(res.error).toBeNull();
    expect(mocks.mockDelete).not.toHaveBeenCalled();
    const row = lastUpdatePayload();
    expect(row.deleted_at).toEqual(expect.any(String));
    expect(row.updated_at).toEqual(expect.any(String));
    expect(row.updated_by).toBe('coach-1');
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'workout_sessions', action: 'delete', rowId: 'sess-2' })
    );
  });
});

// ---------------------------------------------------------------------------
// upsertClientNutritionLog — row shape
// ---------------------------------------------------------------------------

describe('upsertClientNutritionLog', () => {
  it('upserts a row with macro totals, meals defaulted to [], and updated_by stamped', async () => {
    const res = await upsertClientNutritionLog(CLIENT_ID, {
      date: '2026-06-02',
      calories: 2200,
      protein: 180,
    });

    expect(res.error).toBeNull();
    expect(res.id).toBe(FIXED_UUID);
    const row = lastUpsertPayload();
    expect(row.user_id).toBe(CLIENT_ID);
    expect(row.date).toBe('2026-06-02');
    expect(row.calories).toBe(2200);
    expect(row.protein).toBe(180);
    expect(row.carbs).toBeNull();
    expect(row.fat).toBeNull();
    expect(row.meals).toEqual([]);
    expect(row.updated_by).toBe('coach-1');
    expect(typeof row.updated_at).toBe('string');
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'nutrition_logs', action: 'create' })
    );
  });
});

// ---------------------------------------------------------------------------
// deleteClientNutritionLog — tombstone
// ---------------------------------------------------------------------------

describe('deleteClientNutritionLog', () => {
  it('soft-deletes via update with a deleted_at tombstone', async () => {
    const res = await deleteClientNutritionLog(CLIENT_ID, 'log-1');

    expect(res.error).toBeNull();
    expect(mocks.mockDelete).not.toHaveBeenCalled();
    const row = lastUpdatePayload();
    expect(row.deleted_at).toEqual(expect.any(String));
    expect(row.updated_by).toBe('coach-1');
  });
});

// ---------------------------------------------------------------------------
// upsertClientBodyWeight — row shape
// ---------------------------------------------------------------------------

describe('upsertClientBodyWeight', () => {
  it('upserts weight + date with updated_by/updated_at and audits the write', async () => {
    const res = await upsertClientBodyWeight(CLIENT_ID, { date: '2026-06-03', weight: 81.5 });

    expect(res.error).toBeNull();
    const row = lastUpsertPayload();
    expect(row.weight).toBe(81.5);
    expect(row.date).toBe('2026-06-03');
    expect(row.updated_by).toBe('coach-1');
    expect(typeof row.updated_at).toBe('string');
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'body_weight' })
    );
  });
});

// ---------------------------------------------------------------------------
// deleteClientTemplate — retrofitted to a tombstone + audit
// ---------------------------------------------------------------------------

describe('deleteClientTemplate', () => {
  it('tombstones the template (update, not delete) and writes an audit entry', async () => {
    const res = await deleteClientTemplate(CLIENT_ID, 'tpl-7');

    expect(res.error).toBeNull();
    expect(mocks.mockDelete).not.toHaveBeenCalled();
    const row = lastUpdatePayload();
    expect(row.deleted_at).toEqual(expect.any(String));
    expect(row.updated_at).toEqual(expect.any(String));
    expect(row.updated_by).toBe('coach-1');
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'workout_templates', action: 'delete', rowId: 'tpl-7' })
    );
  });
});
