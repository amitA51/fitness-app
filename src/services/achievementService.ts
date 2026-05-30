// ============================================================================
// SPARKOS FITNESS - Streak Calculation
// ============================================================================
// Computes consecutive-day workout counts and week aggregates from sessions.
// Pure utility — no UI, no storage, no badges. Gamification-free.

import type { WorkoutSession } from '../types';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
  workoutsThisWeek: number;
}

export const calculateStreak = (sessions: WorkoutSession[], now: Date = new Date()): StreakInfo => {
  if (sessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      workoutsThisWeek: 0,
    };
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const lastWorkoutDate = sortedSessions[0]?.startTime ?? null;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const workoutsThisWeek = sortedSessions.filter((s) => new Date(s.startTime) >= weekStart).length;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const workoutDates = sortedSessions.map((s) => {
    const d = new Date(s.startTime);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const uniqueDates = [...new Set(workoutDates)].sort().reverse();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Determine the anchor date: if the most recent workout was today, start
  // counting from today; otherwise start from yesterday (an active streak
  // shouldn't read 0 just because the user hasn't trained yet today).
  let anchor = new Date(today);
  if (uniqueDates.length > 0) {
    const [y, m, d] = (uniqueDates[0] as string).split('-').map(Number) as [number, number, number];
    const latestLocal = new Date(y, m - 1, d);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (latestLocal.getTime() === yesterday.getTime()) {
      anchor = yesterday;
    }
  }

  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = uniqueDates[i];
    if (!dateStr) continue;
    // Parse as local date (YYYY-MM-DD) to avoid UTC midnight shift
    const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    const expectedDate = new Date(anchor);
    expectedDate.setDate(anchor.getDate() - i);

    if (date.getTime() === expectedDate.getTime()) {
      tempStreak++;
      currentStreak = tempStreak;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 0;
      break;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  // Compute longest streak across all date sequences (not just the current one)
  if (uniqueDates.length > 1) {
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = uniqueDates[i - 1] as string;
      const curr = uniqueDates[i] as string;
      const [py, pm, pd] = prev.split('-').map(Number) as [number, number, number];
      const [cy, cm, cd] = curr.split('-').map(Number) as [number, number, number];
      const prevDate = new Date(py, pm - 1, pd);
      const currDate = new Date(cy, cm - 1, cd);
      const diffDays = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    workoutsThisWeek,
  };
};
