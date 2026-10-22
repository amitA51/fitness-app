// ============================================================================
// Incremental pulls, BUSY retry, targeted pulls
// ============================================================================
// Every pull used to read the FULL history of all eleven tables. These tests run
// the real fetchers, merges and IndexedDB against a fake PostgREST that applies
// the filters the way the server would (`updated_at > since`, `id in (...)`),
// so they pin both what is ASKED for and what ends up stored locally.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Call {
  table: string;
  gt?: [string, string];
  in?: [string, readonly string[]];
  retry?: boolean;
}

const server = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  calls: [] as Call[],
  failTables: new Set<string>(),
  userId: 'user-1' as string | null,
  busy: false,
  lockCalls: 0,
}));

vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const call: Call = { table };
    server.calls.push(call);
    const answer = () => {
      if (server.failTables.has(table)) {
        return { data: null, error: { message: `${table} unavailable` } };
      }
      let rows = server.rows[table] ?? [];
      if (call.gt) {
        const [column, value] = call.gt;
        rows = rows.filter((r) => String(r[column]) > value);
      }
      if (call.in) {
        const [column, values] = call.in;
        rows = rows.filter((r) => values.includes(String(r[column])));
      }
      return { data: rows, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      range: () => b,
      gt: (column: string, value: string) => {
        call.gt = [column, value];
        return b;
      },
      in: (column: string, values: readonly string[]) => {
        call.in = [column, values];
        return b;
      },
      retry: (enabled: boolean) => {
        call.retry = enabled;
        return b;
      },
      // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(answer()).then(onFulfilled, onRejected),
    };
    return b;
  };
  return {
    isSupabaseConfigured: () => true,
    supabase: { from: (table: string) => builder(table) },
    readStoredAuthSession: () => null,
  };
});

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: async () => (server.userId ? { id: server.userId } : null),
  resolveCurrentUserOrNull: async () => (server.userId ? { id: server.userId } : null),
}));

vi.mock('../syncLock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../syncLock')>();
  return {
    ...actual,
    withSyncLock: async <T>(task: () => Promise<T>) => {
      server.lockCalls++;
      return server.busy ? actual.BUSY : task();
    },
  };
});

vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));

type PullModule = typeof import('../supabaseSyncPull');
type CoreModule = typeof import('../indexedDBCore');
let pull: PullModule;
let core: CoreModule;

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-10-22T08:00:00.000Z');
/** INCREMENTAL_LOOKBACK_MS: a week, so rows written offline days ago still reach other devices. */
const LOOKBACK = 7 * 24 * HOUR;

const sessionRow = (id: string, updatedAt: string, deletedAt: string | null = null) => ({
  id,
  title: `אימון ${id}`,
  date: '2026-10-20',
  start_time: '2026-10-20T08:00:00.000Z',
  end_time: '2026-10-20T09:00:00.000Z',
  duration: 3600,
  exercises: [],
  total_volume: 100,
  notes: '',
  status: 'completed',
  template_id: null,
  rating: null,
  calories_burned: null,
  created_at: '2026-10-20T08:00:00.000Z',
  updated_at: updatedAt,
  deleted_at: deletedAt,
});

const templateRow = (id: string, updatedAt: string) => ({
  id,
  name: `תבנית ${id}`,
  description: null,
  exercises: [],
  last_used: null,
  times_used: 0,
  is_favorite: false,
  muscle_groups: null,
  is_builtin: false,
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: updatedAt,
  deleted_at: null,
});

const callsFor = (table: string) => server.calls.filter((c) => c.table === table);
const lastCallFor = (table: string) => {
  const calls = callsFor(table);
  return calls[calls.length - 1];
};
const localSessionIds = async () =>
  (await core.dbGetAll<{ id: string }>(core.STORES.WORKOUT_SESSIONS)).map((s) => s.id).sort();

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.setItem('sparkos_legacy_id_normalization_v1', 'done');
  server.rows = {};
  server.calls = [];
  server.failTables = new Set();
  server.userId = 'user-1';
  server.busy = false;
  server.lockCalls = 0;
  core = await import('../indexedDBCore');
  await core.clearDatabase();
  pull = await import('../supabaseSyncPull');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pullAllData — what it asks the server for', () => {
  it('reads every table in full on the first pull, with no automatic retries', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];

    const result = await pull.pullAllData();

    expect(result.success).toBe(true);
    expect(server.calls.filter((c) => c.gt)).toEqual([]);
    expect(server.calls.every((c) => c.retry === false)).toBe(true);
    expect(await localSessionIds()).toEqual(['s1']);
  });

  it('asks only for rows changed since the last pull (minus the lookback) afterwards', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    vi.setSystemTime(T0 + HOUR);
    server.calls = [];
    // A new session written after the first pull; an old one the server already sent.
    server.rows.workout_sessions.push(sessionRow('s2', new Date(T0 + 30 * 60_000).toISOString()));
    await pull.pullAllData();

    const since = new Date(T0 - LOOKBACK).toISOString();
    expect(lastCallFor('workout_sessions')?.gt).toEqual(['updated_at', since]);
    expect(await localSessionIds()).toEqual(['s1', 's2']);
  });

  it('still picks up a workout written offline days before it reached the server', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    // Another device logged s-offline two days ago with no connection; it is
    // replayed now with its ORIGINAL updated_at (no insert trigger restamps it),
    // so it lands far behind this device's cursor.
    vi.setSystemTime(T0 + HOUR);
    server.rows.workout_sessions.push(
      sessionRow('s-offline', new Date(T0 - 2 * 24 * HOUR).toISOString())
    );
    await pull.pullAllData();

    expect(lastCallFor('workout_sessions')?.gt).toBeDefined();
    expect(await localSessionIds()).toEqual(['s-offline', 's1']);
  });

  it('keeps user_settings on full pulls (its cloud delete is a hard delete)', async () => {
    server.rows.user_settings = [
      { id: 'u1', key: 'k', value: 1, created_at: '', updated_at: '2026-10-21T10:00:00.000Z' },
    ];
    await pull.pullAllData();
    vi.setSystemTime(T0 + HOUR);
    await pull.pullAllData();

    expect(callsFor('user_settings').every((c) => !c.gt)).toBe(true);
  });

  it('reads a table whose local store is empty in full, whatever its cursor says', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();
    // The local rows disappear (eviction, a partial wipe) but the cursor survives.
    await core.dbClear(core.STORES.WORKOUT_SESSIONS);

    vi.setSystemTime(T0 + HOUR);
    await pull.pullAllData();

    expect(lastCallFor('workout_sessions')?.gt).toBeUndefined();
    expect(await localSessionIds()).toEqual(['s1']);
  });

  it('applies a deletion made after the last pull (no resurrection)', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();
    expect(await localSessionIds()).toEqual(['s1']);

    // Deleted on another device: the server guard stamps updated_at = now().
    vi.setSystemTime(T0 + HOUR);
    const deletedAt = new Date(T0 + 30 * 60_000).toISOString();
    server.rows.workout_sessions = [sessionRow('s1', deletedAt, deletedAt)];
    await pull.pullAllData();

    expect(lastCallFor('workout_sessions')?.gt).toBeDefined();
    expect(await localSessionIds()).toEqual([]);
  });

  it('reads everything in full again once a day', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    vi.setSystemTime(T0 + 25 * HOUR);
    await pull.pullAllData();

    expect(lastCallFor('workout_sessions')?.gt).toBeUndefined();
  });

  it('reads everything in full for another account on the same device', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    server.userId = 'user-2';
    vi.setSystemTime(T0 + HOUR);
    await pull.pullAllData();

    expect(lastCallFor('workout_sessions')?.gt).toBeUndefined();
  });

  it('reads everything in full when asked to', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    vi.setSystemTime(T0 + HOUR);
    await pull.pullAllData({ full: true });

    expect(server.calls.filter((c) => c.gt && c.table === 'workout_sessions')).toEqual([]);
  });

  it('does not move a failed table forward: the next pull asks for the same rows again', async () => {
    server.rows.workout_sessions = [sessionRow('s1', '2026-10-21T10:00:00.000Z')];
    await pull.pullAllData();

    vi.setSystemTime(T0 + HOUR);
    server.failTables.add('workout_sessions');
    const failed = await pull.pullAllData();
    expect(failed.success).toBe(false);

    vi.setSystemTime(T0 + 2 * HOUR);
    server.failTables.clear();
    await pull.pullAllData();

    // Still measured from the FIRST pull, not from the failed one.
    expect(lastCallFor('workout_sessions')?.gt).toEqual([
      'updated_at',
      new Date(T0 - LOOKBACK).toISOString(),
    ]);
  });
});

describe('pullAllDataIfStale', () => {
  it('skips while the last successful pull is fresh, and runs once it is not', async () => {
    await pull.pullAllData();
    server.calls = [];

    vi.setSystemTime(T0 + 10 * 60_000);
    const fresh = await pull.pullAllDataIfStale();
    expect(fresh).toMatchObject({ success: true, skipped: true });
    expect(server.calls).toEqual([]);

    vi.setSystemTime(T0 + 16 * 60_000);
    const stale = await pull.pullAllDataIfStale();
    expect(stale.skipped).toBeUndefined();
    expect(server.calls.length).toBeGreaterThan(0);
  });

  it('does not retry a failed pull on every trigger', async () => {
    server.failTables.add('workout_sessions');
    await pull.pullAllData();
    server.calls = [];

    vi.setSystemTime(T0 + 60_000);
    const soon = await pull.pullAllDataIfStale();
    expect(soon).toMatchObject({ skipped: true });
    expect(server.calls).toEqual([]);

    vi.setSystemTime(T0 + 3 * 60_000);
    await pull.pullAllDataIfStale();
    expect(server.calls.length).toBeGreaterThan(0);
  });
});

describe('pullAllData when the sync lock is busy', () => {
  it('retries once, a few seconds later, instead of dropping the pull', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    server.busy = true;

    const result = await pull.pullAllData();
    expect(result.error).toBe('sync_in_progress_in_another_tab');
    expect(server.lockCalls).toBe(1);

    server.busy = false;
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(callsFor('workout_sessions').length).toBe(1));
    expect(server.lockCalls).toBe(2);
  });

  it('retries only once: a second busy lock leaves it to the next trigger', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    server.busy = true;

    await pull.pullAllData();
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(server.lockCalls).toBe(2);
    expect(server.calls).toEqual([]);
  });
});

describe('pullTableRows', () => {
  it('fetches only the named rows and merges them', async () => {
    server.rows.workout_sessions = [
      sessionRow('s1', '2026-10-21T10:00:00.000Z'),
      sessionRow('s2', '2026-10-21T11:00:00.000Z'),
    ];

    const arrived = await pull.pullTableRows('workout_sessions', ['s2']);

    expect(arrived).toBe(1);
    expect(lastCallFor('workout_sessions')?.in).toEqual(['id', ['s2']]);
    expect(await localSessionIds()).toEqual(['s2']);
    // Only the one table was read.
    expect(new Set(server.calls.map((c) => c.table))).toEqual(new Set(['workout_sessions']));
  });
});

describe('prepareTemplateForStart', () => {
  it('starts at once from a template already on this device', async () => {
    await core.dbPut(core.STORES.WORKOUT_TEMPLATES, {
      id: 't1',
      name: 'local',
      exercises: [],
      updatedAt: '2026-10-21T10:00:00.000Z',
    });
    // The server is so slow it never answers.
    server.rows.workout_templates = [];

    await expect(pull.prepareTemplateForStart('t1')).resolves.toBe('local');
  });

  it('fetches just that template when it is not on this device', async () => {
    server.rows.workout_templates = [
      templateRow('t1', '2026-10-21T10:00:00.000Z'),
      templateRow('t2', '2026-10-21T10:00:00.000Z'),
    ];

    await expect(pull.prepareTemplateForStart('t2')).resolves.toBe('fetched');
    expect(lastCallFor('workout_templates')?.in).toEqual(['id', ['t2']]);
  });

  it('rejects when the template is nowhere to be found', async () => {
    await expect(pull.prepareTemplateForStart('missing')).rejects.toThrow();
  });

  it('rejects when the fetch takes longer than the cap', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    server.failTables.clear();
    // A fetch that never settles.
    const { supabase } = await import('../../lib/supabase');
    const from = vi
      .spyOn(supabase as unknown as { from: (t: string) => unknown }, 'from')
      .mockImplementation(() => {
        const never: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'order', 'range', 'gt', 'in', 'retry']) {
          never[m] = () => never;
        }
        // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
        never.then = () => new Promise(() => {});
        return never;
      });

    const start = pull.prepareTemplateForStart('t-slow', 8_000);
    let settled = false;
    const outcome = expect(start)
      .rejects.toThrow(/did not settle/)
      .finally(() => {
        settled = true;
      });
    // The cap is armed only after the local lookup (real IndexedDB I/O), so keep
    // moving the clock until the start gives up.
    for (let i = 0; i < 40 && !settled; i++) await vi.advanceTimersByTimeAsync(500);
    await outcome;
    from.mockRestore();
  });
});
