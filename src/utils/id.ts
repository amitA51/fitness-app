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
