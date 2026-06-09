import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockRpc = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

import { supabase } from '../../../lib/supabase';
import { setGroupMembers } from '../groupService';

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('setGroupMembers (atomic RPC)', () => {
  it('calls the set_group_members RPC with the group id and member ids', async () => {
    const result = await setGroupMembers('g-1', ['c1', 'c2']);

    expect(mockRpc).toHaveBeenCalledWith('set_group_members', {
      _group_id: 'g-1',
      _client_ids: ['c1', 'c2'],
    });
    expect(result).toEqual({ error: null });
  });

  it('passes an empty array to clear all members (never a partial table op)', async () => {
    await setGroupMembers('g-1', []);

    expect(mockRpc).toHaveBeenCalledWith('set_group_members', {
      _group_id: 'g-1',
      _client_ids: [],
    });
  });

  it('surfaces the RPC error message on failure', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not_group_owner' } });

    const result = await setGroupMembers('g-1', ['c1']);

    expect(result).toEqual({ error: 'not_group_owner' });
  });

  it('never issues direct table reads/writes (atomicity lives server-side)', async () => {
    await setGroupMembers('g-1', ['c1']);

    expect(vi.mocked(supabase!.from)).not.toHaveBeenCalled();
  });
});
