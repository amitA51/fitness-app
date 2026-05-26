// Extracted from ActiveWorkoutNew.tsx
// Contains exercise suggestions and personal exercise library loading logic

import { useEffect, useState } from 'react';
import { getPersonalExercises, getWorkoutSessions } from '../../../services/dataService';
import type { PersonalExercise } from '../../../types';

export interface ExerciseSuggestionData {
  nameSuggestions: string[];
  personalExerciseLibrary: PersonalExercise[];
}

export interface UseExerciseSuggestionsReturn {
  nameSuggestions: string[];
  personalExerciseLibrary: PersonalExercise[];
}

export const useExerciseSuggestions = (): UseExerciseSuggestionsReturn => {
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
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

  return {
    nameSuggestions,
    personalExerciseLibrary,
  };
};

export default useExerciseSuggestions;
