/**
 * Workout Service
 * Handles workout-related data operations: templates, sessions, exercises, body weight
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { dbGet, dbPut, dbDelete, dbGetAll, dbClear } from './indexedDBCore';
import { ValidationError, NotFoundError } from '../errors';
import { logger } from '../utils/logger';
import { getCurrentUser } from './supabaseAuth';
import {
    syncBodyWeight,
    syncWorkoutSession,
    syncWorkoutTemplate,
    deleteWorkoutTemplate as deleteCloudWorkoutTemplate,
} from './festoreService';
import type {
    WorkoutTemplate,
    WorkoutSession,
    BodyWeightEntry,
    PersonalExercise,
    PersonalItem
} from '../types';

const withRetry = async (operation: () => Promise<void>, maxRetries: number, delay: number): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await operation();
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
};

const syncWithRetry = (
    operation: () => Promise<void>,
    operationName: string
): void => {
    withRetry(operation, 3, 500).catch(error => {
        logger.workout.error(`Cloud sync failed after retries (${operationName})`, error);
    });
};

// ==================== WORKOUT TEMPLATES ====================

export const getWorkoutTemplates = async (): Promise<WorkoutTemplate[]> => {
    const templates = await dbGetAll<WorkoutTemplate>(LS.WORKOUT_TEMPLATES);
    return templates || [];
};

export const getWorkoutTemplate = async (id: string): Promise<WorkoutTemplate | null> => {
    if (!id) throw new ValidationError('Template ID is required.');
    const template = await dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id);
    return template || null;
};

export const createWorkoutTemplate = async (
    templateData: Omit<WorkoutTemplate, 'id' | 'createdAt'>
): Promise<WorkoutTemplate> => {
    if (!templateData.name?.trim()) {
        throw new ValidationError('Template name is required.');
    }

    const newTemplate: WorkoutTemplate = {
        id: `template-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...templateData,
    };

    await dbPut(LS.WORKOUT_TEMPLATES, newTemplate);

    getCurrentUser().then(user => {
        if (user) {
            syncWithRetry(
                () => syncWorkoutTemplate(user.id, newTemplate),
                `createWorkoutTemplate:${newTemplate.id}`
            );
        }
    });

    return newTemplate;
};

export const updateWorkoutTemplate = async (
    id: string,
    updates: Partial<WorkoutTemplate>
): Promise<WorkoutTemplate> => {
    const template = await dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id);
    if (!template) throw new NotFoundError('WorkoutTemplate', id);

    const updatedTemplate = { ...template, ...updates };
    await dbPut(LS.WORKOUT_TEMPLATES, updatedTemplate);

    getCurrentUser().then(user => {
        if (user) {
            syncWithRetry(
                () => syncWorkoutTemplate(user.id, updatedTemplate),
                `updateWorkoutTemplate:${id}`
            );
        }
    });

    return updatedTemplate;
};

export const deleteWorkoutTemplate = async (id: string): Promise<void> => {
    if (!id) throw new ValidationError('Template ID is required for deletion.');
    await dbDelete(LS.WORKOUT_TEMPLATES, id);

    getCurrentUser().then(user => {
        if (user) {
            syncWithRetry(
                () => deleteCloudWorkoutTemplate(user.id, id),
                `deleteWorkoutTemplate:${id}`
            );
        }
    });
};

export const reAddWorkoutTemplate = (template: WorkoutTemplate): Promise<void> =>
    dbPut(LS.WORKOUT_TEMPLATES, template);

export const replaceWorkoutTemplatesFromCloud = async (templates: WorkoutTemplate[]): Promise<void> => {
    await dbClear(LS.WORKOUT_TEMPLATES);
    await Promise.all(templates.map(template => dbPut(LS.WORKOUT_TEMPLATES, template)));
};

// ==================== WORKOUT SESSIONS ====================

export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
    await dbPut(LS.WORKOUT_SESSIONS, session);

    getCurrentUser().then(user => {
        if (user) {
            syncWithRetry(
                () => syncWorkoutSession(user.id, { ...session, endTime: session.endTime ?? undefined }),
                `saveWorkoutSession:${session.id}`
            );
        }
    });
};

export const getWorkoutSessions = async (limit: number = 20): Promise<WorkoutSession[]> => {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);
};

export const reAddWorkoutSession = (session: WorkoutSession): Promise<void> =>
    dbPut(LS.WORKOUT_SESSIONS, session);

export const replaceWorkoutSessionsFromCloud = async (sessions: WorkoutSession[]): Promise<void> => {
    await dbClear(LS.WORKOUT_SESSIONS);
    await Promise.all(sessions.map(session => dbPut(LS.WORKOUT_SESSIONS, session)));
};

// ==================== BODY WEIGHT ====================

export const saveBodyWeight = async (entry: BodyWeightEntry): Promise<void> => {
    await dbPut(LS.BODY_WEIGHT, entry);

    getCurrentUser().then(user => {
        if (user) {
            syncWithRetry(
                () => syncBodyWeight(user.id, entry),
                `saveBodyWeight:${entry.id}`
            );
        }
    });
};

export const getBodyWeightHistory = async (): Promise<BodyWeightEntry[]> => {
    const entries = await dbGetAll<BodyWeightEntry>(LS.BODY_WEIGHT);
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getLatestBodyWeight = async (): Promise<number | null> => {
    const history = await getBodyWeightHistory();
    return history.length > 0 && history[0] ? history[0].weight : null;
};

export const reAddBodyWeight = (entry: BodyWeightEntry): Promise<void> =>
    dbPut(LS.BODY_WEIGHT, entry);

export const replaceBodyWeightFromCloud = async (entries: BodyWeightEntry[]): Promise<void> => {
    await dbClear(LS.BODY_WEIGHT);
    await Promise.all(entries.map(entry => dbPut(LS.BODY_WEIGHT, entry)));
};

// ==================== PERSONAL EXERCISES ====================

export const getPersonalExercises = async (): Promise<PersonalExercise[]> => {
    const exercises = await dbGetAll<PersonalExercise>(LS.PERSONAL_EXERCISES);

    exercises.sort((a, b) => {
        if (a.lastUsed && b.lastUsed) {
            return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        }
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        if (a.useCount && b.useCount) return b.useCount - a.useCount;
        return (a.name ?? '').localeCompare(b.name ?? '');
    });

    return exercises;
};

export const getPersonalExercise = async (id: string): Promise<PersonalExercise | undefined> => {
    return dbGet<PersonalExercise>(LS.PERSONAL_EXERCISES, id);
};

export const createPersonalExercise = async (
    exercise: Omit<PersonalExercise, 'id' | 'createdAt' | 'useCount'>
): Promise<PersonalExercise> => {
    const newExercise: PersonalExercise = {
        ...exercise,
        id: `exercise-${Date.now()}`,
        createdAt: new Date().toISOString(),
        useCount: 0,
    };

    await dbPut(LS.PERSONAL_EXERCISES, newExercise);
    return newExercise;
};

export const updatePersonalExercise = async (
    id: string,
    updates: Partial<PersonalExercise>
): Promise<void> => {
    const existing = await getPersonalExercise(id);
    if (!existing) throw new NotFoundError('PersonalExercise', id);

    const updated = { ...existing, ...updates, id };
    await dbPut(LS.PERSONAL_EXERCISES, updated);
};

export const deletePersonalExercise = async (id: string): Promise<void> => {
    await dbDelete(LS.PERSONAL_EXERCISES, id);
};

export const incrementExerciseUse = async (id: string): Promise<void> => {
    const exercise = await getPersonalExercise(id);
    if (!exercise) return;

    await updatePersonalExercise(id, {
        useCount: (exercise.useCount || 0) + 1,
        lastUsed: new Date().toISOString(),
    });
};

// ==================== THEME PREFERENCES ====================

export const saveThemePreference = async (themeId: string): Promise<void> => {
    const settings = loadSettings();
    const newSettings = {
        ...settings,
        workoutSettings: {
            ...settings.workoutSettings,
            selectedTheme: themeId,
        },
    };
    saveSettings(newSettings);
};

export const getThemePreference = (): string => {
    const settings = loadSettings() as any;
    return settings.workoutSettings?.selectedTheme || 'deepCosmos';
};

// ==================== HELPER: Load Workout from Template ====================

export const createWorkoutFromTemplate = async (templateId: string): Promise<Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'>> => {
    const template = await getWorkoutTemplate(templateId);
    if (!template) throw new NotFoundError('WorkoutTemplate', templateId);

    return {
        type: 'workout',
        title: template.name,
        content: template.description || '',
        exercises: template.exercises.map(ex => ({
            ...ex,
            name: ex.exerciseName,
            sets: ex.sets?.map(set => ({
                reps: set.reps,
                weight: set.weight,
            })) || [],
        })),
        workoutTemplateId: templateId,
        workoutStartTime: new Date().toISOString(),
        isActiveWorkout: true,
    } as Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'>;
};

// Placeholder for settings (should be implemented properly)
const loadSettings = () => ({ workoutSettings: {} });
const saveSettings = (_settings: unknown) => {};
