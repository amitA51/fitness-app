// workoutLevels — XP → level ladder for the gamification layer.
//
// Research basis (You.com, Oct 2026): level curves come in three shapes —
// linear (flat grind), polynomial (steady widening, the RPG default) and
// exponential (late-game wall). For a HABIT app the curve must front-load
// wins: a beginner should reach level 2 within ~2-3 sessions so the loop
// closes early, then widen gently. A mild polynomial — threshold(n) =
// 100·n·(n+1)/2 cumulative — gives exactly that: L1→L2 at 200 XP (~1-2
// sessions), and each later level takes noticeably-but-not-crushingly more.
//
// Cumulative thresholds: reaching level n requires xpTotal >= T(n) where
// T(n) = 50·n·(n+1). Inverting with the quadratic formula keeps levelFromXp
// O(1) with no loops.

/** Cumulative XP required to REACH `level` (i.e. to advance past level-1). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

/** Current level + progress toward the next one, from a total XP pool. */
export function levelFromXp(xpTotal: number): {
  level: number;
  intoLevel: number;
  levelSpan: number;
} {
  // Largest n with 50·n·(n-1) <= xp → n = floor((1 + sqrt(1 + xp/12.5)) / 2)
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + xpTotal / 12.5)) / 2));
  const intoLevel = xpTotal - xpForLevel(level);
  const levelSpan = xpForLevel(level + 1) - xpForLevel(level);
  return { level, intoLevel, levelSpan };
}
