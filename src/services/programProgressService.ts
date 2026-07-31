/**
 * Program progress service — persisted pointer, substitutions, and cloud mirror.
 *
 * This deliberately contains no exercise catalog import. The Dashboard,
 * ordinary workout save path, and cloud restore all need this state even when a
 * trainee never opens the built-in program; importing the 218 kB generated
 * catalog there was the measured cold-route regression.
 */

import { BBT_PROGRAM_METADATA, TRAINING_DAYS, type TrainingDay } from '../data/bbtProgramMetadata';
import { logger } from '../utils/logger';
import { safeJsonParse } from '../utils/safeJson';
import { STORES, dbGetAll, dbPut } from './indexedDBCore';

export { TRAINING_DAYS, type TrainingDay } from '../data/bbtProgramMetadata';

const PROGRESS_KEY = 'bbt_program_progress_v1';
/** Per-slot exercise substitutions chosen by the trainee (movement swaps). */
const SWAPS_KEY = 'bbt_program_swaps_v1';
/** Deterministic id for the single, reusable hidden "current day" template. */
export const PROGRAM_DAY_TEMPLATE_ID = '__bbt_program_day__';

export interface CompletedDay {
  week: number;
  dayType: TrainingDay;
  date: string;
  sessionId: string;
}

export interface PendingDay {
  week: number;
  dayType: TrainingDay;
  startedAt: string;
  /**
   * Only the template id created for this program day can advance progress.
   * This prevents an unrelated free/template workout from marking it complete.
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
  /** Last-write-wins clock for the cloud mirror. */
  updatedAt?: string;
}

/** Linear position within the program (week*days + dayIndex) for ordering. */
const linearIndex = (week: number, dayIndex: number): number =>
  (week - 1) * TRAINING_DAYS.length + dayIndex;

export const getProgress = (): ProgramProgress | null => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return safeJsonParse<ProgramProgress>(raw) ?? null;
  } catch (err) {
    logger.app?.warn?.('Failed to read program progress', err);
    return null;
  }
};

/**
 * Mirror a localStorage-only key into the cloud-synced `user_settings` store.
 *
 * Progress is user-scoped local data and gets correctly cleared on sign-out,
 * session expiry, and account switches. Mirroring makes that privacy-preserving
 * wipe recoverable after the next authenticated pull instead of resetting a
 * multi-week program permanently. This remains fire-and-forget: localStorage is
 * the synchronous source of truth and the offline queue retries uploads.
 */
const mirrorToCloud = (key: string, value: unknown, updatedAt: string): void => {
  void (async () => {
    try {
      await dbPut(STORES.USER_SETTINGS, { key, value, updatedAt, createdAt: updatedAt });
      const { queueMutation } = await import('./offlineQueue');
      await queueMutation('setting:update', { key, value, updatedAt, createdAt: updatedAt });
    } catch (err) {
      logger.app?.warn?.('Failed to mirror program state to the cloud', err);
    }
  })();
};

const saveProgress = (progress: ProgramProgress): void => {
  const stamped: ProgramProgress = { ...progress, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(stamped));
  } catch (err) {
    logger.app?.warn?.('Failed to persist program progress', err);
  }
  mirrorToCloud(PROGRESS_KEY, stamped, stamped.updatedAt as string);
};

/**
 * Rehydrate program progress and swaps after a cloud pull has merged
 * `user_settings` into IndexedDB. Newer local state wins to protect an offline
 * session that has not uploaded yet.
 */
export const restoreProgramProgressFromCloud = async (): Promise<boolean> => {
  let restored = false;
  try {
    const rows = await dbGetAll<{ key: string; value: unknown; updatedAt?: string }>(
      STORES.USER_SETTINGS
    );

    for (const key of [PROGRESS_KEY, SWAPS_KEY]) {
      const row = rows.find((candidate) => candidate.key === key);
      if (!row || row.value == null) continue;

      const localRaw = localStorage.getItem(key);
      if (localRaw) {
        const localUpdatedAt =
          safeJsonParse<{ updatedAt?: string }>(localRaw)?.updatedAt ?? '1970-01-01T00:00:00.000Z';
        if (!row.updatedAt || row.updatedAt <= localUpdatedAt) continue;
      }

      try {
        localStorage.setItem(key, JSON.stringify(row.value));
        restored = true;
      } catch (err) {
        logger.app?.warn?.('Failed to write restored program state', err);
      }
    }
  } catch (err) {
    logger.app?.warn?.('Failed to restore program progress from the cloud', err);
  }
  return restored;
};

export const startProgram = (): ProgramProgress => {
  const existing = getProgress();
  if (existing) return existing;

  const fresh: ProgramProgress = {
    programId: BBT_PROGRAM_METADATA.id,
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

  // Preserve an explicit reset across the next cloud restore. Empty values are
  // tombstones for the existing user_settings upsert path.
  mirrorToCloud(PROGRESS_KEY, null, new Date().toISOString());
  mirrorToCloud(SWAPS_KEY, {}, new Date().toISOString());
};

export const isDayCompleted = (week: number, dayType: TrainingDay): boolean => {
  const progress = getProgress();
  return !!progress?.completed.some(
    (completed) => completed.week === week && completed.dayType === dayType
  );
};

export const getCurrentPosition = (): { week: number; dayType: TrainingDay } => {
  const progress = getProgress() ?? startProgram();
  return {
    week: progress.currentWeek,
    dayType: TRAINING_DAYS[progress.currentDayIndex] ?? 'Upper',
  };
};

/** Persist the pending identity only after programCatalogService materializes a day template. */
export const markProgramDayPending = (
  progress: ProgramProgress,
  week: number,
  dayType: TrainingDay,
  expectedTemplateId: string
): void => {
  saveProgress({
    ...progress,
    pending: {
      week,
      dayType,
      startedAt: new Date().toISOString(),
      expectedTemplateId,
    },
  });
};

// ---------------------------------------------------------------------------
// Exercise substitutions — state only. Catalog lookup/materialization belongs
// in programCatalogService so reading a swap cannot pull exercise payloads.
// ---------------------------------------------------------------------------

export const programDaySwapKey = (week: number, dayType: TrainingDay, order: number): string =>
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

const saveSwaps = (swaps: Record<string, string>): void => {
  try {
    localStorage.setItem(SWAPS_KEY, JSON.stringify(swaps));
  } catch (err) {
    logger.app?.warn?.('Failed to persist program swaps', err);
  }
  mirrorToCloud(SWAPS_KEY, swaps, new Date().toISOString());
};

export const getSwapFor = (week: number, dayType: TrainingDay, order: number): string | null =>
  getSwaps()[programDaySwapKey(week, dayType, order)] ?? null;

/** Set (choice = label) or clear (choice = null) a movement substitution. */
export const setSwap = (
  week: number,
  dayType: TrainingDay,
  order: number,
  choice: string | null
): void => {
  const swaps = getSwaps();
  const key = programDaySwapKey(week, dayType, order);
  if (choice == null) delete swaps[key];
  else swaps[key] = choice;
  saveSwaps(swaps);
};

/**
 * Advance after a completed workout only when it matches the pending program
 * template. This function is intentionally catalog-free because every normal
 * workout save calls it best-effort.
 */
export const reconcileProgramOnSessionSave = (session: {
  startTime?: string;
  status?: string;
  id: string;
  templateId?: string | null;
}): void => {
  try {
    const progress = getProgress();
    if (!progress || !progress.pending || session.status !== 'completed') return;
    if (session.templateId !== progress.pending.expectedTemplateId) return;
    if (progress.lastReconciledSessionId === session.id) return;

    const startedAt = new Date(progress.pending.startedAt).getTime();
    const sessionStart = session.startTime ? new Date(session.startTime).getTime() : Date.now();
    if (sessionStart < startedAt - 60_000) return;

    const { week, dayType } = progress.pending;
    const completed: CompletedDay[] = progress.completed.some(
      (day) => day.week === week && day.dayType === dayType
    )
      ? progress.completed
      : [
          ...progress.completed,
          { week, dayType, date: new Date(sessionStart).toISOString(), sessionId: session.id },
        ];

    const completedIndex = TRAINING_DAYS.indexOf(dayType);
    let nextWeek = week;
    let nextDayIndex = completedIndex + 1;
    if (nextDayIndex >= TRAINING_DAYS.length) {
      nextDayIndex = 0;
      nextWeek += 1;
    }

    const advanced =
      linearIndex(nextWeek, nextDayIndex) >
      linearIndex(progress.currentWeek, progress.currentDayIndex);
    const done = nextWeek > BBT_PROGRAM_METADATA.totalWeeks;

    saveProgress({
      ...progress,
      completed,
      pending: null,
      lastReconciledSessionId: session.id,
      currentWeek: done ? progress.currentWeek : advanced ? nextWeek : progress.currentWeek,
      currentDayIndex: done
        ? progress.currentDayIndex
        : advanced
          ? nextDayIndex
          : progress.currentDayIndex,
      status: done ? 'completed' : progress.status,
    });
  } catch (err) {
    logger.app?.warn?.('Program reconcile failed', err);
  }
};
