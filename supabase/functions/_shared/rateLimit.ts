// ============================================================================
// Shared rate limiting for Edge Functions
// ============================================================================
// Thin wrapper over the `consume_rate_limit` RPC
// (supabase/migrations/20260726130000_rate_limit_atomic.sql).
//
// Every function used to inline a read-then-insert pair against
// `rate_limit_events`, which had two defects: concurrent requests all observed a
// below-limit count and all proceeded, and a PostgREST error surfaced as
// `count: null` that `(count ?? 0) > limit` then read as "no usage yet".
//
// This helper has exactly one ambiguous case — an error — and it always resolves
// it as DENIED.
// ============================================================================

/** A minimal shape so this file does not depend on the Supabase client's types. */
interface RpcCapableClient {
  rpc(
    name: string,
    params: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
}

export interface RateLimitRule {
  /** Ledger bucket name, e.g. 'ai_chat_min'. */
  bucket: string;
  /** Who is being limited: a user id, an IP, or any stable string. */
  subject: string;
  windowSeconds: number;
  maxEvents: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Which rule denied the request, or null when the limiter itself failed. */
  deniedBy: string | null;
  /** True when the decision could not be made — callers should answer 503. */
  unavailable: boolean;
}

/**
 * Consume one unit against every rule, in order. Stops at the first denial.
 *
 * Fails CLOSED: any RPC error or non-boolean result denies the request and is
 * reported as `unavailable`, so the caller can distinguish "you are over your
 * quota" (429) from "we cannot meter you right now" (503).
 */
export async function consumeRateLimits(
  admin: RpcCapableClient,
  rules: readonly RateLimitRule[],
  logPrefix: string
): Promise<RateLimitVerdict> {
  for (const rule of rules) {
    let data: unknown;
    let error: { message?: string } | null;
    try {
      ({ data, error } = await admin.rpc('consume_rate_limit', {
        p_bucket: rule.bucket,
        p_subject: rule.subject,
        p_window_seconds: rule.windowSeconds,
        p_max_events: rule.maxEvents,
      }));
    } catch (e) {
      console.error(`${logPrefix} rate limiter threw, denying:`, e);
      return { allowed: false, deniedBy: null, unavailable: true };
    }

    if (error) {
      console.error(`${logPrefix} rate limiter failed, denying:`, error.message);
      return { allowed: false, deniedBy: null, unavailable: true };
    }
    if (typeof data !== 'boolean') {
      // A missing migration returns no boolean. Treated as unavailable, never as
      // permission.
      console.error(`${logPrefix} rate limiter returned a non-boolean, denying`);
      return { allowed: false, deniedBy: null, unavailable: true };
    }
    if (!data) {
      return { allowed: false, deniedBy: rule.bucket, unavailable: false };
    }
  }

  return { allowed: true, deniedBy: null, unavailable: false };
}
