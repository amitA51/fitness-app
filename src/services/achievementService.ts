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

export const calculateStreak = (sessions: WorkoutSession[]): StreakInfo => {
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

  const now = new Date();
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = uniqueDates[i];
    if (!dateStr) continue;
    const date = new Date(dateStr);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (date.toDateString() === expectedDate.toDateString()) {
      tempStreak++;
      if (i === 0) currentStreak = tempStreak;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    workoutsThisWeek,
  };
};
