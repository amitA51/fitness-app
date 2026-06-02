// ============================================================================
// AI Constants - shared tunables for the AI layer
// ============================================================================

/**
 * A muscle group is considered "weak" (under-trained) when its accumulated
 * volume falls below this fraction of the average across all trained muscles.
 *
 * Consumed by contextBuilder (and the athleteState layer) so every AI surface
 * agrees on which muscles to flag as under-trained.
 */
export const WEAK_MUSCLE_THRESHOLD = 0.75;
