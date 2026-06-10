/**
 * Generate a reasonably-unique client-side id of the form
 * `${prefix}-${timestamp}-${random}`.
 *
 * Not cryptographically secure — intended for local entity ids (meals, water
 * logs, conversations, body-stats entries) where collision risk is negligible.
 *
 * @param prefix       short entity prefix, e.g. 'meal', 'water', 'conv'
 * @param randomLength number of random base-36 chars to append (default 7)
 */
export const generateId = (prefix: string, randomLength = 7): string =>
  `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 2 + randomLength)}`;

/** Canonical 8-4-4-4-12 hex UUID shape (any variant/version, case-insensitive). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `value` is a canonical UUID string.
 *
 * Cloud `id` columns are Postgres `uuid` — PostgREST rejects anything else
 * with 22P02. Use this to decide whether a locally-minted id can be synced
 * as-is or must be normalized/nulled first.
 */
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);
