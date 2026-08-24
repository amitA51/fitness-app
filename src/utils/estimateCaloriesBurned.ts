// estimateCaloriesBurned — MET-based energy estimate for a finished strength
// session.
//
// Research basis (You.com, Oct 2026): the standard compendium formula is
//   kcal = MET × weightKg × hours
// Strength training sits at MET 3.5 (moderate, Mayo Clinic reference) to
// MET 5.0 (vigorous, heavy compound work with short rests). We grade the
// coefficient by session density — volume per minute — rather than asking the
// user to self-classify, because rest-time discipline is what actually
// separates a brisk session from a lingering one.

/** Moderate weightlifting (Mayo Clinic reference value). */
const MET_MODERATE = 3.5;
/** Vigorous circuit-style session. */
const MET_VIGOROUS = 5.0;

/** Volume (kg lifted) per minute at which a session counts as "vigorous". */
const DENSE_VOLUME_PER_MIN = 12;

export function estimateCaloriesBurned(
  totalVolumeKg: number,
  durationMinutes: number,
  bodyWeightKg: number | null | undefined
): number | null {
  if (!bodyWeightKg || bodyWeightKg <= 0) return null;
  if (durationMinutes <= 0) return null;

  const volumePerMin = totalVolumeKg / durationMinutes;
  const met = volumePerMin >= DENSE_VOLUME_PER_MIN ? MET_VIGOROUS : MET_MODERATE;
  const kcal = met * bodyWeightKg * (durationMinutes / 60);

  // Round to whole calories — the estimate carries ±20% inherent error anyway.
  return Math.round(kcal);
}
