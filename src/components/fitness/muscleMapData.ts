// ============================================================================
// MuscleMap data — muscle-key → body-region mapping (pure, unit-tested)
// ============================================================================
// A fresh, zero-dependency mapping built from THIS app's own muscle taxonomy
// (src/constants/muscleNames.ts + the muscleGroup/targetMuscle/secondaryMuscles
// values in src/data). Inspired by the muscle diagrams common to fitness apps
// (wger et al.) but authored from scratch — no third-party code or assets.
//
// Exercises carry muscles as English catalog keys ("Chest", "Quads") OR Hebrew
// ("חזה") from user templates, plus granular secondaryMuscles ("Hamstrings",
// "Glutes"). This module collapses ALL of those onto a small set of drawable
// body regions so the SVG only needs to know about regions, not raw labels.

/** The drawable body regions (each region is rendered on the front/back view). */
export type MuscleRegion =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'lowerback'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

// Raw muscle key (lowercased English catalog key, granular secondary, or Hebrew
// label) → the body region(s) it lights up. Broad groups (back, legs, arms)
// fan out to several regions; granular muscles map to a single region.
const KEY_TO_REGIONS: Record<string, MuscleRegion[]> = {
  // ── Broad English groups ──
  chest: ['chest'],
  back: ['lats', 'lowerback', 'traps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  core: ['abs', 'obliques'],
  abs: ['abs', 'obliques'],
  // ── Granular secondaries (English) ──
  forearms: ['forearms'],
  brachialis: ['forearms', 'biceps'],
  grip: ['forearms'],
  obliques: ['obliques'],
  traps: ['traps'],
  lats: ['lats'],
  'lower back': ['lowerback'],
  glutes: ['glutes'],
  quads: ['quads'],
  adductors: ['quads'],
  'hip flexors': ['quads', 'abs'],
  tfl: ['quads'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
  soleus: ['calves'],
  achilles: ['calves'],
  diaphragm: ['abs'],
  // cardio intentionally maps to nothing (no single muscle to highlight).
  cardio: [],
  // ── Hebrew labels (mirror src/constants/muscleNames.ts) ──
  חזה: ['chest'],
  גב: ['lats', 'lowerback', 'traps'],
  רגליים: ['quads', 'hamstrings', 'glutes', 'calves'],
  כתפיים: ['shoulders'],
  ידיים: ['biceps', 'triceps', 'forearms'],
  'יד קדמית': ['biceps'],
  'יד אחורית': ['triceps'],
  בטן: ['abs', 'obliques'],
  ליבה: ['abs', 'obliques'],
};

/**
 * Resolve one raw muscle key (English/Hebrew, any case/spacing) to its drawable
 * regions. Unknown keys resolve to an empty list (no highlight, never throws).
 */
export function regionsForMuscle(raw: string | undefined | null): MuscleRegion[] {
  const key = raw?.trim().toLowerCase();
  if (!key) return [];
  return KEY_TO_REGIONS[key] ?? KEY_TO_REGIONS[raw?.trim() ?? ''] ?? [];
}

/** Collapse a list of raw muscle keys into the unique set of regions to light up. */
export function regionsForMuscles(raws: ReadonlyArray<string | undefined | null>): Set<MuscleRegion> {
  const out = new Set<MuscleRegion>();
  for (const raw of raws) {
    for (const region of regionsForMuscle(raw)) out.add(region);
  }
  return out;
}
