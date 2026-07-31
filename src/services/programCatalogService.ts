/**
 * Program catalog service — full BBT exercise lookup and day materialization.
 *
 * The generated catalog is ~218 kB emitted. This module is the only runtime
 * owner of its dynamic import, so progress cards, ordinary workout saves, and
 * cloud restore do not schedule it. Consumers call this only to render full
 * program content or to materialize an explicitly chosen program workout.
 */

import type { BbtDay, BbtExercise, BbtProgram } from '../data/bbtProgram.generated';
import { BBT_PROGRAM_METADATA } from '../data/bbtProgramMetadata';
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../types';
import { logger } from '../utils/logger';
import { STORES, dbPut } from './indexedDBCore';
import {
  PROGRAM_DAY_TEMPLATE_ID,
  TRAINING_DAYS,
  type TrainingDay,
  getProgress,
  getSwaps,
  markProgramDayPending,
  programDaySwapKey,
  startProgram,
} from './programProgressService';

export type { BbtDay, BbtExercise, BbtProgram } from '../data/bbtProgram.generated';
export { getBlockForWeek } from '../data/bbtProgramMetadata';

let catalogPromise: Promise<BbtProgram> | null = null;

/**
 * Load exercise prescriptions only at an explicit full-program boundary. The
 * promise is memoized so browsing the Program route and starting a day share
 * one module fetch and parse.
 */
export const loadProgramCatalog = (): Promise<BbtProgram> => {
  if (!catalogPromise) {
    catalogPromise = import('../data/bbtProgram.generated').then(({ BBT_PROGRAM }) => BBT_PROGRAM);
  }
  return catalogPromise;
};

/** Pure lookup for consumers that have intentionally loaded the whole catalog. */
export const findProgramDay = (
  program: Pick<BbtProgram, 'days'>,
  week: number,
  dayType: TrainingDay
): BbtDay | null =>
  program.days.find((day) => day.week === week && day.dayType === dayType) ?? null;

/** Full-day lookup. This is asynchronous by design to keep generated data lazy. */
export const getProgramDay = async (week: number, dayType: TrainingDay): Promise<BbtDay | null> =>
  findProgramDay(await loadProgramCatalog(), week, dayType);

const bilingual = (he: string, en: string): string => (he && he !== en ? `${he} | ${en}` : en);

/** Normalize an ASCII hyphen range to a typographic en-dash: "8-10" → "8–10". */
export const enDashRange = (value: string): string => value.replace(/\s*-\s*/g, '–');

/**
 * "3-5 min" / "90-120 sec" / "2 min" → low/high seconds. The lower end is
 * the runner's default timer target while the upper end remains visible.
 */
export const parseRestRange = (rest: string): { min: number; max: number } => {
  const isSec = /sec|שנ/i.test(rest) && !/min|דק/i.test(rest);
  const numbers = (rest.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const unit = isSec ? 1 : 60;
  const min = (numbers[0] ?? 1.5) * unit;
  const max = (numbers[1] ?? numbers[0] ?? 2) * unit;
  return { min: Math.round(min), max: Math.round(max) };
};

/** "2-3" / "2" → sensible warmup count (low end, capped at four). */
export const parseWarmupCount = (value: string): number => {
  const numbers = (value.match(/\d+/g) ?? []).map(Number);
  return Math.min(4, Math.max(0, numbers[0] ?? 0));
};

/** Render a PDF rest range with its Hebrew unit, without a caller-specific label. */
export const restRangeHe = (rest: string): string => {
  const isSec = /sec|שנ/i.test(rest) && !/min|דק/i.test(rest);
  const unitHe = isSec ? "שנ'" : "דק'";
  const numbers = rest.match(/\d+(?:\.\d+)?/g) ?? [];
  if (numbers.length === 0) return rest;
  const body = numbers.length >= 2 ? `${numbers[0]}–${numbers[1]}` : `${numbers[0]}`;
  return `${body} ${unitHe}`;
};

const buildCoachingNote = (exercise: BbtExercise): string => {
  const parts: string[] = [
    `טווח חזרות ${exercise.reps} · RPE ${exercise.earlyRpe}→${exercise.lastRpe}`,
  ];
  if (exercise.warmupSets) parts.push(`חימום: ${exercise.warmupSets} סטים`);
  if (exercise.techniqueHe) parts.push(`סט אחרון: ${exercise.techniqueHe}`);
  const metadata = parts.join(' · ');
  return exercise.notes ? `${metadata}\n${exercise.notes}` : metadata;
};

export interface ExerciseOption {
  /** Bilingual "Hebrew | English" label — this is the stored swap value. */
  label: string;
  /** Hebrew-only display label. */
  he: string;
}

/** The original movement plus its listed alternatives, deduped for selection. */
export const getExerciseOptions = (exercise: BbtExercise): ExerciseOption[] => {
  const raw: ExerciseOption[] = [
    { label: bilingual(exercise.nameHe, exercise.name), he: exercise.nameHe || exercise.name },
    { label: bilingual(exercise.sub1He, exercise.sub1), he: exercise.sub1He || exercise.sub1 },
    { label: bilingual(exercise.sub2He, exercise.sub2), he: exercise.sub2He || exercise.sub2 },
  ];
  const seen = new Set<string>();
  return raw.filter(
    (option) => Boolean(option.label) && !seen.has(option.label) && seen.add(option.label) !== null
  );
};

/** The English (canonical) side of a bilingual "Hebrew | English" label. */
const englishOf = (label: string): string => {
  const index = label.lastIndexOf('|');
  return index >= 0 ? label.slice(index + 1).trim() : label.trim();
};

/**
 * Build the hidden runner template after a full BBT day has been deliberately
 * loaded. This preserves every prescription and only replaces selected movement
 * labels with persisted per-slot substitutions.
 */
export const buildTemplateForDay = (
  day: BbtDay,
  swaps: Record<string, string> = {}
): WorkoutTemplate => {
  const now = new Date().toISOString();
  const exercises: WorkoutTemplateExercise[] = day.exercises.map((exercise, index) => {
    const options = getExerciseOptions(exercise);
    const originalLabel = options[0]?.label ?? bilingual(exercise.nameHe, exercise.name);
    const stored = swaps[programDaySwapKey(day.week, day.dayType, exercise.order)];
    const name =
      stored && options.some((option) => option.label === stored) ? stored : originalLabel;
    const alternatives = options.map((option) => option.label).filter((label) => label !== name);
    const note = buildCoachingNote(exercise);
    const restRange = parseRestRange(exercise.rest);
    const warmupCount = parseWarmupCount(exercise.warmupSets);

    return {
      id: `bbt-w${day.week}-${day.dayType}-${exercise.order}`,
      exerciseId: englishOf(name),
      exerciseName: name,
      name,
      targetMuscle: exercise.muscle,
      muscleGroup: exercise.muscle,
      targetSets: exercise.workingSets,
      targetReps: exercise.targetReps,
      targetWeight: null,
      restSeconds: restRange.min,
      targetRestTime: restRange.min,
      order: index,
      notes: note,
      programExtras: {
        rpeTarget: exercise.rpeTarget ?? undefined,
        restTime: restRange.min,
        intensityTechnique: exercise.techniqueHe || undefined,
        alternatives,
        notes: note,
        repRange: enDashRange(exercise.reps),
        restRange: restRangeHe(exercise.rest),
        restSecondsMin: restRange.min,
        restSecondsMax: restRange.max,
        warmupSets: warmupCount,
        warmupRange: exercise.warmupSets ? enDashRange(exercise.warmupSets) : undefined,
        workingSets: exercise.workingSets,
        earlyRpe: exercise.earlyRpe || undefined,
        lastRpe: exercise.lastRpe || undefined,
        coachingNote: exercise.notes || undefined,
      },
      sets: Array.from({ length: Math.max(1, exercise.workingSets) }, () => ({
        reps: exercise.targetReps,
        weight: 0,
      })),
    };
  });

  const muscleGroups = Array.from(new Set(day.exercises.map((exercise) => exercise.muscle)));
  return {
    id: PROGRAM_DAY_TEMPLATE_ID,
    name: `${BBT_PROGRAM_METADATA.titleHe} · שבוע ${day.week} · ${day.dayHe}`,
    description: `${day.blockHe} · ${day.dayHe}`,
    exercises,
    createdAt: now,
    updatedAt: now,
    lastUsed: null,
    timesUsed: 0,
    isFavorite: false,
    muscleGroups,
    isBuiltin: false,
    isProgramHidden: true,
  };
};

/**
 * Materialize a selected program day and only then persist its pending identity.
 * The catalog fetch is intentionally inside this explicit start path.
 */
export const startProgramDay = async (
  week?: number,
  dayType?: TrainingDay
): Promise<string | null> => {
  const progress = getProgress() ?? startProgram();
  const resolvedWeek = week ?? progress.currentWeek;
  const resolvedDayType = dayType ?? TRAINING_DAYS[progress.currentDayIndex] ?? 'Upper';
  const day = await getProgramDay(resolvedWeek, resolvedDayType);
  if (!day) {
    logger.app?.warn?.('No program day found', { week: resolvedWeek, dayType: resolvedDayType });
    return null;
  }

  await dbPut(STORES.WORKOUT_TEMPLATES, buildTemplateForDay(day, getSwaps()));
  markProgramDayPending(progress, resolvedWeek, resolvedDayType, PROGRAM_DAY_TEMPLATE_ID);
  return PROGRAM_DAY_TEMPLATE_ID;
};
