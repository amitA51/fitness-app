import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// vi.mock factories are hoisted — top-level `const` cannot be referenced.
// We use vi.hoisted() to declare the mock fns before the hoist boundary.
const mocks = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockSingle = vi.fn();
  const mockSelectAfterInsert = vi.fn(() => ({ single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelectAfterInsert }));
  const mockEq = vi.fn();
  const mockDelete = vi.fn(() => ({ eq: mockEq }));
  const mockSelect = vi.fn(() => ({ order: mockOrder }));
  const mockFrom = vi.fn((_table: string) => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  }));

  return {
    mockOrder,
    mockSingle,
    mockSelectAfterInsert,
    mockInsert,
    mockEq,
    mockDelete,
    mockSelect,
    mockFrom,
  };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-abc' })),
}));

import { isSupabaseConfigured } from '../../../lib/supabase';
import {
  deleteProgramTemplate,
  listProgramTemplates,
  saveProgramTemplate,
} from '../programTemplateService';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);

// Sample day used across multiple tests
const sampleDay = {
  name: 'יום A',
  exercises: [
    {
      exerciseName: 'Squat',
      exerciseId: 'ex-1',
      targetMuscle: 'Legs',
      sets: 3,
      reps: 10,
    },
  ],
};

// Row returned by Supabase for a saved template
const dbRow = {
  id: 'tpl-1',
  coach_id: 'coach-abc',
  name: 'Full Body',
  description: 'A solid starter program',
  days: [sampleDay],
  created_at: '2026-06-07T10:00:00Z',
  updated_at: '2026-06-07T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// listProgramTemplates
// ---------------------------------------------------------------------------

describe('listProgramTemplates', () => {
  it('returns [] when Supabase is not configured (offline)', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await listProgramTemplates();

    expect(result).toEqual([]);
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('returns [] on a Supabase query error (graceful)', async () => {
    mocks.mockOrder.mockResolvedValue({ data: null, error: { message: 'network error' } });

    const result = await listProgramTemplates();

    expect(result).toEqual([]);
  });

  it('returns mapped templates when the query succeeds', async () => {
    mocks.mockOrder.mockResolvedValue({ data: [dbRow], error: null });

    const result = await listProgramTemplates();

    expect(result).toHaveLength(1);
    const tpl = result[0]!;
    expect(tpl.id).toBe('tpl-1');
    expect(tpl.coachId).toBe('coach-abc');
    expect(tpl.name).toBe('Full Body');
    expect(tpl.description).toBe('A solid starter program');
    expect(tpl.days).toEqual([sampleDay]);
    expect(tpl.createdAt).toBe('2026-06-07T10:00:00Z');
  });
});

// ---------------------------------------------------------------------------
// saveProgramTemplate — validation
// ---------------------------------------------------------------------------

describe('saveProgramTemplate — validation', () => {
  it('throws when name is empty without calling insert', async () => {
    await expect(saveProgramTemplate({ name: '   ', days: [sampleDay] })).rejects.toThrow();

    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it('throws when days array is empty without calling insert', async () => {
    await expect(saveProgramTemplate({ name: 'My Program', days: [] })).rejects.toThrow();

    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// saveProgramTemplate — successful insert
// ---------------------------------------------------------------------------

describe('saveProgramTemplate — insert', () => {
  it('sends snake_case row with coach_id and days, returns mapped template', async () => {
    mocks.mockSingle.mockResolvedValue({ data: dbRow, error: null });

    const result = await saveProgramTemplate({
      name: 'Full Body',
      description: 'A solid starter program',
      days: [sampleDay],
    });

    // Verify insert was called with correct snake_case shape
    expect(mocks.mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        coach_id: 'coach-abc',
        name: 'Full Body',
        description: 'A solid starter program',
        days: [sampleDay],
      })
    );

    // Verify camelCase keys are NOT present in the insert payload
    const insertPayload = (mocks.mockInsert.mock.calls as unknown as unknown[][])[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload).not.toHaveProperty('coachId');
    expect(insertPayload).not.toHaveProperty('createdAt');

    // Verify the return value is correctly mapped
    expect(result.id).toBe('tpl-1');
    expect(result.coachId).toBe('coach-abc');
    expect(result.name).toBe('Full Body');
    expect(result.days).toEqual([sampleDay]);
  });

  it('trims whitespace from name before inserting', async () => {
    mocks.mockSingle.mockResolvedValue({ data: { ...dbRow, name: 'Full Body' }, error: null });

    await saveProgramTemplate({ name: '  Full Body  ', days: [sampleDay] });

    const insertPayload = (mocks.mockInsert.mock.calls as unknown as unknown[][])[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload.name).toBe('Full Body');
  });

  it('throws on Supabase insert error', async () => {
    mocks.mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    await expect(saveProgramTemplate({ name: 'My Program', days: [sampleDay] })).rejects.toThrow(
      'insert failed'
    );
  });
});

// ---------------------------------------------------------------------------
// deleteProgramTemplate
// ---------------------------------------------------------------------------

describe('deleteProgramTemplate', () => {
  it('returns {error:null} on successful delete', async () => {
    mocks.mockEq.mockResolvedValue({ error: null });

    const result = await deleteProgramTemplate('tpl-1');

    expect(result).toEqual({ error: null });
    expect(mocks.mockEq).toHaveBeenCalledWith('id', 'tpl-1');
  });

  it('returns {error:<message>} on Supabase delete error', async () => {
    mocks.mockEq.mockResolvedValue({ error: { message: 'delete failed' } });

    const result = await deleteProgramTemplate('tpl-1');

    expect(result).toEqual({ error: 'delete failed' });
  });

  it('returns {error:<offline message>} when Supabase is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await deleteProgramTemplate('tpl-1');

    expect(result.error).not.toBeNull();
    expect(mocks.mockEq).not.toHaveBeenCalled();
  });
});
