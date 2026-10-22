/**
 * Supabase Sync Pagination
 * SPARKOS Fitness App - Range-pagination helper for cloud pulls, and the
 * per-table row filters an incremental or targeted pull narrows it with.
 *
 * Extracted from supabaseSync.ts so the helper can be shared by the
 * sync modules without an import cycle. Re-exported from supabaseSync.ts
 * for backward compatibility.
 */

// ==================== SYNC HELPERS ====================

// Page size for keyset/range pagination. Supabase caps a single response at
// ~1000 rows; without paging, history beyond this was silently truncated.
const PAGE_SIZE = 1000;

/**
 * Narrows ONE table's pull. Both fields only ever remove rows from the answer,
 * so a fetch that cannot apply them returns a superset — slower, never wrong.
 */
export interface PullFilter {
  /** Only rows whose `updated_at` is strictly later than this ISO timestamp. */
  updatedAfter?: string;
  /** Only these row ids. */
  ids?: readonly string[];
}

/** Filters for the fetches being started right now, keyed by fetch label (= table name). */
let activeFilters: ReadonlyMap<string, PullFilter> | null = null;

/**
 * Start fetches with per-table filters: every `fetchAllPages(label, …)` call
 * that BEGINS while `start` runs applies `filters.get(label)`.
 *
 * Why a scoped setting rather than a parameter: the per-table fetchers
 * (supabaseSync, supabaseMiscSync, waterService) own each table's column list
 * and row mapper and take only a user id. Narrowing a pull through them keeps a
 * single copy of each mapping — two copies of one mapping is exactly how
 * personal_records, body_measurements and nutrition_logs were corrupted before.
 *
 * Why it cannot leak into an unrelated fetch: the filters are installed and
 * removed inside one synchronous call, and JavaScript runs nothing else until
 * that call returns. `start` must therefore START its fetches synchronously (an
 * async fetcher runs synchronously up to its first `await`, which is where it
 * calls `fetchAllPages`). A fetcher that awaits something first simply misses
 * the window and fetches unfiltered — a superset, never a loss.
 */
export function withPullFilters<T>(filters: ReadonlyMap<string, PullFilter>, start: () => T): T {
  const previous = activeFilters;
  activeFilters = filters;
  try {
    return start();
  } finally {
    activeFilters = previous;
  }
}

/** The postgrest-js builder methods this module uses. Checked at runtime, never assumed. */
interface NarrowableQuery {
  gt?: (column: string, value: string) => unknown;
  in?: (column: string, values: readonly string[]) => unknown;
  retry?: (enabled: boolean) => unknown;
}

/**
 * Apply `filter` (and turn off postgrest-js's own retries) on one page query.
 *
 * Retries off: postgrest-js re-sends a GET that failed on the network or timed
 * out up to three more times. On an overloaded database that turns one 25 s
 * timeout into ~100 s while the pull holds the cross-tab sync lock, and every
 * extra attempt is more load on the server that is already failing. A failed
 * pull is cheap to repeat later: the table's cursor does not advance, so the
 * next pull asks for the same rows again.
 */
function narrow<Q>(query: Q, filter: PullFilter | undefined): Q {
  let next = query as Q & NarrowableQuery;
  if (typeof next.retry === 'function') next = next.retry(false) as Q & NarrowableQuery;
  if (filter?.updatedAfter && typeof next.gt === 'function') {
    next = next.gt('updated_at', filter.updatedAfter) as Q & NarrowableQuery;
  }
  if (filter?.ids && typeof next.in === 'function') {
    next = next.in('id', filter.ids) as Q & NarrowableQuery;
  }
  return next;
}

/**
 * Pull every row of a query via range pagination, looping until a short page
 * (< PAGE_SIZE) is returned. The `build` callback receives a [from, to] window
 * and must apply `.range(from, to)` to the query.
 *
 * Throws on any page error so callers can distinguish a genuine fetch failure
 * from a legitimately empty result set (see DA fix #2). Tombstoned rows are
 * intentionally NOT filtered here: the tombstone-aware merges rely on receiving
 * `deleted_at` rows to propagate deletions on pull (see DA fix #1). With full
 * pagination there is no fixed row budget for tombstones to exhaust.
 *
 * An incremental pull (see withPullFilters) still receives tombstones: a
 * soft delete is an UPDATE, and the server guard stamps `updated_at = now()`
 * on it, so a deletion is always "a row changed since the last pull".
 */
export async function fetchAllPages<T>(
  label: string,
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  // Read the filter NOW, before the first await — see withPullFilters.
  const filter = activeFilters?.get(label);
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await narrow(build(from, to), filter);
    if (error) {
      throw new Error(`fetch ${label} failed: ${error.message}`);
    }
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
