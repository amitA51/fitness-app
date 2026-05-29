// useExerciseSuggestions - Loads the personal exercise library + name suggestions
// once on mount. Extracted from ActiveWorkoutNew. Returns the loaded library
// (used to apply metadata on rename) and the sorted unique name list (used for
// the exercise-name autocomplete). Loading errors are swallowed exactly as before
// so the workout UI is never blocked by suggestion loading.
import { useEffect, useState } from 'react';

import { getPersonalExercises, getWorkoutSessions } from '../../../services/dataService';
import type { PersonalExercise } from '../../../types';

interface UseExerciseSuggestionsReturn {
  nameSuggestions: string[];
  personalExerciseLibrary: PersonalExercise[];
}

// Stable empty array to avoid re-creating [] for the initial suggestions value.
const emptyStringArray: string[] = [];

/**
 * Loads exercise name suggestions and the personal exercise library on mount.
 *
 * Runs exactly once (empty dependency array) — mirrors the original effect in
 * ActiveWorkoutNew. The historical sessions read is preserved (its result is
 * intentionally unused) to keep the data-layer access pattern identical.
 */
export function useExerciseSuggestions(): UseExerciseSuggestionsReturn {
  const [nameSuggestions, setNameSuggestions] = useState<string[]>(emptyStringArray);
  const [personalExerciseLibrary, setPersonalExerciseLibrary] = useState<PersonalExercise[]>([]);

  useEffect(() => {
    const loadNames = async () => {
      try {
        const [_sessions, personalExercises] = await Promise.all([
          getWorkoutSessions(100),
          getPersonalExercises().catch(() => []),
        ]);
        const libraryNames = Array.from(
          new Set(
            (personalExercises as PersonalExercise[])
              .map((ex) => ex.name)
              .filter((n): n is string => !!n)
          )
        );
        setPersonalExerciseLibrary(personalExercises as PersonalExercise[]);
        setNameSuggestions(libraryNames.sort());
      } catch {
        // Silently handle name suggestion loading errors
      }
    };
    loadNames();
  }, []);

  return { nameSuggestions, personalExerciseLibrary };
}
