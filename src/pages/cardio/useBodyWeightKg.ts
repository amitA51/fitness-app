import { useEffect, useState } from 'react';
import { getLatestBodyWeight } from '../../services/bodyWeightDb';
import { readAthleteProfile } from '../../services/intelligence/profile';
import { logger } from '../../utils/logger';

/**
 * Body weight for calorie estimates: the latest weigh-in, else the profile
 * weight, else null (calories are then not shown rather than guessed).
 */
export function useBodyWeightKg(): number | null {
  const [weightKg, setWeightKg] = useState<number | null>(() => readAthleteProfile().weightKg);

  useEffect(() => {
    let cancelled = false;
    getLatestBodyWeight()
      .then((latest) => {
        if (!cancelled && latest && latest > 0) setWeightKg(latest);
      })
      .catch((err: unknown) => logger.app.warn('cardio: latest body weight unavailable', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return weightKg;
}
