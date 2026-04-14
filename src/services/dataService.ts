// ============================================================================
// SPARKOS FITNESS - Data Service (Centralized Data Access)
// ============================================================================
// This service re-exports functions from workoutDb for compatibility
// with components that import from dataService

export {
    getWorkoutSessions,
    saveWorkoutSession,
    deleteWorkoutSession,
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
} from './workoutDb';

// Initialize built-in workout templates (creates sample templates if none exist)
export const initializeBuiltInWorkoutTemplates = async (): Promise<void> => {
    const { getWorkoutTemplates, createWorkoutTemplate } = await import('./workoutDb');
    const existing = await getWorkoutTemplates();
    
    if (existing.length === 0) {
        // Create sample workout templates
        await createWorkoutTemplate({
            name: 'אימון חזה + כתפיים',
            description: 'אימון כוח לחזה וכתפיים',
            exercises: [],
            lastUsed: null,
            timesUsed: 0,
            isFavorite: true,
            updatedAt: new Date().toISOString(),
        } as any);
        await createWorkoutTemplate({
            name: 'אימון גב + ידיים',
            description: 'אימון כוח לגב וידיים',
            exercises: [],
            lastUsed: null,
            timesUsed: 0,
            isFavorite: true,
            updatedAt: new Date().toISOString(),
        } as any);
        await createWorkoutTemplate({
            name: 'אימון רגליים',
            description: 'אימון כוח לרגליים',
            exercises: [],
            lastUsed: null,
            timesUsed: 0,
            isFavorite: false,
            updatedAt: new Date().toISOString(),
        } as any);
    }
};

// Re-export types for convenience
export type {
    WorkoutSession,
    WorkoutTemplate,
    PersonalExercise,
} from '../types';
