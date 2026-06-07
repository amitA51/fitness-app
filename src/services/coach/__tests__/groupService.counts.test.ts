import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockIn = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ in: mockIn })),
    })),
  },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-123' })),
}));

import { supabase } from '../../../lib/supabase';
import { getGroupMemberCounts } from '../groupService';

beforeEach(() => {
  vi.clearAllMocks();
  mockIn.mockResolvedValue({ data: [], error: null });
});

describe('getGroupMemberCounts', () => {
  it('returns an empty Map when called with no group ids', async () => {
    const result = await getGroupMemberCounts([]);
    expect(result).toEqual(new Map());
    expect(vi.mocked(supabase!.from)).not.toHaveBeenCalled();
  });

  it('returns correct counts from batched rows', async () => {
    mockIn.mockResolvedValue({
      data: [{ group_id: 'g1' }, { group_id: 'g1' }, { group_id: 'g2' }],
      error: null,
    });

    const result = await getGroupMemberCounts(['g1', 'g2', 'g3']);

    expect(result.get('g1')).toBe(2);
    expect(result.get('g2')).toBe(1);
    expect(result.get('g3')).toBeUndefined();
  });

  it('queries the client_group_members table with the provided ids', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });

    await getGroupMemberCounts(['g1', 'g2']);

    expect(vi.mocked(supabase!.from)).toHaveBeenCalledWith('client_group_members');
    expect(mockIn).toHaveBeenCalledWith('group_id', ['g1', 'g2']);
  });

  it('returns an empty Map on supabase error (graceful degradation)', async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await getGroupMemberCounts(['g1']);

    expect(result).toEqual(new Map());
  });

  it('returns an empty Map when all rows are absent (zero members)', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });

    const result = await getGroupMemberCounts(['g1', 'g2']);

    expect(result.size).toBe(0);
  });
});
