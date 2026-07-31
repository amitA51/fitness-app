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

// ----------------------------------------------------------------------------
// Granular muscles
// ----------------------------------------------------------------------------
// `secondaryMuscles` and the classification's `primaryMuscle` are far more
// specific than the coarse groups above: "Quads", "Obliques", "Hip Flexors".
// Those were falling through this module untranslated, so MuscleMap's
// screen-reader label read out English muscle names in a Hebrew-first app.
// Both spellings of a muscle are listed where the catalog uses both
// (`Quads` in secondaryMuscles vs `quadriceps` as a primaryMuscle key).
const GRANULAR_MUSCLE_HE: Record<string, string> = {
  quads: 'ארבע ראשי',
  quadriceps: 'ארבע ראשי',
  hamstrings: 'מיתרי הירך',
  glutes: 'ישבן',
  calves: 'תאומים',
  soleus: 'שריר הסוליה',
  achilles: 'גיד אכילס',
  lats: 'גב רחב',
  'middle back': 'גב אמצעי',
  'lower back': 'גב תחתון',
  traps: 'טרפזים',
  forearms: 'אמות',
  brachialis: 'שריר הזרוע',
  grip: 'אחיזה',
  obliques: 'בטן אלכסונית',
  abdominals: 'בטן',
  adductors: 'מקרבי הירך',
  abductors: 'מרחיקי הירך',
  'hip flexors': 'כופפי הירך',
  tfl: 'מותח הפאשיה',
  diaphragm: 'סרעפת',
  neck: 'צוואר',
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
  const lower = value.toLowerCase();
  const english = MUSCLE_HE[lower];
  if (english) return english;
  const granular = GRANULAR_MUSCLE_HE[lower];
  if (granular) return granular;
  return HE_CANONICAL[value] ?? value;
};

/** Convenience: resolve an exercise's muscle field and translate in one call. */
export const muscleLabel = (ex: { targetMuscle?: string; muscleGroup?: string }): string =>
  translateMuscle(resolveMuscleKey(ex));

// ============================================================================
// Filter coverage
// ============================================================================
// The library filter offers coarse chips (חזה / גב / ידיים…), but the catalog
// tags arm work as `Biceps` / `Triceps` and abs work as `Core`. Matching the chip
// against the raw value therefore left the "ידיים" chip matching NOTHING while
// every arm exercise stayed reachable only through search. A chip now covers a
// SET of catalog values, which is also why `Abs` is not offered separately —
// translateMuscle already collapses Core and Abs to the same Hebrew word.

/** Coarse filter key → every catalog muscle value it should match. */
const FILTER_COVERAGE: Record<string, readonly string[]> = {
  Chest: ['Chest'],
  Back: ['Back'],
  Legs: ['Legs'],
  Shoulders: ['Shoulders'],
  Arms: ['Arms', 'Biceps', 'Triceps'],
  Core: ['Core', 'Abs'],
  Cardio: ['Cardio'],
  Other: ['Other'],
};

/**
 * Coarse muscle-group chips offered by the library filter, in display order.
 * Derived from the coverage map so a chip can never exist without something to
 * match, and `Abs` can never reappear as a duplicate of `Core`.
 */
export const MUSCLE_FILTER_KEYS = Object.keys(FILTER_COVERAGE);

/** Does an exercise belong under a coarse filter chip? `all` matches everything. */
export const matchesMuscleFilter = (
  filterKey: string,
  ex: { targetMuscle?: string; muscleGroup?: string }
): boolean => {
  if (filterKey === 'all') return true;
  const value = resolveMuscleKey(ex);
  const covered = FILTER_COVERAGE[filterKey];
  if (covered) return covered.some((entry) => entry.toLowerCase() === value.toLowerCase());
  // Unknown chip (user-authored muscle): fall back to an exact match.
  return value.toLowerCase() === filterKey.toLowerCase();
};
