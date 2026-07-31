/**
 * Legacy program-service facade.
 *
 * New production callers import the narrow progress, metadata, or catalog
 * boundary directly. This facade preserves the historic import surface without
 * statically importing bbtProgram.generated.ts: full-day APIs remain async and
 * resolve the catalog only when a caller explicitly uses them.
 */

export {
  PROGRAM_DAY_TEMPLATE_ID,
  TRAINING_DAYS,
  type CompletedDay,
  type PendingDay,
  type ProgramProgress,
  type TrainingDay,
  getCurrentPosition,
  getProgress,
  getSwapFor,
  getSwaps,
  isDayCompleted,
  markProgramDayPending,
  programDaySwapKey,
  reconcileProgramOnSessionSave,
  resetProgram,
  restoreProgramProgressFromCloud,
  setSwap,
  startProgram,
} from './programProgressService';

export { getBlockForWeek } from '../data/bbtProgramMetadata';

export {
  type BbtDay,
  type BbtExercise,
  type BbtProgram,
  type ExerciseOption,
  buildTemplateForDay,
  enDashRange,
  findProgramDay,
  getExerciseOptions,
  getProgramDay,
  loadProgramCatalog,
  parseRestRange,
  parseWarmupCount,
  restRangeHe,
  startProgramDay,
} from './programCatalogService';
