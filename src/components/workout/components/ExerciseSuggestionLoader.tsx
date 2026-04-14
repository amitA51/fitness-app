// Extracted from ActiveWorkoutNew.tsx
// Contains exercise suggestions and personal exercise library loading logic

import { useState, useEffect } from 'react';
import { PersonalExercise } from '../../../types';
import { getWorkoutSessions, getPersonalExercises } from '../../../services/dataService';
import { getExerciseNames } from '../../../services/prService';

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
                const historyNames = getExerciseNames();
                const libraryNames = Array.from(
                    new Set((personalExercises as PersonalExercise[]).map(ex => ex.name).filter(Boolean))
                );
                setPersonalExerciseLibrary(personalExercises as PersonalExercise[]);
                setNameSuggestions(Array.from(new Set([...historyNames, ...libraryNames])).filter((n): n is string => !!n).sort());
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
