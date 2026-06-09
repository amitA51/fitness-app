import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────
// We need a chainable builder that resolves at the terminal call.
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

const chainable: Record<string, unknown> = {};
chainable.select = mockSelect;
chainable.insert = mockInsert;
chainable.update = mockUpdate;
chainable.eq = mockEq;
chainable.in = mockIn;
chainable.order = mockOrder;
chainable.limit = mockLimit;
chainable.single = mockSingle;

// Each chain method returns the same chainable object by default.
mockSelect.mockReturnValue(chainable);
mockInsert.mockResolvedValue({ error: null });
mockUpdate.mockReturnValue(chainable);
mockEq.mockReturnValue(chainable);
mockIn.mockReturnValue(chainable);
mockOrder.mockReturnValue(chainable);
mockLimit.mockResolvedValue({ data: [], error: null });
mockSingle.mockResolvedValue({ data: null, error: null });
// Default: RPC unavailable → exercises the bounded-scan fallback the existing
// suites were written against.
mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc missing' } });

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: vi.fn(() => chainable), rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

// ── pushService mock — swallow all pushes ────────────────────────────────────
vi.mock('../pushService', () => ({
  sendCoachPush: vi.fn(async () => {}),
}));

import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../supabaseAuth';
import { listGroupThreads, markGroupThreadRead, sendGroupMessage } from '../groupMessageService';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
type FromReturn = ReturnType<NonNullable<typeof supabase>['from']>;
// supabase is non-null at runtime because the mock always provides it.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const mockFrom = vi.mocked(supabase!.from) as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockGetCurrentUser.mockResolvedValue({ id: 'coach-1' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);
  // Reset chain defaults.
  mockSelect.mockReturnValue(chainable);
  mockInsert.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue(chainable);
  mockEq.mockReturnValue(chainable);
  mockIn.mockReturnValue(chainable);
  mockOrder.mockReturnValue(chainable);
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc missing' } });
  mockFrom.mockReturnValue(chainable as unknown);
});

// ── (a) listGroupThreads returns [] when offline ──────────────────────────────
describe('listGroupThreads — offline / unauthenticated', () => {
  it('returns [] when Supabase is not configured (offline)', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await listGroupThreads('coach');

    expect(result).toEqual([]);
  });

  it('returns [] when getCurrentUser is null (unauthenticated)', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const result = await listGroupThreads('member');

    expect(result).toEqual([]);
  });
});

// ── (b) sendGroupMessage validation ──────────────────────────────────────────
describe('sendGroupMessage — input validation', () => {
  it('returns {error:"empty"} and does NOT insert when body is empty', async () => {
    const result = await sendGroupMessage('group-1', '   ');

    expect(result).toEqual({ error: 'empty' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns {error:"message_too_long"} and does NOT insert when body > 5000 chars', async () => {
    const longBody = 'א'.repeat(5001);

    const result = await sendGroupMessage('group-1', longBody);

    expect(result).toEqual({ error: 'message_too_long' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns {error:null} and calls insert when body is valid', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const result = await sendGroupMessage('group-1', 'שלום קבוצה');

    expect(result).toEqual({ error: null });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', sender_id: 'coach-1', body: 'שלום קבוצה' })
    );
  });
});

// ── (c) listGroupThreads reduces unread/lastBody for a coach ─────────────────
describe('listGroupThreads — coach reduction', () => {
  it('derives lastBody, lastAt, and unread count for a coach with one group', async () => {
    // First from() call → client_groups (coach role fetch)
    // Second from() call → group_messages
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        // client_groups query: return one group, no prior read
        const groupChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'g-1', name: 'מתקדמים', coach_last_read_at: null }],
            error: null,
          }),
        };
        return groupChain as unknown as FromReturn;
      }
      // group_messages query
      const msgChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            // newest first (desc order)
            {
              group_id: 'g-1',
              sender_id: 'client-2',
              body: 'תודה מורה',
              created_at: '2026-06-07T11:00:00Z',
            },
            {
              group_id: 'g-1',
              sender_id: 'coach-1',
              body: 'בוקר טוב',
              created_at: '2026-06-07T09:00:00Z',
            },
          ],
          error: null,
        }),
      };
      return msgChain as unknown as FromReturn;
    });

    const result = await listGroupThreads('coach');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      groupId: 'g-1',
      name: 'מתקדמים',
      lastBody: 'תודה מורה',
      lastAt: '2026-06-07T11:00:00Z',
      unread: 1, // only the message from client-2 with null lastRead is unread
    });
  });
});

// ── (c2) listGroupThreads uses the group_thread_summaries RPC when available ──
describe('listGroupThreads — RPC aggregate', () => {
  it('takes summaries from the RPC, keeping only the viewer-role rows', async () => {
    // client_groups query for names/cursors (still required for group names).
    mockFrom.mockImplementation(() => {
      const groupChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'g-1', name: 'מתקדמים', coach_last_read_at: null }],
          error: null,
        }),
      };
      return groupChain as unknown as FromReturn;
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        // member-role row for the same group must be ignored for a coach viewer.
        {
          group_id: 'g-1',
          role: 'member',
          last_body: 'wrong',
          last_at: '2026-06-07T08:00:00Z',
          unread: 9,
        },
        {
          group_id: 'g-1',
          role: 'coach',
          last_body: 'תודה מורה',
          last_at: '2026-06-07T11:00:00Z',
          unread: '2',
        },
      ],
      error: null,
    });

    const result = await listGroupThreads('coach');

    expect(mockRpc).toHaveBeenCalledWith('group_thread_summaries');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      groupId: 'g-1',
      name: 'מתקדמים',
      lastBody: 'תודה מורה',
      lastAt: '2026-06-07T11:00:00Z',
      unread: 2, // string bigint coerced to number
    });
  });
});

// ── (d) markGroupThreadRead hits the right table per viewer ──────────────────
describe('markGroupThreadRead — correct table per viewer', () => {
  it('updates client_groups when viewer is "coach"', async () => {
    const mockEqFinal = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateChain = { eq: mockEqFinal };
    const mockUpdateFn = vi.fn().mockReturnValue(mockUpdateChain);
    mockFrom.mockReturnValue({
      update: mockUpdateFn,
    } as unknown as FromReturn);

    await markGroupThreadRead('g-1', 'coach');

    expect(mockFrom).toHaveBeenCalledWith('client_groups');
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ coach_last_read_at: expect.any(String) })
    );
    expect(mockEqFinal).toHaveBeenCalledWith('id', 'g-1');
  });

  it('updates client_group_members when viewer is "member"', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockUpdateChain = { eq: mockEq1 };
    const mockUpdateFn = vi.fn().mockReturnValue(mockUpdateChain);
    mockFrom.mockReturnValue({
      update: mockUpdateFn,
    } as unknown as FromReturn);

    await markGroupThreadRead('g-1', 'member');

    expect(mockFrom).toHaveBeenCalledWith('client_group_members');
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ last_read_at: expect.any(String) })
    );
    expect(mockEq1).toHaveBeenCalledWith('group_id', 'g-1');
    expect(mockEq2).toHaveBeenCalledWith('client_id', 'coach-1');
  });
});
