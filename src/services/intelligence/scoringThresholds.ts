// ============================================================================
// Scoring Thresholds — single source of truth for every band cut-point
// ============================================================================
//
// WHY THIS FILE EXISTS
// Before this module, the same scores were bucketed with DIFFERENT cut-points in
// different places, so the surfaces disagreed:
//   - readiness label used 45/65/82 while the load recommendation used fatigue
//     35/55/75 — so "good readiness" could sit next to a "deload" recommendation.
//   - the per-exercise progression engine deloaded at fatigue>=65 while the
//     global training-load engine deloaded at fatigue>=55 (a 55-64 conflict band).
//   - recovery "low" was 40 in one engine and 45 in another.
//
// All of those cut-points now live here. trainingLoadService and progressionService
// import from this module so the global chip, the per-exercise card, and the AI
// prompt can never disagree about what counts as "deload" / "low recovery" / "spike".
// ============================================================================

export type LoadRecommendation = 'push' | 'maintain' | 'deload' | 'rest';
export type ReadinessBand = 'low' | 'moderate' | 'good' | 'high';

/**
 * Fatigue bands on the 0-100 fatigueScore. readiness = 100 - fatigue, so the
 * readiness label is derived from the SAME cut-points (see readinessBandFromFatigue)
 * and the two views stay aligned by construction.
 */
export const FATIGUE_BANDS = {
  /** fatigue >= REST -> take a full rest day */
  REST: 75,
  /** fatigue >= DELOAD -> reduce load */
  DELOAD: 55,
  /** fatigue >= MAINTAIN -> hold load (below this -> push) */
  MAINTAIN: 35,
} as const;

/** The single mapping fatigueScore -> load recommendation. */
export function recommendationFromFatigue(fatigueScore: number): LoadRecommendation {
  if (fatigueScore >= FATIGUE_BANDS.REST) return 'rest';
  if (fatigueScore >= FATIGUE_BANDS.DELOAD) return 'deload';
  if (fatigueScore >= FATIGUE_BANDS.MAINTAIN) return 'maintain';
  return 'push';
}

/**
 * readiness label derived from the SAME fatigue cut-points, so each band maps
 * 1:1 to exactly one recommendation:
 *   fatigue <35  (readiness >65) -> high     -> push
 *   35..54       (readiness 46-65) -> good   -> maintain
 *   55..74       (readiness 26-45) -> moderate -> deload
 *   >=75         (readiness <=25)  -> low     -> rest
 */
export function readinessBandFromFatigue(fatigueScore: number): ReadinessBand {
  if (fatigueScore >= FATIGUE_BANDS.REST) return 'low';
  if (fatigueScore >= FATIGUE_BANDS.DELOAD) return 'moderate';
  if (fatigueScore >= FATIGUE_BANDS.MAINTAIN) return 'good';
  return 'high';
}

/**
 * Recovery-score (0-100, from RecoveryLog) bands. One definition of "poor"/"fair"
 * recovery shared by the global readiness constraint and the per-exercise deload
 * override so they cannot disagree about what counts as poor recovery.
 */
export const RECOVERY_BANDS = {
  /** recovery < LOW -> poor recovery (drives the 'recovery' constraint + deload) */
  LOW: 45,
  /** recovery < MODERATE -> hold load before increasing */
  MODERATE: 65,
} as const;

/**
 * Week-over-week volume jump (%) that counts as a load spike. Shared by the
 * primaryConstraint trigger and the per-muscle volume penalty so all "spike"
 * notions agree on the threshold.
 */
export const VOLUME_SPIKE_PERCENT = 25;

/** Acute:chronic ratio above this is the load-spike zone (standard ACWR > 1.5). */
export const ACWR_SPIKE = 1.5;
