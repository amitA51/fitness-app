import { describe, expect, it, vi } from 'vitest';

// Fix #2: fetch funcs must distinguish a genuine fetch error from a
// legitimately empty result. On error they now THROW (so the puller can mark
// the pull failed) instead of returning [] (which looked like success).

describe('fetch error distinction', () => {
  it('fetchWorkoutSessions throws when the query returns an error', async () => {
    vi.resetModules();

    vi.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async () => ({ data: null, error: { message: 'network down' } }),
              }),
            }),
          }),
        }),
      },
    }));
    vi.doMock('../supabaseAuth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
    }));

    const { fetchWorkoutSessions } = await import('../supabaseSync');
    await expect(fetchWorkoutSessions('user-1')).rejects.toThrow(/network down/);

    vi.doUnmock('../../lib/supabase');
    vi.doUnmock('../supabaseAuth');
  });

  it('fetchWorkoutSessions returns [] (no throw) on a genuinely empty result', async () => {
    vi.resetModules();

    vi.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      },
    }));
    vi.doMock('../supabaseAuth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
    }));

    const { fetchWorkoutSessions } = await import('../supabaseSync');
    await expect(fetchWorkoutSessions('user-1')).resolves.toEqual([]);

    vi.doUnmock('../../lib/supabase');
    vi.doUnmock('../supabaseAuth');
  });

  it('fetchWaterLogs throws on error instead of swallowing it', async () => {
    vi.resetModules();

    // fetchWaterLogs is now range-paginated like the other tables, so the
    // chain ends at .range() rather than .order().
    vi.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async () => ({ data: null, error: { message: 'water boom' } }),
              }),
            }),
          }),
        }),
      },
    }));

    const { fetchWaterLogs } = await import('../waterService');
    await expect(fetchWaterLogs('user-1')).rejects.toThrow(/water boom/);

    vi.doUnmock('../../lib/supabase');
  });
});

// Fix #3: pagination pulls every page until a short page ends the loop.
describe('fetch pagination', () => {
  it('fetchWorkoutSessions loops .range() until a short page is returned', async () => {
    vi.resetModules();

    const PAGE = 1000;
    // Page 1 is full (1000 rows) -> must request page 2; page 2 is short -> stop.
    const fullPage = Array.from({ length: PAGE }, (_, i) => ({
      id: `s${i}`,
      title: null,
      date: '2026-05-31',
      start_time: '2026-05-31T10:00:00Z',
      end_time: null,
      duration: 0,
      exercises: [],
      total_volume: 0,
      notes: null,
      created_at: '2026-05-31T10:00:00Z',
      updated_at: '2026-05-31T10:00:00Z',
    }));
    const shortPage = [{ ...fullPage[0], id: 's-last' }];
    const pages = [fullPage, shortPage];
    let call = 0;

    vi.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async () => ({ data: pages[call++] ?? [], error: null }),
              }),
            }),
          }),
        }),
      },
    }));
    vi.doMock('../supabaseAuth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
    }));

    const { fetchWorkoutSessions } = await import('../supabaseSync');
    const sessions = await fetchWorkoutSessions('user-1');

    // 1000 (full page) + 1 (short page) = 1001 rows across two range() calls.
    expect(sessions).toHaveLength(PAGE + 1);
    expect(call).toBe(2);

    vi.doUnmock('../../lib/supabase');
    vi.doUnmock('../supabaseAuth');
  });
});
