import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// A flexible query-builder mock: every chainable method returns the builder, and
// the builder is awaitable (then) resolving to whatever the test queues. Each
// awaited chain pulls the next queued result (FIFO). Mirrors the pattern used in
// scheduleService.test.ts, extended with neq/is/in/gte for these queries.
const mocks = vi.hoisted(() => {
  const resultQueue: Array<{ data: unknown; error: unknown }> = [];
  const nextResult = () => resultQueue.shift() ?? { data: [], error: null };

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.neq = vi.fn(chain);
    builder.is = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    // Make the builder awaitable.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(nextResult());
    return builder;
  }

  const mockFrom = vi.fn((_table: string) => makeBuilder());
  return { resultQueue, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

import { getCurrentUser } from '../../supabaseAuth';
import { getRecentCheckInFlags } from '../checkInService';
import { getUnreadCountByClient } from '../messageService';
import { getScheduledTodayByClient } from '../scheduleService';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function queueResult(data: unknown, error: unknown = null) {
  mocks.resultQueue.push({ data, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resultQueue.length = 0;
  mockGetCurrentUser.mockResolvedValue({ id: 'coach-1' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);
});

// ---------------------------------------------------------------------------
// getUnreadCountByClient
// ---------------------------------------------------------------------------

describe('getUnreadCountByClient', () => {
  it('groups unread rows into per-client counts', async () => {
    // Arrange — five incoming unread rows across two clients.
    queueResult([
      { client_id: 'c1' },
      { client_id: 'c1' },
      { client_id: 'c1' },
      { client_id: 'c2' },
      { client_id: 'c2' },
    ]);

    // Act
    const result = await getUnreadCountByClient();

    // Assert
    expect(result).toEqual({ c1: 3, c2: 2 });
  });

  it('returns an empty map when there are no unread rows (zero)', async () => {
    // Arrange
    queueResult([]);

    // Act
    const result = await getUnreadCountByClient();

    // Assert — clients with zero unread are simply absent.
    expect(result).toEqual({});
  });

  it('returns {} when unauthenticated', async () => {
    // Arrange
    mockGetCurrentUser.mockResolvedValueOnce(null);

    // Act
    const result = await getUnreadCountByClient();

    // Assert — short-circuits before any query.
    expect(result).toEqual({});
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('returns {} on a query error (graceful)', async () => {
    // Arrange
    queueResult(null, { message: 'db error' });

    // Act
    const result = await getUnreadCountByClient();

    // Assert
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getRecentCheckInFlags
// ---------------------------------------------------------------------------

describe('getRecentCheckInFlags', () => {
  it('reduces rows to the set of client ids with a recent check-in (membership)', async () => {
    // Arrange — c1 has two recent check-ins, c3 has one; c2 has none.
    queueResult([{ user_id: 'c1' }, { user_id: 'c1' }, { user_id: 'c3' }]);

    // Act
    const result = await getRecentCheckInFlags(['c1', 'c2', 'c3']);

    // Assert
    expect(result.has('c1')).toBe(true);
    expect(result.has('c3')).toBe(true);
    expect(result.has('c2')).toBe(false);
    expect(result.size).toBe(2);
  });

  it('short-circuits to an empty set on empty input (no query)', async () => {
    // Act
    const result = await getRecentCheckInFlags([]);

    // Assert
    expect(result.size).toBe(0);
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('queries with a date cutoff derived from sinceDays', async () => {
    // Arrange — capture the gte argument to assert the cutoff date.
    let capturedColumn: unknown;
    let capturedCutoff: unknown;
    const gteSpy = vi.fn((col: unknown, val: unknown) => {
      capturedColumn = col;
      capturedCutoff = val;
      return chain;
    });
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.gte = gteSpy;
    chain.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ user_id: 'c1' }], error: null });
    mocks.mockFrom.mockReturnValueOnce(chain as never);

    const sinceDays = 7;
    const expectedCutoff = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);

    // Act
    await getRecentCheckInFlags(['c1'], sinceDays);

    // Assert — filters on the `date` column with the computed YYYY-MM-DD cutoff.
    expect(capturedColumn).toBe('date');
    expect(capturedCutoff).toBe(expectedCutoff);
  });

  it('returns an empty set on a query error (graceful)', async () => {
    // Arrange
    queueResult(null, { message: 'boom' });

    // Act
    const result = await getRecentCheckInFlags(['c1']);

    // Assert
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getScheduledTodayByClient
// ---------------------------------------------------------------------------

describe('getScheduledTodayByClient', () => {
  it('splits today rows into planned and done per client', async () => {
    // Arrange — c1: 2 planned + 1 done; c2: 1 done; c3: 1 skipped (ignored).
    queueResult([
      { user_id: 'c1', status: 'planned' },
      { user_id: 'c1', status: 'planned' },
      { user_id: 'c1', status: 'done' },
      { user_id: 'c2', status: 'done' },
      { user_id: 'c3', status: 'skipped' },
    ]);

    // Act
    const result = await getScheduledTodayByClient(['c1', 'c2', 'c3']);

    // Assert
    expect(result.c1).toEqual({ planned: 2, done: 1 });
    expect(result.c2).toEqual({ planned: 0, done: 1 });
    // A skipped-only client still gets a bucket, with both counts zero.
    expect(result.c3).toEqual({ planned: 0, done: 0 });
  });

  it('short-circuits to an empty map on empty input (no query)', async () => {
    // Act
    const result = await getScheduledTodayByClient([]);

    // Assert
    expect(result).toEqual({});
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('returns {} on a query error (graceful)', async () => {
    // Arrange
    queueResult(null, { message: 'network' });

    // Act
    const result = await getScheduledTodayByClient(['c1']);

    // Assert
    expect(result).toEqual({});
  });
});
