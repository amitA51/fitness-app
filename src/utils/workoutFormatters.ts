// ============================================================================
// workoutFormatters — canonical, single-source workout display formatters.
// ============================================================================
// Consolidates the `formatDate` / `formatDuration` / `formatVolume` helpers that
// were duplicated across RecentWorkouts, WorkoutHistoryList, WorkoutHistoryScreen
// (and assorted nutrition surfaces). Duration/volume already had a canonical home
// in `dateUtils`, so those are re-exported here rather than re-implemented — this
// module is the ONE obvious import for workout-history surfaces while reusing the
// existing, tested primitives underneath.

import {
  formatDuration as formatDurationSeconds,
  formatVolume as formatVolumeRaw,
} from './dateUtils';

/**
 * Human, RTL-friendly date label for a workout row.
 *
 * - Today  → "היום"
 * - Yesterday → "אתמול"
 * - Otherwise → short weekday + day + month (he-IL), e.g. "יום ב׳, 12 מאי".
 *
 * Accepts an ISO timestamp, a `YYYY-MM-DD` string, or a `Date`. Returns an empty
 * string for unparseable input so callers never render "Invalid Date".
 */
export const formatDate = (dateLike: string | Date): string => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';

  // Compare on calendar days (local midnight), not raw 24h windows, so a
  // late-evening entry isn't mislabelled.
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86400000
  );

  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';

  return date.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Workout duration label from a duration in SECONDS (the `WorkoutSession.duration`
 * shape). e.g. 1500 → "25 דקות", 5400 → "שעה ו-30 דקות". Delegates to the
 * canonical `dateUtils.formatDuration`.
 */
export const formatDuration = (seconds: number): string => formatDurationSeconds(seconds);

/**
 * Compact total-volume label. e.g. 12500 → "12.5k", 800 → "800". Delegates to the
 * canonical `dateUtils.formatVolume`.
 */
export const formatVolume = (volume: number): string => formatVolumeRaw(volume);
