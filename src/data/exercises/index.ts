// ============================================================================
// Modular catalog groups
// ============================================================================
// Each module covers one training domain and is reviewable on its own. Order
// here is the order they appear in the library, so related work stays adjacent:
// strength first (upper → lower → core), then power, conditioning, and mobility.

import { CONDITIONING_EXERCISES } from './conditioning';
import { CORE_EXERCISES } from './core';
import { LOWER_BODY_EXERCISES } from './lowerBody';
import { MOBILITY_EXERCISES } from './mobility';
import { POWER_EXERCISES } from './power';
import type { CatalogExercise } from './types';
import { UPPER_BODY_EXERCISES } from './upperBody';

export type { CatalogExercise } from './types';

/** Every modular group, flattened in display order. */
export const MODULAR_EXERCISE_GROUPS: CatalogExercise[] = [
  ...UPPER_BODY_EXERCISES,
  ...LOWER_BODY_EXERCISES,
  ...CORE_EXERCISES,
  ...POWER_EXERCISES,
  ...CONDITIONING_EXERCISES,
  ...MOBILITY_EXERCISES,
];
