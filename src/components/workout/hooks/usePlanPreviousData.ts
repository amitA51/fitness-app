// usePlanPreviousData — batch ghost-value loader for the pre-workout planning table.
//
// The single-exercise usePreviousData hook loads lazily per current exercise.
// The planning table needs previous performance for ALL drafted exercises at
// once (to seed ghost placeholders + the "fill from previous" action), so this
// hook fetches sessions a single time and maps each exercise name to its most
// recent set list. Keyed on the *set* of names so typing in the table (which
// changes weight/reps, not names) never refires the fetch.

import { useEffect, useMemo, useState } from 'react';
import { getWorkoutSessions } from '../../../services/dataService';
import type { WorkoutSession, WorkoutSet } from '../../../types';
import { logger } from '../../../utils/logger';

// A multi-char ASCII sentinel that cannot appear inside an exercise name, so the
// join/split round-trip preserves names that contain spaces ("Bench Press").
const NAME_SEP = '::|::';

export interface PlanPreviousData {
  /** Most recent set list per exercise name (only names with history present). */
  previousByName: Map<string, WorkoutSet[]>;
  isLoading: boolean;
}

const sortByRecent = (sessions: WorkoutSession[]): WorkoutSession[] =>
  [...sessions].sort((a, b) => {
    const tb = new Date((b.endTime ?? b.startTime) || 0).getTime();
    const ta = new Date((a.endTime ?? a.startTime) || 0).getTime();
    return tb - ta;
  });

export function usePlanPreviousData(exerciseNames: string[]): PlanPreviousData {
  const [previousByName, setPreviousByName] = useState<Map<string, WorkoutSet[]>>(() => new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Stable key: unique + sorted, so the effect only refires when the set of
  // distinct names actually changes (not on every keystroke / array re-create).
  const namesKey = useMemo(() => {
    const unique = Array.from(new Set(exerciseNames.map((n) => n?.trim()).filter(Boolean)));
    unique.sort();
    return unique.join(NAME_SEP);
  }, [exerciseNames]);

  useEffect(() => {
    const names = namesKey ? namesKey.split(NAME_SEP) : [];
    if (names.length === 0) {
      setPreviousByName(new Map());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const sessions = await getWorkoutSessions(100);
        const sorted = sortByRecent(sessions);
        const map = new Map<string, WorkoutSet[]>();
        for (const name of names) {
          const last = sorted.find((s) => s.exercises?.some((e) => e.exerciseName === name));
          const exData = last?.exercises?.find((e) => e.exerciseName === name);
          if (exData?.sets?.length) {
            map.set(name, exData.sets);
          }
        }
        if (!cancelled) {
          setPreviousByName(map);
          setIsLoading(false);
        }
      } catch (err) {
        logger.workout.error('Failed to batch-fetch previous workout data for planning', err);
        if (!cancelled) {
          setPreviousByName(new Map());
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [namesKey]);

  return { previousByName, isLoading };
}

export default usePlanPreviousData;
