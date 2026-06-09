import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockRpc = vi.fn();

// Chain helpers return themselves so calls can be chained.
const chainable = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
};
mockSelect.mockReturnValue(chainable);
mockEq.mockReturnValue(chainable);
mockOrder.mockReturnValue(chainable);
// Default: empty messages result
mockLimit.mockResolvedValue({ data: [], error: null });
// Default: RPC unavailable → exercises the bounded-scan fallback the
// reduction/sorting suites below were written against.
mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc missing' } });

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: vi.fn(() => chainable), rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

// ── relationshipService mock — controls the roster ───────────────────────────
const mockListClients = vi.fn();
vi.mock('../relationshipService', () => ({
  listClients: (...args: unknown[]) => mockListClients(...args),
}));

import { getCurrentUser } from '../../supabaseAuth';
import { listClientThreads } from '../messageService';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const makeClient = (clientId: string, displayName: string) => ({
  id: `link-${clientId}`,
  coachId: 'coach-1',
  clientId,
  status: 'active' as const,
  consentAt: null,
  scopes: {},
  tags: [],
  clientProfile: { id: clientId, displayName, avatarUrl: null },
});

const makeMsg = (
  clientId: string,
  senderId: string,
  body: string,
  createdAt: string,
  readAt: string | null = null
) => ({ client_id: clientId, sender_id: senderId, body, created_at: createdAt, read_at: readAt });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: 'coach-1' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);
  mockListClients.mockResolvedValue([]);
  mockSelect.mockReturnValue(chainable);
  mockEq.mockReturnValue(chainable);
  mockOrder.mockReturnValue(chainable);
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc missing' } });
});

describe('listClientThreads', () => {
  describe('graceful degradation', () => {
    it('returns [] when Supabase is not configured (offline)', async () => {
      const { isSupabaseConfigured } = await import('../../../lib/supabase');
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const result = await listClientThreads();

      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      expect(result).toEqual([]);
    });

    it('returns [] when getCurrentUser returns null (unauthenticated)', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);

      const result = await listClientThreads();

      expect(result).toEqual([]);
    });

    it('returns [] when the messages query returns an error', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('client-a', 'Alice')]);
      mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      const result = await listClientThreads();

      expect(result).toEqual([]);
    });

    it('returns [] when there are no active clients', async () => {
      mockListClients.mockResolvedValueOnce([]);

      const result = await listClientThreads();

      expect(result).toEqual([]);
    });
  });

  describe('message reduction', () => {
    it('derives lastBody and lastAt from the newest message per client', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockLimit.mockResolvedValueOnce({
        data: [
          // newest first (the query orders desc)
          makeMsg('c1', 'c1', 'שלום', '2026-06-07T10:00:00Z'),
          makeMsg('c1', 'coach-1', 'מה שלומך?', '2026-06-07T09:00:00Z'),
        ],
        error: null,
      });

      const result = await listClientThreads();

      expect(result).toHaveLength(1);
      expect(result[0]!.lastBody).toBe('שלום');
      expect(result[0]!.lastAt).toBe('2026-06-07T10:00:00Z');
    });

    it('counts only incoming (non-self) messages with null read_at as unread', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockLimit.mockResolvedValueOnce({
        data: [
          makeMsg('c1', 'c1', 'msg3', '2026-06-07T12:00:00Z', null), // unread from client
          makeMsg('c1', 'c1', 'msg2', '2026-06-07T11:00:00Z', null), // unread from client
          makeMsg('c1', 'coach-1', 'msg1', '2026-06-07T10:00:00Z', null), // coach sent — not unread
          makeMsg('c1', 'c1', 'msg0', '2026-06-07T09:00:00Z', '2026-06-07T09:30:00Z'), // already read
        ],
        error: null,
      });

      const result = await listClientThreads();

      expect(result[0]!.unread).toBe(2);
    });

    it('includes clients with no messages (lastBody=null, unread=0)', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await listClientThreads();

      expect(result).toHaveLength(1);
      expect(result[0]!).toMatchObject({ clientId: 'c1', lastBody: null, unread: 0 });
    });

    it('ignores messages belonging to clients not in the active roster', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('active-client', 'Active')]);
      mockLimit.mockResolvedValueOnce({
        data: [makeMsg('removed-client', 'removed-client', 'spam', '2026-06-07T10:00:00Z')],
        error: null,
      });

      const result = await listClientThreads();

      expect(result).toHaveLength(1);
      expect(result[0]!.clientId).toBe('active-client');
    });
  });

  describe('RPC aggregate (coach_thread_summaries)', () => {
    it('uses the RPC rows when available and skips the fallback scan', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockRpc.mockResolvedValueOnce({
        data: [{ client_id: 'c1', last_body: 'שלום', last_at: '2026-06-07T10:00:00Z', unread: 3 }],
        error: null,
      });

      const result = await listClientThreads();

      expect(mockRpc).toHaveBeenCalledWith('coach_thread_summaries');
      expect(result).toHaveLength(1);
      expect(result[0]!).toMatchObject({
        clientId: 'c1',
        lastBody: 'שלום',
        lastAt: '2026-06-07T10:00:00Z',
        unread: 3,
      });
      // The bounded fallback scan must not run when the RPC succeeded.
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it('ignores RPC rows for clients not in the active roster', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockRpc.mockResolvedValueOnce({
        data: [
          { client_id: 'c1', last_body: 'hi', last_at: '2026-06-07T10:00:00Z', unread: 0 },
          { client_id: 'removed', last_body: 'spam', last_at: '2026-06-07T11:00:00Z', unread: 9 },
        ],
        error: null,
      });

      const result = await listClientThreads();

      expect(result).toHaveLength(1);
      expect(result[0]!.clientId).toBe('c1');
    });

    it('coerces a string unread count (bigint over the wire) to a number', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c1', 'Avi')]);
      mockRpc.mockResolvedValueOnce({
        data: [{ client_id: 'c1', last_body: 'hi', last_at: '2026-06-07T10:00:00Z', unread: '5' }],
        error: null,
      });

      const result = await listClientThreads();

      expect(result[0]!.unread).toBe(5);
    });
  });

  describe('sorting', () => {
    it('puts clients with unread messages before clients without', async () => {
      mockListClients.mockResolvedValueOnce([
        makeClient('c1', 'No Unread'),
        makeClient('c2', 'Has Unread'),
      ]);
      mockLimit.mockResolvedValueOnce({
        data: [
          makeMsg('c1', 'coach-1', 'reply', '2026-06-07T12:00:00Z'), // coach sent — not unread
          makeMsg('c2', 'c2', 'ping', '2026-06-07T11:00:00Z', null), // unread from c2
        ],
        error: null,
      });

      const result = await listClientThreads();

      expect(result[0]!.clientId).toBe('c2');
      expect(result[1]!.clientId).toBe('c1');
    });

    it('sorts by lastAt desc when unread counts are equal', async () => {
      mockListClients.mockResolvedValueOnce([
        makeClient('c1', 'Earlier'),
        makeClient('c2', 'Later'),
      ]);
      mockLimit.mockResolvedValueOnce({
        data: [
          makeMsg('c2', 'c2', 'newer', '2026-06-07T12:00:00Z', '2026-06-07T12:05:00Z'),
          makeMsg('c1', 'c1', 'older', '2026-06-07T10:00:00Z', '2026-06-07T10:05:00Z'),
        ],
        error: null,
      });

      const result = await listClientThreads();

      expect(result[0]!.clientId).toBe('c2');
      expect(result[1]!.clientId).toBe('c1');
    });

    it('sorts by displayName when both unread and lastAt are equal/null', async () => {
      mockListClients.mockResolvedValueOnce([makeClient('c2', 'ברק'), makeClient('c1', 'אביב')]);
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await listClientThreads();

      // Hebrew locale sort: א before ב
      expect(result[0]!.displayName).toBe('אביב');
      expect(result[1]!.displayName).toBe('ברק');
    });
  });
});
