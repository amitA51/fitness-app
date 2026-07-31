// ============================================================================
// Shared shape for the modular catalog groups
// ============================================================================
// The original catalog lived in one 1,500-line file. New material is grouped by
// training domain instead, so each area stays reviewable on its own and a gap
// ("we have no mobility work") is visible from the file list.
//
// Every record is authored to the same contract:
//   name          'עברית | English' — the Hebrew term an Israeli lifter uses,
//                 with the English name kept so search works in both languages.
//                 NEVER edit a shipped name: services/exerciseDb de-duplicates
//                 built-ins by name, so a rename re-seeds a duplicate.
//   notes         WHAT it trains and why you would pick it. Hebrew.
//   tutorialText  HOW to perform it, in the order you do it. Hebrew.
//   mechanic      compound = several joints, isolation = one.
//   force         push / pull / static. Omitted for pure conditioning work,
//                 where nothing is being pressed or pulled.
//   level         honest skill requirement, not marketing.
//   primaryMuscle fine-grained prime mover (constants/exerciseClassification).

import type { PersonalExercise } from '../../types';

/** A catalog record before the runtime id/timestamp fields are injected. */
export type CatalogExercise = Omit<PersonalExercise, 'id' | 'createdAt' | 'lastUsed' | 'useCount'>;
