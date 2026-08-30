import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// Chainable, awaitable builder (same shape as coachListReaders.throw.test.ts).
// `mockFrom` is the network assertion surface: these tests pin that a SIGNED-OUT
// caller never reaches it, so a guest issues no request (and takes no 401) —
// asserting only on the returned [] would also pass against the unguarded code.
const mocks = vi.hoisted(() => {
  const resultQueue: Array<{ data?: unknown; error: unknown }> = [];

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of ['select', 'eq', 'order']) {
      builder[method] = vi.fn(chain);
    }
    // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(resultQueue.shift() ?? { data: [], error: null });
    return builder;
  }

  const mockFrom = vi.fn(() => makeBuilder());
  return { resultQueue, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'trainee-1' })),
}));

vi.mock('../pushService', () => ({
  sendCoachPush: vi.fn(),
}));

import { getCurrentUser } from '../../supabaseAuth';
import { listMyAssignments } from '../assignmentService';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const assignmentRow = {
  id: 'a1',
  coach_id: 'coach-1',
  client_id: 'trainee-1',
  group_id: null,
  kind: 'program',
  title: 'תוכנית A',
  payload: {},
  template_id: 't1',
  schedule: null,
  status: 'active',
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resultQueue.length = 0;
  mockGetCurrentUser.mockResolvedValue({ id: 'trainee-1' } as never);
});

describe('listMyAssignments auth guard', () => {
  it('issues NO request for a signed-out caller and returns []', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(listMyAssignments()).resolves.toEqual([]);
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('still returns the assignments of a signed-in caller', async () => {
    mocks.resultQueue.push({ data: [assignmentRow], error: null });

    const out = await listMyAssignments();

    expect(mocks.mockFrom).toHaveBeenCalledWith('assignments');
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a1');
    expect(out[0]?.templateId).toBe('t1');
  });
});
