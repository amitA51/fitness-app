// workoutXp — session XP calculation for the gamification layer.
//
// Research basis (You.com, Oct 2026): Workout Quest / GymXP / ogamic all
// converge on the same shape — XP per session derived from WORK DONE, not
// time spent. Volume (kg lifted) is the primary driver; completed sets give a
// flat consistency bonus; PRs multiply. The formula stays legible so the
// number feels earned, not random.
//
//   xp = floor(volume/100) + sets*5 + prs*25   (+50 perfect-week-style streak day)

export interface WorkoutXpInput {
  totalVolumeKg: number;
  completedSets: number;
  personalRecords?: number;
}

export function computeWorkoutXp({
  totalVolumeKg,
  completedSets,
  personalRecords = 0,
}: WorkoutXpInput): number {
  const volumeXp = Math.floor(totalVolumeKg / 100);
  const setBonus = completedSets * 5;
  const prBonus = personalRecords * 25;
  return volumeXp + setBonus + prBonus;
}
