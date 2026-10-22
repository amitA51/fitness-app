// One AI review per run per browser session — coming back to the run shows the
// same review instead of asking the model again. sessionStorage, so it is gone
// with the tab. Sign-out clears it only once the prefix is registered in
// userScopedLocalData's sessionStorageKeyPrefixes.

export const RUN_REVIEW_CACHE_PREFIX = 'run_review_v1:';
const PREFIX = RUN_REVIEW_CACHE_PREFIX;

export interface CachedReview {
  /** The run as it was sent to the model (kept for the report button). */
  question: string;
  answer: string;
}

/** Key a review to the run AND its last edit — an edited run gets a fresh one. */
export function reviewCacheKey(sessionId: string, updatedAt: string | null | undefined): string {
  return `${PREFIX}${sessionId}:${updatedAt ?? ''}`;
}

export function readCachedReview(key: string): CachedReview | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedReview>;
    return typeof parsed.answer === 'string' && parsed.answer && typeof parsed.question === 'string'
      ? { question: parsed.question, answer: parsed.answer }
      : null;
  } catch {
    return null;
  }
}

export function writeCachedReview(key: string, review: CachedReview): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(review));
  } catch {
    // Storage full or blocked: the review just is not kept.
  }
}
