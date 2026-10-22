// ============================================================================
// withTimeout — stop WAITING on a slow server without abandoning the work.
// ----------------------------------------------------------------------------
// When the database is overloaded a read can hang for the full fetch timeout
// (25 s for REST, see lib/supabase.ts). A screen that awaits it shows a loader
// for that long, or forever when several reads are chained. Racing the read
// against a short cap lets the UI fall back to what it already knows (a cached
// value, the last server answer) and carry on.
//
// The underlying promise is NOT cancelled: the request keeps running and a
// caller that still cares can attach its own `.then` to apply a late answer.
// ============================================================================

/** Rejection reason when the cap passes before the promise settles. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not settle within ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

export const isTimeoutError = (err: unknown): err is TimeoutError => err instanceof TimeoutError;

/**
 * Settle with `promise`, or reject with a {@link TimeoutError} once `ms` passes.
 * Accepts any thenable, so a Supabase query builder can be passed directly.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([Promise.resolve(promise), cap]).finally(() => clearTimeout(timer));
}
