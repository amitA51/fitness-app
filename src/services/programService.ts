/**
 * Program Service — drives the built-in 12-week "Bodybuilding Transformation
 * System" as a guided, self-paced program.
 *
 * Responsibilities:
 *  - Persist the trainee's progress (current week/day, completed sessions).
 *  - Materialize the CURRENT program day into a hidden, app-managed
 *    WorkoutTemplate (carrying rich `programExtras`) so the existing workout
 *    runner can start from it by id.
 *  - Reconcile on workout-save: when the started day's workout completes, mark
 *    it done and advance to the next day.
 *
 * Progress lives in localStorage (consistent with onboarding/profile/draft
 * persistence in this app) so it survives reloads without a DB migration.
 */

import { BBT_PROGRAM, type BbtDay, type BbtExercise } from '../data/bbtProgram.generated';
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../types';
import { logger } from '../utils/logger';
import { safeJsonParse } from '../utils/safeJson';
import { STORES, dbPut } from './indexedDBCore';

const PROGRESS_KEY = 'bbt_program_progress_v1';
/** Per-slot exercise substitutions chosen by the trainee (movement swaps). */
const SWAPS_KEY = 'bbt_program_swaps_v1';
/** Deterministic id for the single, reusable hidden "current day" template. */
export const PROGRAM_DAY_TEMPLATE_ID = '__bbt_program_day__';

/** The five trainable days of each week, in order. Rest days sit between them. */
export const TRAINING_DAYS = ['Upper', 'Lower', 'Pull', 'Push', 'Legs'] as const;
export type TrainingDay = (typeof TRAINING_DAYS)[number];

export interface CompletedDay {
  week: number;
  dayType: TrainingDay;
  date: string;
  sessionId: string;
}

export interface PendingDay {
  week: number;
  dayType: TrainingDay;
  startedAt: string; // ISO
  /**
   * The workout-template id the trainee was sent to when this day was started.
   * Reconcile only advances when the completed session reports THIS template id,
   * so an unrelated free/template workout can't falsely mark the day done.
   */
  expectedTemplateId: string;
}

export interface ProgramProgress {
  programId: string;
  startedAt: string;
  /** 1..12 */
  currentWeek: number;
  /** 0..4 — index into TRAINING_DAYS */
  currentDayIndex: number;
  completed: CompletedDay[];
  pending: PendingDay | null;
  status: 'active' | 'completed';
  /** Last session id reconciled — guards against double-advance on re-entry. */
  lastReconciledSessionId?: string;
}

// ---------------------------------------------------------------------------
// Lookup helpers over the static program data
// ---------------------------------------------------------------------------

const DAY_MAP: Map<string, BbtDay> = new Map(
  BBT_PROGRAM.days.map((d) => [`${d.week}-${d.dayType}`, d])
);

export const getProgramDay = (week: number, dayType: TrainingDay): BbtDay | null =>
  DAY_MAP.get(`${week}-${dayType}`) ?? null;

export const getBlockForWeek = (week: number): { name: string; nameHe: string } => {
  const block = BBT_PROGRAM.blocks.find((b) => b.weeks.includes(week));
  return block ? { name: block.name, nameHe: block.nameHe } : { name: '', nameHe: '' };
};

/** Linear position within the program (week*days + dayIndex) for ordering. */
const linearIndex = (week: number, dayIndex: number): number =>
  (week - 1) * TRAINING_DAYS.length + dayIndex;

// ---------------------------------------------------------------------------
// Progress persistence
// ---------------------------------------------------------------------------

export const getProgress = (): ProgramProgress | null => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<ProgramProgress>(raw);
    return parsed ?? null;
  } catch (err) {
    logger.app?.warn?.('Failed to read program progress', err);
    return null;
  }
};

const saveProgress = (p: ProgramProgress): void => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (err) {
    logger.app?.warn?.('Failed to persist program progress', err);
  }
};

export const startProgram = (): ProgramProgress => {
  const existing = getProgress();
  if (existing) return existing;
  const fresh: ProgramProgress = {
    programId: BBT_PROGRAM.id,
    startedAt: new Date().toISOString(),
    currentWeek: 1,
    currentDayIndex: 0,
    completed: [],
    pending: null,
    status: 'active',
  };
  saveProgress(fresh);
  return fresh;
};

export const resetProgram = (): void => {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(SWAPS_KEY);
  } catch (err) {
    logger.app?.warn?.('Failed to reset program progress', err);
  }
};

export const isDayCompleted = (week: number, dayType: TrainingDay): boolean => {
  const p = getProgress();
  return !!p?.completed.some((c) => c.week === week && c.dayType === dayType);
};

export const getCurrentPosition = (): { week: number; dayType: TrainingDay } => {
  const p = getProgress() ?? startProgram();
  return { week: p.currentWeek, dayType: TRAINING_DAYS[p.currentDayIndex] ?? 'Upper' };
};

// ---------------------------------------------------------------------------
// Materialize a program day -> hidden WorkoutTemplate
// ---------------------------------------------------------------------------

const bilingual = (he: string, en: string): string => (he && he !== en ? `${he} | ${en}` : en);

const buildCoachingNote = (ex: BbtExercise): string => {
  const parts: string[] = [];
  parts.push(`טווח חזרות ${ex.reps} · RPE ${ex.earlyRpe}→${ex.lastRpe}`);
  if (ex.warmupSets) parts.push(`חימום: ${ex.warmupSets} סטים`);
  if (ex.techniqueHe) parts.push(`סט אחרון: ${ex.techniqueHe}`);
  const meta = parts.join(' · ');
  return ex.notes ? `${meta}\n${ex.notes}` : meta;
};

// ---------------------------------------------------------------------------
// Exercise substitutions — let the trainee swap a movement for one of its
// listed alternatives (machine taken, niggle, preference). Persisted separately
// from progress so a swap survives and can be cleared without touching history.
// ---------------------------------------------------------------------------

const swapKey = (week: number, dayType: TrainingDay, order: number): string =>
  `${week}-${dayType}-${order}`;

export const getSwaps = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(SWAPS_KEY);
    if (!raw) return {};
    return safeJsonParse<Record<string, string>>(raw) ?? {};
  } catch (err) {
    logger.app?.warn?.('Failed to read program swaps', err);
    return {};
  }
};

const saveSwaps = (s: Record<string, string>): void => {
  try {
    localStorage.setItem(SWAPS_KEY, JSON.stringify(s));
  } catch (err) {
    logger.app?.warn?.('Failed to persist program swaps', err);
  }
};

export const getSwapFor = (week: number, dayType: TrainingDay, order: number): string | null =>
  getSwaps()[swapKey(week, dayType, order)] ?? null;

/** Set (choice = a label) or clear (choice = null) the movement for one slot. */
export const setSwap = (
  week: number,
  dayType: TrainingDay,
  order: number,
  choice: string | null
): void => {
  const swaps = getSwaps();
  const k = swapKey(week, dayType, order);
  if (choice == null) delete swaps[k];
  else swaps[k] = choice;
  saveSwaps(swaps);
};

export interface ExerciseOption {
  /** Bilingual "Hebrew | English" label — this is the stored swap value. */
  label: string;
  /** Hebrew-only display label. */
  he: string;
}

/** The original movement plus its listed alternatives, as selectable options. */
export const getExerciseOptions = (ex: BbtExercise): ExerciseOption[] => {
  const raw: ExerciseOption[] = [
    { label: bilingual(ex.nameHe, ex.name), he: ex.nameHe || ex.name },
    { label: bilingual(ex.sub1He, ex.sub1), he: ex.sub1He || ex.sub1 },
    { label: bilingual(ex.sub2He, ex.sub2), he: ex.sub2He || ex.sub2 },
  ];
  const seen = new Set<string>();
  return raw.filter((o) => Boolean(o.label) && !seen.has(o.label) && seen.add(o.label) !== null);
};

/** The English (canonical) side of a bilingual "Hebrew | English" label. */
const englishOf = (label: string): string => {
  const idx = label.lastIndexOf('|');
  return idx >= 0 ? label.slice(idx + 1).trim() : label.trim();
};

export const buildTemplateForDay = (
  day: BbtDay,
  swaps: Record<string, string> = {}
): WorkoutTemplate => {
  const now = new Date().toISOString();
  const exercises: WorkoutTemplateExercise[] = day.exercises.map((ex, i) => {
    const options = getExerciseOptions(ex);
    const originalLabel = options[0]?.label ?? bilingual(ex.nameHe, ex.name);
    const stored = swaps[swapKey(day.week, day.dayType, ex.order)];
    // Fall back to the original if the stored choice is unknown (data drift).
    const name = stored && options.some((o) => o.label === stored) ? stored : originalLabel;
    const alternatives = options.map((o) => o.label).filter((l) => l !== name);
    const note = buildCoachingNote(ex);
    return {
      id: `bbt-w${day.week}-${day.dayType}-${ex.order}`,
      exerciseId: englishOf(name),
      exerciseName: name,
      name,
      targetMuscle: ex.muscle,
      muscleGroup: ex.muscle,
      targetSets: ex.workingSets,
      targetReps: ex.targetReps,
      targetWeight: null,
      restSeconds: ex.restSeconds,
      targetRestTime: ex.restSeconds,
      order: i,
      notes: note,
      programExtras: {
        rpeTarget: ex.rpeTarget ?? undefined,
        restTime: ex.restSeconds,
        intensityTechnique: ex.techniqueHe || undefined,
        alternatives,
        notes: note,
      },
      sets: Array.from({ length: Math.max(1, ex.workingSets) }, () => ({
        reps: ex.targetReps,
        weight: 0,
      })),
    };
  });

  const muscleGroups = Array.from(new Set(day.exercises.map((e) => e.muscle)));

  return {
    id: PROGRAM_DAY_TEMPLATE_ID,
    name: `${BBT_PROGRAM.titleHe} · שבוע ${day.week} · ${day.dayHe}`,
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
 * Materialize the given program day into the hidden runner template and record
 * it as the pending session. Returns the template id to navigate to
 * (`/workout/:id`). Falls back to the current position if no day is provided.
 */
export const startProgramDay = async (
  week?: number,
  dayType?: TrainingDay
): Promise<string | null> => {
  const progress = getProgress() ?? startProgram();
  const w = week ?? progress.currentWeek;
  const dt = dayType ?? TRAINING_DAYS[progress.currentDayIndex] ?? 'Upper';
  const day = getProgramDay(w, dt);
  if (!day) {
    logger.app?.warn?.('No program day found', { week: w, dayType: dt });
    return null;
  }

  const template = buildTemplateForDay(day, getSwaps());
  await dbPut(STORES.WORKOUT_TEMPLATES, template);

  saveProgress({
    ...progress,
    pending: {
      week: w,
      dayType: dt,
      startedAt: new Date().toISOString(),
      expectedTemplateId: template.id,
    },
  });

  return template.id;
};

// ---------------------------------------------------------------------------
// Advance on workout completion
// ---------------------------------------------------------------------------

/**
 * Called after a workout session is saved (mirrors the coach schedule reconcile).
 * If a program day was started and this completed session began at/after it,
 * mark the day done and advance the pointer to the next day.
 */
export const reconcileProgramOnSessionSave = (session: {
  startTime?: string;
  status?: string;
  id: string;
  /** Template id the completed workout was started from (null for free workouts). */
  templateId?: string | null;
}): void => {
  try {
    const p = getProgress();
    if (!p || !p.pending || session.status !== 'completed') return;

    // Identity guard — only advance when the completed session came from the
    // program-day template we sent the trainee to. Without this, abandoning a
    // program day and then doing ANY other workout would falsely mark the day
    // done and corrupt the 12-week progression.
    if (session.templateId !== p.pending.expectedTemplateId) return;

    // Idempotency — a session can be reconciled at most once (best-effort save
    // paths and page re-entry can fire this more than once for the same id).
    if (p.lastReconciledSessionId === session.id) return;

    const startedAt = new Date(p.pending.startedAt).getTime();
    const sessionStart = session.startTime ? new Date(session.startTime).getTime() : Date.now();
    // The just-completed workout must have begun at/after we started the day
    // (allow a small clock-skew epsilon).
    if (sessionStart < startedAt - 60_000) return;

    const { week, dayType } = p.pending;
    const completed: CompletedDay[] = p.completed.some(
      (c) => c.week === week && c.dayType === dayType
    )
      ? p.completed
      : [
          ...p.completed,
          {
            week,
            dayType,
            date: new Date(sessionStart).toISOString(),
            sessionId: session.id,
          },
        ];

    // Advance the pointer to the day AFTER the one just completed, but never
    // move backwards if the trainee re-did an earlier day.
    const completedIdx = TRAINING_DAYS.indexOf(dayType);
    let nextWeek = week;
    let nextDayIndex = completedIdx + 1;
    if (nextDayIndex >= TRAINING_DAYS.length) {
      nextDayIndex = 0;
      nextWeek += 1;
    }

    const curLinear = linearIndex(p.currentWeek, p.currentDayIndex);
    const nextLinear = linearIndex(nextWeek, nextDayIndex);
    const advanced = nextLinear > curLinear;

    const done = nextWeek > BBT_PROGRAM.totalWeeks;

    saveProgress({
      ...p,
      completed,
      pending: null,
      lastReconciledSessionId: session.id,
      currentWeek: done ? p.currentWeek : advanced ? nextWeek : p.currentWeek,
      currentDayIndex: done ? p.currentDayIndex : advanced ? nextDayIndex : p.currentDayIndex,
      status: done ? 'completed' : p.status,
    });
  } catch (err) {
    logger.app?.warn?.('Program reconcile failed', err);
  }
};
