// ============================================================================
// Muscle-name canonicalization (Hebrew UI)
// ============================================================================
// Exercises carry their muscle either as `targetMuscle` or `muscleGroup`, and
// the value can be an English key ("Chest", "Legs") from the built-in catalog
// OR already-Hebrew ("חזה") from user templates. UI surfaces were showing the
// raw English keys to Hebrew users and resolving the two fields in conflicting
// orders. This module is the single source of truth for BOTH concerns:
//   - resolveMuscleKey(): one canonical field-priority (targetMuscle first).
//   - translateMuscle(): English → Hebrew, Hebrew passed through, "Core"/"Abs"
//     unified to a single term (בטן) so the same muscle never appears twice.

const FALLBACK_HE = 'אחר';

// English catalog keys → Hebrew. "Core" and "Abs" both map to בטן so the
// distribution never splits the same region across two bars.
const MUSCLE_HE: Record<string, string> = {
  chest: 'חזה',
  back: 'גב',
  legs: 'רגליים',
  shoulders: 'כתפיים',
  arms: 'ידיים',
  biceps: 'יד קדמית',
  triceps: 'יד אחורית',
  core: 'בטן',
  abs: 'בטן',
  cardio: 'קרדיו',
  other: FALLBACK_HE,
};

// Hebrew synonyms that should collapse onto the canonical term, mirroring the
// English "Core"/"Abs" → בטן unification (ליבה is the other word for core).
const HE_CANONICAL: Record<string, string> = {
  ליבה: 'בטן',
};

/**
 * Canonical field priority for an exercise's muscle. Always resolve through this
 * so every surface agrees on which field wins (was targetMuscle-first in one
 * place, muscleGroup-first in another).
 */
export const resolveMuscleKey = (ex: {
  targetMuscle?: string;
  muscleGroup?: string;
}): string => ex.targetMuscle?.trim() || ex.muscleGroup?.trim() || '';

/**
 * Translate a raw muscle key (English catalog key or Hebrew) to the canonical
 * Hebrew label. Unknown values pass through unchanged; empty falls back to אחר.
 */
export const translateMuscle = (raw: string | undefined): string => {
  const value = raw?.trim();
  if (!value) return FALLBACK_HE;
  const english = MUSCLE_HE[value.toLowerCase()];
  if (english) return english;
  return HE_CANONICAL[value] ?? value;
};

/** Convenience: resolve an exercise's muscle field and translate in one call. */
export const muscleLabel = (ex: { targetMuscle?: string; muscleGroup?: string }): string =>
  translateMuscle(resolveMuscleKey(ex));
