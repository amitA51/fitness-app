/**
 * Supabase Sync Pagination
 * SPARKOS Fitness App - Range-pagination helper for cloud pulls
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
 * Pull every row of a query via range pagination, looping until a short page
 * (< PAGE_SIZE) is returned. The `build` callback receives a [from, to] window
 * and must apply `.range(from, to)` to the query.
 *
 * Throws on any page error so callers can distinguish a genuine fetch failure
 * from a legitimately empty result set (see DA fix #2). Tombstoned rows are
 * intentionally NOT filtered here: the tombstone-aware merges rely on receiving
 * `deleted_at` rows to propagate deletions on pull (see DA fix #1). With full
 * pagination there is no fixed row budget for tombstones to exhaust.
 */
export async function fetchAllPages<T>(
  label: string,
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await build(from, to);
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
