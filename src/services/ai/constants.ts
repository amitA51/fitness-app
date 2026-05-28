// ============================================================================
// AI Constants - shared tunables for the AI layer
// ============================================================================

/**
 * A muscle group is considered "weak" (under-trained) when its accumulated
 * volume falls below this fraction of the average across all trained muscles.
 *
 * Used by both contextBuilder and aiDashboardService so the two AI surfaces
 * agree on which muscles to flag. Previously these diverged (0.8 vs 0.7).
 */
export const WEAK_MUSCLE_THRESHOLD = 0.75;
