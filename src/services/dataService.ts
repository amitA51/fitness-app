// ============================================================================
// SPARKOS FITNESS - Data Service (Centralized Data Access)
// ============================================================================
// This service re-exports functions from workoutDb for compatibility
// with components that import from dataService

export {
    getWorkoutTemplates,
    getWorkoutTemplate,
    createWorkoutTemplate,
    updateWorkoutTemplate,
    deleteWorkoutTemplate,
    loadWorkoutFromTemplate,
    getPersonalExercises,
    getPersonalExercise,
    createPersonalExercise,
    updatePersonalExercise,
    deletePersonalExercise,
    incrementExerciseUse,
    removeDuplicateExercises,
    saveBodyWeight,
    getBodyWeightHistory,
    getLatestBodyWeight,
    getBuiltInWorkoutTemplates,
    convertBuiltInToWorkoutTemplate,
} from './workoutDb';

export {
    getWorkoutSessions,
    saveWorkoutSession,
    deleteWorkoutSession,
} from './workoutDb';

// Initialize built-in workout templates (creates sample templates if none exist)
export const initializeBuiltInWorkoutTemplates = async (): Promise<void> => {
    const {
        getWorkoutTemplates,
        createWorkoutTemplate,
        getBuiltInWorkoutTemplates,
        convertBuiltInToWorkoutTemplate,
    } = await import('./workoutDb');

    const existing = await getWorkoutTemplates();

    // Check if we have any built-in templates already
    const hasBuiltIns = existing.some(t => t.isBuiltin);

    if (!hasBuiltIns) {
        // Create the 5 built-in workout templates
        const builtInTemplates = getBuiltInWorkoutTemplates();

        for (const builtin of builtInTemplates) {
            const template = convertBuiltInToWorkoutTemplate(builtin);
            await createWorkoutTemplate({
                name: template.name,
                description: template.description,
                exercises: template.exercises,
                muscleGroups: template.muscleGroups,
                lastUsed: null,
                timesUsed: 0,
                isFavorite: false,
                isBuiltin: true,
                updatedAt: new Date().toISOString(),
            } as any);
        }
    }
};

// Re-export types for convenience
export type {
    WorkoutSession,
    WorkoutTemplate,
    PersonalExercise,
} from '../types';
