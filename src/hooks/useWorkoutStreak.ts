/**
 * useWorkoutStreak — the single source of truth for workout-streak math.
 *
 * Unifies the two former implementations:
 *  1. The local `useMemo` block inside `components/dashboard/WorkoutStreak.tsx`.
 *  2. `computeStreak` in `hooks/fitness/insightsAggregator.ts` (used by
 *     `pages/progress/tabs/OverviewTab.tsx`).
 *
 * It builds the unique set of completed-workout calendar days (local time,
 * `YYYY-MM-DD`) and delegates the consecutive-day math to the canonical
 * `computeStreak`, then adds the `activeToday` flag the dashboard surface needs.
 * Keeping the arithmetic in one place means the dashboard chip and the progress
 * tab can never drift apart.
 *
 * @example
 * const { current, best, activeToday } = useWorkoutStreak(sessions);
 * if (current > 0) return <StreakChip days={current} live={activeToday} />;
 */
import { useMemo } from 'react';
import type { WorkoutSession } from '../types';
import { computeStreak } from './fitness/insightsAggregator';

export interface WorkoutStreakResult {
  /** Consecutive-day streak ending today (or yesterday if today is unlogged). */
  current: number;
  /** Longest consecutive-day run ever recorded. */
  best: number;
  /** Whether a completed workout exists for today's calendar date. */
  activeToday: boolean;
}

/** Local-time `YYYY-MM-DD` key — matches the format used across the codebase. */
function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derive streak metrics from a list of workout sessions.
 *
 * @param sessions - All known sessions; only `status === 'completed'` count.
 * @returns Stable `{ current, best, activeToday }` (memoized on `sessions`).
 */
export function useWorkoutStreak(sessions: readonly WorkoutSession[]): WorkoutStreakResult {
  return useMemo(() => {
    const completedDays = new Set<string>();
    for (const session of sessions) {
      if (session.status !== 'completed') continue;
      completedDays.add(toLocalDayKey(new Date(session.startTime)));
    }

    if (completedDays.size === 0) {
      return { current: 0, best: 0, activeToday: false };
    }

    const now = new Date();
    const { currentStreak, longestStreak } = computeStreak(completedDays, now);

    return {
      current: currentStreak,
      best: Math.max(longestStreak, currentStreak),
      activeToday: completedDays.has(toLocalDayKey(now)),
    };
  }, [sessions]);
}

export default useWorkoutStreak;
