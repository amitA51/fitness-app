/**
 * WorkoutDetail helpers — previous-session derivation and share-text assembly.
 * Kept out of the page component so the presentation tree stays focused.
 */

import type { WorkoutSession } from '../../types';
import { formatDuration, formatHebrewDate, formatVolume } from '../../utils/dateUtils';
import { computeSessionStats } from '../../utils/workoutMath';

/** Shared neutral chip styling for muscle tags / highlights. */
export const MUSCLE_COLOR = {
  bg: 'var(--fs-surface-2)',
  text: 'var(--fs-ink)',
  border: 'var(--color-border)',
} as const;

/**
 * Pick the session to compare against: the most recent completed session with
 * the same template that started before `current`, falling back to the nearest
 * prior completed session of any template.
 */
export function derivePreviousSession(
  current: WorkoutSession,
  sessions: WorkoutSession[]
): WorkoutSession | null {
  const currentStart = new Date(current.startTime).getTime();
  const priorSameTemplate = current.templateId
    ? sessions
        .filter(
          (s) =>
            s.id !== current.id &&
            s.templateId === current.templateId &&
            s.status === 'completed' &&
            new Date(s.startTime).getTime() < currentStart
        )
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]
    : undefined;
  const fallback = sessions
    .filter(
      (s) =>
        s.id !== current.id &&
        s.status === 'completed' &&
        new Date(s.startTime).getTime() < currentStart
    )
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
  return priorSameTemplate ?? fallback ?? null;
}

/**
 * Build the Hebrew share string for a completed session. Set/rep totals come
 * from the canonical computeSessionStats so the shared text agrees with the
 * rest of the app.
 */
export function buildShareText(session: WorkoutSession): string {
  const date = formatHebrewDate(session.date || session.startTime);
  const duration = formatDuration(session.duration);
  const volume = formatVolume(session.totalVolume);
  const { totalSets, totalReps } = computeSessionStats(session);

  const exerciseLines = session.exercises
    .map((ex) => {
      const completedSets = ex.sets.filter((s) => s.isCompleted).length;
      return `• ${ex.name} - ${completedSets} סטים`;
    })
    .join('\n');

  return [
    `סיכום אימון - ${date}`,
    `משך: ${duration}`,
    `נפח כולל: ${volume} ק"ג`,
    `סטים: ${totalSets} | חזרות: ${totalReps}`,
    '',
    'תרגילים:',
    exerciseLines,
  ].join('\n');
}
