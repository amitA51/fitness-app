/**
 * Workout Database Service (barrel)
 *
 * The data layer was split into focused modules. This file re-exports them so
 * existing importers (`from './workoutDb'`) keep working unchanged:
 *   - templateDb.ts    — workout-template CRUD + merge/replace from cloud
 *   - sessionDb.ts     — workout-session CRUD + merge/replace from cloud
 *   - bodyWeightDb.ts  — body-weight CRUD + merge/replace from cloud
 *   - exerciseDb.ts    — personal-exercise CRUD + merge/replace from cloud
 *   - cloudMerge.ts    — shared generic cloud merge/replace helpers
 *   - ../data/builtInWorkoutTemplates.ts — hardcoded starter templates
 */

export * from './templateDb';
export * from './sessionDb';
export * from './bodyWeightDb';
export * from './exerciseDb';
export * from './cloudMerge';
export * from '../data/builtInWorkoutTemplates';
