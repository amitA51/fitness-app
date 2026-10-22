// ============================================================================
// fetchAllPages + withPullFilters
// ============================================================================
// Filters reach the per-table fetchers through a scoped setting, so the one
// property that matters is that they apply ONLY to fetches started inside the
// window — a filter leaking into an unrelated full fetch would hide rows.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { fetchAllPages, withPullFilters } from '../supabaseSyncPagination';

interface Recorded {
  gt?: [string, string];
  in?: [string, readonly string[]];
  retry?: boolean;
}

/** A page query that records what was applied to it and answers with no rows. */
const pageQuery = (record: Recorded) => {
  const q: Record<string, unknown> = {
    gt: (column: string, value: string) => {
      record.gt = [column, value];
      return q;
    },
    in: (column: string, values: readonly string[]) => {
      record.in = [column, values];
      return q;
    },
    retry: (enabled: boolean) => {
      record.retry = enabled;
      return q;
    },
    // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return q as unknown as PromiseLike<{ data: never[]; error: null }>;
};

describe('withPullFilters', () => {
  it('narrows a fetch started inside the window, by label', async () => {
    const sessions: Recorded = {};
    const water: Recorded = {};

    await withPullFilters(
      new Map([['workout_sessions', { updatedAfter: '2026-10-22T02:00:00.000Z' }]]),
      () =>
        Promise.all([
          fetchAllPages('workout_sessions', () => pageQuery(sessions)),
          fetchAllPages('water_logs', () => pageQuery(water)),
        ])
    );

    expect(sessions.gt).toEqual(['updated_at', '2026-10-22T02:00:00.000Z']);
    expect(water.gt).toBeUndefined();
    // Background reads never let postgrest-js re-send on its own.
    expect(sessions.retry).toBe(false);
    expect(water.retry).toBe(false);
  });

  it('does not leak into a fetch started after the window closed', async () => {
    const inside: Recorded = {};
    const after: Recorded = {};

    const started = withPullFilters(new Map([['workout_sessions', { ids: ['s1'] }]]), () =>
      fetchAllPages('workout_sessions', () => pageQuery(inside))
    );
    const later = fetchAllPages('workout_sessions', () => pageQuery(after));
    await Promise.all([started, later]);

    expect(inside.in).toEqual(['id', ['s1']]);
    expect(after.in).toBeUndefined();
    expect(after.gt).toBeUndefined();
  });

  it('closes the window even when starting the fetches throws', () => {
    expect(() =>
      withPullFilters(new Map([['workout_sessions', { ids: ['s1'] }]]), () => {
        throw new Error('boom');
      })
    ).toThrow('boom');

    const after: Recorded = {};
    void fetchAllPages('workout_sessions', () => pageQuery(after));
    expect(after.in).toBeUndefined();
  });
});
