import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase reader mock ─────────────────────────────────────────────────────
// A chainable query builder where every filter/order/limit method returns `this`
// and the chain is awaitable (thenable), resolving to { data, error }. We record
// each `.is(column, value)` call so a test can assert the soft-delete read filter
// `.is('deleted_at', null)` is applied — without it, tombstoned rows resurrect in
// the coach roster, charts and analytics.
const mocks = vi.hoisted(() => {
  const state = {
    rows: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
    isCalls: [] as Array<[string, unknown]>,
  };

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const passthrough = () => builder;
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) {
      builder[method] = vi.fn(passthrough);
    }
    builder.is = vi.fn((column: string, value: unknown) => {
      state.isCalls.push([column, value]);
      return builder;
    });
    // Make the chain awaitable: resolves to the Supabase { data, error } envelope.
    builder.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: state.rows, error: state.error });
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  return { state, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

import {
  getClientBodyWeight,
  getClientMeasurements,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  getClientTemplates,
  getClientsActivity,
} from '../coachApi';

const CLIENT_ID = 'client-9';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.rows = [];
  mocks.state.error = null;
  mocks.state.isCalls = [];
});

/** True when the reader applied the soft-delete read filter. */
const appliedSoftDeleteFilter = (): boolean =>
  mocks.state.isCalls.some(([col, val]) => col === 'deleted_at' && val === null);

describe('coachApi reads exclude tombstoned (soft-deleted) rows', () => {
  it('getClientSessions filters deleted_at IS NULL', async () => {
    await getClientSessions(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
  });

  it('getClientsActivity filters deleted_at IS NULL', async () => {
    await getClientsActivity([CLIENT_ID]);
    expect(appliedSoftDeleteFilter()).toBe(true);
  });

  it('getClientTemplates filters deleted_at IS NULL', async () => {
    await getClientTemplates(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
  });

  it('getClientBodyWeight filters deleted_at IS NULL and maps notes', async () => {
    mocks.state.rows = [
      { id: 'w1', weight: 80, date: '2026-06-01', notes: 'morning', created_at: 'x' },
    ];
    const out = await getClientBodyWeight(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
    expect(out[0]?.notes).toBe('morning');
  });

  it('getClientPRs filters deleted_at IS NULL and maps updatedAt', async () => {
    mocks.state.rows = [
      {
        id: 'p1',
        exercise_id: 'e1',
        exercise_name: 'Squat',
        weight: 100,
        reps: 5,
        date: '2026-06-01',
        record_type: 'weight',
        created_at: 'x',
        updated_at: 'y',
      },
    ];
    const out = await getClientPRs(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
    expect(out[0]?.updatedAt).toBe('y');
  });

  it('getClientNutrition filters deleted_at IS NULL and maps updatedAt', async () => {
    mocks.state.rows = [
      { id: 'n1', date: '2026-06-01', calories: 2000, meals: [], created_at: 'x', updated_at: 'y' },
    ];
    const out = await getClientNutrition(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
    expect(out[0]?.updatedAt).toBe('y');
  });

  it('getClientMeasurements filters deleted_at IS NULL and maps updatedAt', async () => {
    mocks.state.rows = [
      { id: 'm1', date: '2026-06-01', measurements: {}, created_at: 'x', updated_at: 'y' },
    ];
    const out = await getClientMeasurements(CLIENT_ID);
    expect(appliedSoftDeleteFilter()).toBe(true);
    expect(out[0]?.updatedAt).toBe('y');
  });
});

describe('coachApi readers surface failures instead of fake empties', () => {
  it('getClientsActivity throws on a db error (no fake "all calm" map)', async () => {
    mocks.state.error = { message: 'activity boom' };
    await expect(getClientsActivity([CLIENT_ID])).rejects.toThrow('activity boom');
  });

  it('getClientBodyWeight throws with throwOnError and returns [] without it', async () => {
    mocks.state.error = { message: 'weights boom' };
    await expect(getClientBodyWeight(CLIENT_ID, { throwOnError: true })).rejects.toThrow(
      'weights boom'
    );
    await expect(getClientBodyWeight(CLIENT_ID)).resolves.toEqual([]);
  });

  it('getClientPRs throws with throwOnError and returns [] without it', async () => {
    mocks.state.error = { message: 'prs boom' };
    await expect(getClientPRs(CLIENT_ID, { throwOnError: true })).rejects.toThrow('prs boom');
    await expect(getClientPRs(CLIENT_ID)).resolves.toEqual([]);
  });

  it('getClientMeasurements throws with throwOnError and returns [] without it', async () => {
    mocks.state.error = { message: 'measurements boom' };
    await expect(getClientMeasurements(CLIENT_ID, { throwOnError: true })).rejects.toThrow(
      'measurements boom'
    );
    await expect(getClientMeasurements(CLIENT_ID)).resolves.toEqual([]);
  });
});
