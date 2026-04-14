/**
 * Workout Database Service
 * 
 * CRUD operations for workout-related entities: templates, sessions, body weight, and exercises.
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import type {
    WorkoutTemplate,
    WorkoutSession,
    BodyWeightEntry,
    PersonalExercise,
    PersonalItem,
    CreatePersonalExerciseInput,
} from '../types';
import { dbGet, dbGetAll, dbPut, dbDelete, dbClear, initDB, syncWithRetry } from './indexedDBCore';
import { ValidationError, NotFoundError } from '../errors';
import { getCurrentUser } from './supabaseAuth';
import {
    syncWorkoutTemplate,
    deleteWorkoutTemplate as deleteCloudWorkoutTemplate,
    syncWorkoutSession,
    deleteWorkoutSession as deleteCloudWorkoutSession,
    syncBodyWeight,
    deleteBodyWeight as deleteCloudBodyWeight,
    syncPersonalExercise,
    deletePersonalExercise as deleteCloudPersonalExercise,
} from './festoreService';
import { addPersonalItem } from './personalItemsDb';

// ==================== WORKOUT TEMPLATES ====================

/**
 * Gets all workout templates.
 */
export const getWorkoutTemplates = async (): Promise<WorkoutTemplate[]> => {
    const templates = await dbGetAll<WorkoutTemplate>(LS.WORKOUT_TEMPLATES);
    return templates || [];
};

/**
 * Gets a single workout template by ID.
 */
export const getWorkoutTemplate = (id: string): Promise<WorkoutTemplate | null> => {
    if (!id) throw new ValidationError('Template ID is required.');
    return dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id).then(res => res || null);
};

/**
 * Creates a new workout template.
 */
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

    const user = await getCurrentUser();
    if (user) {
        const userId = user.id;
        syncWithRetry(
            () => syncWorkoutTemplate(userId, newTemplate),
            `createWorkoutTemplate:${newTemplate.id}`
        );
    }

    return newTemplate;
};

/**
 * Updates an existing workout template.
 */
export const updateWorkoutTemplate = async (
    id: string,
    updates: Partial<WorkoutTemplate>
): Promise<WorkoutTemplate> => {
    const template = await dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id);
    if (!template) throw new NotFoundError('WorkoutTemplate', id);

    const updatedTemplate = { ...template, ...updates };
    await dbPut(LS.WORKOUT_TEMPLATES, updatedTemplate);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => syncWorkoutTemplate(user.id, updatedTemplate),
            `updateWorkoutTemplate:${id}`
        );
    }

    return updatedTemplate;
};

/**
 * Deletes a workout template.
 */
export const deleteWorkoutTemplate = async (id: string): Promise<void> => {
    if (!id) throw new ValidationError('Template ID is required for deletion.');
    await dbDelete(LS.WORKOUT_TEMPLATES, id);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => deleteCloudWorkoutTemplate(user.id, id),
            `deleteWorkoutTemplate:${id}`
        );
    }
};

/**
 * Loads a workout template into a new workout item.
 */
export const loadWorkoutFromTemplate = async (templateId: string): Promise<PersonalItem> => {
    const template = await getWorkoutTemplate(templateId);
    if (!template) throw new NotFoundError('WorkoutTemplate', templateId);

    const newWorkout = {
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
    };

    return await addPersonalItem(newWorkout) as unknown as PersonalItem;
};

/**
 * Re-add workout template from cloud (no cloud sync trigger).
 */
export const reAddWorkoutTemplate = (template: WorkoutTemplate): Promise<void> =>
    dbPut(LS.WORKOUT_TEMPLATES, template);

/**
 * Replace all workout templates with cloud data.
 */
export const replaceWorkoutTemplatesFromCloud = async (templates: WorkoutTemplate[]): Promise<void> => {
    await dbClear(LS.WORKOUT_TEMPLATES);
    await Promise.all(templates.map(template => dbPut(LS.WORKOUT_TEMPLATES, template)));
};

// ==================== WORKOUT SESSIONS ====================

/**
 * Save a workout session.
 */
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
    await dbPut(LS.WORKOUT_SESSIONS, session);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => syncWorkoutSession(user.id, { ...session, endTime: session.endTime ?? undefined }),
            `saveWorkoutSession:${session.id}`
        );
    }

    // Trigger UI Refresh
    window.dispatchEvent(new Event('WORKOUT_SAVED'));
};

/**
 * Get a single workout session by ID.
 */
export const getWorkoutSession = async (id: string): Promise<WorkoutSession | null> => {
    if (!id) return null;
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(LS.WORKOUT_SESSIONS, 'readonly');
            const store = tx.objectStore(LS.WORKOUT_SESSIONS);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
};

/**
 * Get workout sessions, sorted by start time (newest first).
 */
export const getWorkoutSessions = async (limit: number = 20): Promise<WorkoutSession[]> => {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);
};

/**
 * Re-add workout session from cloud (no cloud sync trigger).
 */
export const reAddWorkoutSession = (session: WorkoutSession): Promise<void> =>
    dbPut(LS.WORKOUT_SESSIONS, session);

/**
 * Replace all workout sessions with cloud data.
 */
export const replaceWorkoutSessionsFromCloud = async (sessions: WorkoutSession[]): Promise<void> => {
    await dbClear(LS.WORKOUT_SESSIONS);
    await Promise.all(sessions.map(session => dbPut(LS.WORKOUT_SESSIONS, session)));
};

/**
 * Delete a workout session by ID.
 */
export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
    if (!sessionId) throw new ValidationError('Session ID is required for deletion.');
    await dbDelete(LS.WORKOUT_SESSIONS, sessionId);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => deleteCloudWorkoutSession(user.id, sessionId),
            `deleteWorkoutSession:${sessionId}`
        );
    }

    // Trigger UI Refresh
    window.dispatchEvent(new Event('WORKOUT_SAVED'));
};

// ==================== BODY WEIGHT ====================

/**
 * Save a body weight entry.
 */
export const saveBodyWeight = async (entry: BodyWeightEntry): Promise<void> => {
    await dbPut(LS.BODY_WEIGHT, entry);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => syncBodyWeight(user.id, entry),
            `saveBodyWeight:${entry.id}`
        );
    }
};

/**
 * Get body weight history, sorted by date (newest first).
 */
export const getBodyWeightHistory = async (): Promise<BodyWeightEntry[]> => {
    const entries = await dbGetAll<BodyWeightEntry>(LS.BODY_WEIGHT);
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Get the latest body weight.
 */
export const getLatestBodyWeight = async (): Promise<number | null> => {
    const history = await getBodyWeightHistory();
    return history.length > 0 && history[0] ? history[0].weight : null;
};

/**
 * Re-add body weight entry from cloud (no cloud sync trigger).
 */
export const reAddBodyWeight = (entry: BodyWeightEntry): Promise<void> =>
    dbPut(LS.BODY_WEIGHT, entry);

/**
 * Replace all body weight entries with cloud data.
 */
export const replaceBodyWeightFromCloud = async (entries: BodyWeightEntry[]): Promise<void> => {
    await dbClear(LS.BODY_WEIGHT);
    await Promise.all(entries.map(entry => dbPut(LS.BODY_WEIGHT, entry)));
};

/**
 * Delete a body weight entry by ID.
 */
export const deleteBodyWeight = async (id: string): Promise<void> => {
    if (!id) throw new ValidationError('Body weight ID is required for deletion.');
    await dbDelete(LS.BODY_WEIGHT, id);

    const user = await getCurrentUser();
    if (user) {
        syncWithRetry(
            () => deleteCloudBodyWeight(user.id, id),
            `deleteBodyWeight:${id}`
        );
    }
};

// ==================== PERSONAL EXERCISES ====================

/**
 * Get all personal exercises, sorted by last used.
 * Seeds built-in exercises if library is empty.
 */
export const getPersonalExercises = async (): Promise<PersonalExercise[]> => {
    let exercises = await dbGetAll<PersonalExercise>(LS.PERSONAL_EXERCISES);

    // Check for missing built-in exercises and seed them if needed
    const now = new Date().toISOString();
    const builtIn = getBuiltInExercises(now);
    const existingNames = new Set(exercises.map(e => e.name));
    const missingBuiltIns = builtIn.filter(b => !existingNames.has(b.name));

    if (missingBuiltIns.length > 0) {
        const newExercises = missingBuiltIns.map((ex, index) => ({
            ...ex,
            id: `builtin-ex-${Date.now()}-${index}`,
            createdAt: now,
        })) as PersonalExercise[];

        await Promise.all(newExercises.map(ex => dbPut(LS.PERSONAL_EXERCISES, ex)));
        exercises = [...exercises, ...newExercises];
    }

    // Sort by last used, then by use count, then by name
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

/**
 * Get a single personal exercise by ID.
 */
export const getPersonalExercise = async (id: string): Promise<PersonalExercise | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readonly');
        const store = tx.objectStore(LS.PERSONAL_EXERCISES);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Create a new personal exercise.
 */
export const createPersonalExercise = async (
    exercise: CreatePersonalExerciseInput
): Promise<PersonalExercise> => {
    const newExercise = {
        ...exercise,
        id: `exercise-${Date.now()}`,
        createdAt: new Date().toISOString(),
        useCount: 0,
    } as PersonalExercise;

    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
        const store = tx.objectStore(LS.PERSONAL_EXERCISES);
        const request = store.add(newExercise);

        request.onsuccess = () => {
            getCurrentUser().then(user => {
                if (user) {
                    syncWithRetry(
                        () => syncPersonalExercise(user.id, newExercise as any),
                        `createPersonalExercise:${newExercise.id}`
                    );
                }
            });
            resolve(newExercise);
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Update an existing personal exercise.
 */
export const updatePersonalExercise = async (
    id: string,
    updates: Partial<PersonalExercise>
): Promise<void> => {
    const existing = await getPersonalExercise(id);
    if (!existing) throw new NotFoundError('PersonalExercise', id);

    const updated = { ...existing, ...updates, id };

    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
        const store = tx.objectStore(LS.PERSONAL_EXERCISES);
        const request = store.put(updated);

        request.onsuccess = () => {
            getCurrentUser().then(user => {
                if (user) {
                    syncWithRetry(
                        () => syncPersonalExercise(user.id, updated as any),
                        `updatePersonalExercise:${id}`
                    );
                }
            });
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete a personal exercise.
 */
export const deletePersonalExercise = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
        const store = tx.objectStore(LS.PERSONAL_EXERCISES);
        const request = store.delete(id);

        request.onsuccess = () => {
            getCurrentUser().then(user => {
                if (user) {
                    syncWithRetry(
                        () => deleteCloudPersonalExercise(user.id, id),
                        `deletePersonalExercise:${id}`
                    );
                }
            });
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Increment use count and update last used timestamp.
 */
export const incrementExerciseUse = async (id: string): Promise<void> => {
    const exercise = await getPersonalExercise(id);
    if (!exercise) return;

    await updatePersonalExercise(id, {
        useCount: (exercise.useCount || 0) + 1,
        lastUsed: new Date().toISOString(),
    });
};

/**
 * Toggle favorite status for an exercise.
 */
export const toggleExerciseFavorite = async (id: string): Promise<boolean> => {
    const exercise = await getPersonalExercise(id);
    if (!exercise) return false;

    const newFavoriteStatus = !exercise.isFavorite;
    await updatePersonalExercise(id, {
        isFavorite: newFavoriteStatus,
    });
    return newFavoriteStatus;
};

/**
 * Remove duplicate exercises based on name (case-insensitive).
 * Keeps the one with the highest useCount or usage data.
 */
export const removeDuplicateExercises = async (): Promise<number> => {
    const exercises = await getPersonalExercises();
    const uniqueMap = new Map<string, PersonalExercise[]>();

    // Group by normalized name
    exercises.forEach(ex => {
        const key = (ex.name ?? '').trim().toLowerCase();
        const list = uniqueMap.get(key) || [];
        list.push(ex);
        uniqueMap.set(key, list);
    });

    let removedCount = 0;
    const db = await initDB();

    for (const [_key, group] of uniqueMap.entries()) {
        if (group.length > 1) {
            // Sort to find the "best" one to keep
            // Criteria: Built-in preference? usage count? detailed metadata?
            // Let's prefer the one with highest useCount, then most recent lastUsed.
            group.sort((a, b) => {
                const scoreA = (a.useCount || 0) * 100 + (a.lastUsed ? new Date(a.lastUsed).getTime() : 0);
                const scoreB = (b.useCount || 0) * 100 + (b.lastUsed ? new Date(b.lastUsed).getTime() : 0);
                return scoreB - scoreA;
            });

            const [_keep, ...remove] = group;

            // Delete the rest
            await Promise.all(remove.map(ex => {
                const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
                const store = tx.objectStore(LS.PERSONAL_EXERCISES);
                return store.delete(ex.id);
            }));

            removedCount += remove.length;
        }
    }

    return removedCount;
};

// --- Built-in Exercises Data ---
function getBuiltInExercises(now: string): Partial<PersonalExercise>[] {
    return [
        // ==================== Warmup & Cardio ====================
        { name: 'Jumping Jacks', muscleGroup: 'Cardio', category: 'warmup', tempo: '1-0-1-0', defaultRestTime: 30, defaultSets: 2, notes: 'Whole-body warmup.', tutorialText: 'Stand tall, jump feet out while raising arms overhead.', lastUsed: now, useCount: 0 },
        { name: 'Treadmill Run', muscleGroup: 'Cardio', category: 'cardio', tempo: 'steady', defaultRestTime: 0, defaultSets: 1, notes: 'Steady state cardio.', tutorialText: 'Maintain consistent pace.', lastUsed: now, useCount: 0 },

        // ==================== 💪 חזה | Chest (Pectorals) ====================
        { name: 'לחיצת חזה | Bench Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 120, defaultSets: 4, notes: 'חזה אמצעי - תרגיל בסיס קלאסי.', tutorialText: 'הורד מוט לאמצע החזה, דחוף למעלה בלי לנעול.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת חזה בשיפוע חיובי | Incline Dumbbell Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'חזה עליון (Clavicular).', tutorialText: 'ספסל בזווית 30-45, דחוף משקולות למעלה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת חזה בשיפוע שלילי | Decline Bench Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 120, defaultSets: 4, notes: 'חזה תחתון (Costal).', tutorialText: 'ספסל בזווית שלילית, הורד מוט לחזה תחתון, דחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת חזה עם משקולות יד | Dumbbell Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'חזה - טווח תנועה גדול יותר ממוט.', tutorialText: 'החזק משקולות בגובה החזה, דחוף למעלה ויחד.', lastUsed: now, useCount: 0 },
        { name: 'פרפר בכבלים | Cable Fly', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'מתח מתמיד על החזה.', tutorialText: 'פתח ידיים לרווחה, כווץ חזה להביא ידיים ביחד.', lastUsed: now, useCount: 0 },
        { name: 'פרפר בכבלים - פולי עליון | High Cable Crossover', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'חזה תחתון ואמצעי.', tutorialText: 'כבלים מפוליות עליונות, הורד ידיים למטה ויחד בגובה המותן.', lastUsed: now, useCount: 0 },
        { name: 'פרפר בכבלים - פולי תחתון | Low Cable Crossover', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'חזה עליון.', tutorialText: 'כבלים מפוליות תחתונות, הרם ידיים למעלה ויחד בגובה החזה.', lastUsed: now, useCount: 0 },
        { name: 'פול-אובר | Dumbbell Pullover', muscleGroup: 'Chest', category: 'strength', tempo: '3-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'הרחבת כלוב הצלעות + רחב גבי.', tutorialText: 'שכב על ספסל, הורד משקולת מאחורי הראש עם כיפוף מרפק קל, משוך חזרה מעל החזה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת חזה במכונת האמר | Hammer Strength Chest Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'חזה - בידוד וכוח.', tutorialText: 'שב במכונה, דחוף ידיות קדימה, שלוט בחזרה.', lastUsed: now, useCount: 0 },
        { name: 'מקבילים רחב | Chest Dips', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'חזה תחתון - כשהגוף נוטה קדימה.', tutorialText: 'על מקבילים רחבים, הטה גוף קדימה והורד, דחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת גיליוטינה | Guillotine Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 120, defaultSets: 3, notes: 'חזה עליון - מסוכן לכתפיים, דורש זהירות!', tutorialText: 'הורד מוט לצוואר/חזה עליון עם אחיזה רחבה, דחוף למעלה. משקל קל וזהירות.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת סבנד | Svend Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-1-2-0', defaultRestTime: 45, defaultSets: 3, notes: 'כיווץ איזומטרי של החזה הפנימי.', tutorialText: 'לחץ שתי צלחות יחד בגובה החזה, הארך ידיים תוך כדי לחיצה, חזור.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת לנדמיין | Landmine Press', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'חזה עליון (חלק פנימי) + כתף קדמית.', tutorialText: 'החזק קצה המוט בכתף, דחוף למעלה באלכסון.', lastUsed: now, useCount: 0 },
        { name: 'שכיבות סמיכה | Push Up', muscleGroup: 'Chest', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'חזה לרצפה.', tutorialText: 'שמור על תנוחת פלאנק, הורד חזה לרצפה.', lastUsed: now, useCount: 0 },

        // ==================== 🦅 גב | Back ====================
        { name: 'מתח | Pull Up', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 120, defaultSets: 4, notes: 'רחב גבי - טווח תנועה מלא.', tutorialText: 'משוך חזה לכיוון המוט, הורד עד הסוף.', lastUsed: now, useCount: 0 },
        { name: 'מתח באחיזה הפוכה וצרה | Chin-Up', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 120, defaultSets: 4, notes: 'רחב גבי + דגש חזק על יד קדמית.', tutorialText: 'אחיזה הפוכה (כפות כלפייך), משוך סנטר מעל המוט.', lastUsed: now, useCount: 0 },
        { name: 'משיכת פולי עליון | Lat Pulldown', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 90, defaultSets: 3, notes: 'רחב גבי - אחיזה רחבה.', tutorialText: 'משוך מוט לחזה עליון, כווץ רחב גבי.', lastUsed: now, useCount: 0 },
        { name: 'משיכת פולי עליון במשולש | V-Bar Pulldown', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 90, defaultSets: 3, notes: 'רחב גבי תחתון ופנימי.', tutorialText: 'השתמש במשולש V, משוך לחזה, כווץ רחב גבי.', lastUsed: now, useCount: 0 },
        { name: 'פול-אובר בכבל | Straight Arm Pulldown', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'רחב גבי נטו - ללא מעורבות יד קדמית.', tutorialText: 'שמור ידיים ישרות, משוך מוט למטה לירכיים, כווץ רחב גבי.', lastUsed: now, useCount: 0 },
        { name: 'חתירה בכבל בישיבה - אחיזה צרה | Seated Cable Row Close Grip', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 90, defaultSets: 3, notes: 'רחב גבי תחתון ומרכז הגב.', tutorialText: 'משוך ידית לבטן, כווץ שכמות.', lastUsed: now, useCount: 0 },
        { name: 'חתירה בכבל בישיבה - אחיזה רחבה | Seated Cable Row Wide Grip', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 90, defaultSets: 3, notes: 'גב עליון, כתף אחורית ומעוינים.', tutorialText: 'מוט רחב, משוך לחזה, כווץ שכמות.', lastUsed: now, useCount: 0 },
        { name: 'חתירה ביד אחת | Single Arm Dumbbell Row', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'רחב גבי - עבודה על צד אחד למניעת חוסר פרופורציה.', tutorialText: 'משוך משקולת לירך, שלוט בהורדה.', lastUsed: now, useCount: 0 },
        { name: 'חתירה בטי-בר | T-Bar Row', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 4, notes: 'עיבוי הגב, רחב גבי וטרפזים אמצעיים.', tutorialText: 'פסק על המוט, משוך משקל לחזה, כווץ גב.', lastUsed: now, useCount: 0 },
        { name: 'חתירה במוט | Barbell Row', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 90, defaultSets: 4, notes: 'פיתוח גב כולל.', tutorialText: 'הטה קדימה, משוך מוט לחזה תחתון, כווץ רחב גבי.', lastUsed: now, useCount: 0 },
        { name: 'משיכה לפנים | Face Pull', muscleGroup: 'Back', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אחורית ושרוול מסובב.', tutorialText: 'משוך חבל לפנים, הפרד ידיים.', lastUsed: now, useCount: 0 },
        { name: 'פשיטת גב / סופרמן | Hyperextension', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'זוקפי הגב (גב תחתון), ישבן והמסטרינג.', tutorialText: 'על ספסל היפראקסטנשן, הורד גוף עליון ואז הרם לתנוחה ישרה.', lastUsed: now, useCount: 0 },
        { name: 'ראק-פולס | Rack Pulls', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 120, defaultSets: 4, notes: 'גב עליון וטרפזים - חלק עליון של הדדליפט.', tutorialText: 'מוט בגובה ברכיים על הראק, בצע דדליפט מתנוחה זו.', lastUsed: now, useCount: 0 },
        { name: 'דדליפט | Deadlift', muscleGroup: 'Back', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 180, defaultSets: 4, notes: 'שרשרת גב אחורית מלאה.', tutorialText: 'מוט מעל אמצע כף הרגל, דחוף רצפה הרחק, עמוד ישר.', lastUsed: now, useCount: 0 },

        // ==================== 🎃 כתפיים | Shoulders (Deltoids) ====================
        { name: 'לחיצת כתפיים | Overhead Press', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'לחיצה סטריקט לכוח.', tutorialText: 'דחוף מוט מעל הראש עם ליבה מהודקת.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת ארנולד | Arnold Press', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'כל ראשי הכתף - סיבוב תוך כדי לחיצה.', tutorialText: 'התחל עם כפות כלפייך בגובה החזה, סובב ודחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'הרחקה לצדדים | Dumbbell Lateral Raise', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אמצעית.', tutorialText: 'הרם ידיים לצדדים עד מקביל לרצפה.', lastUsed: now, useCount: 0 },
        { name: 'הרחקה לצדדים בכבל | Cable Lateral Raise', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אמצעית - מתח מתמיד לאורך כל התנועה.', tutorialText: 'כבל בצד, הרם יד החוצה לגובה הכתף.', lastUsed: now, useCount: 0 },
        { name: 'הרחקה לצדדים בישיבה | Seated Lateral Raise', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אמצעית - מונע רמאות עם הגוף.', tutorialText: 'בישיבה, הרם משקולות לצדדים עד מקביל.', lastUsed: now, useCount: 0 },
        { name: 'הרמה לפנים | Front Raise', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'כתף קדמית - אפשר עם משקולת/פלטה/כבל.', tutorialText: 'הרם משקל מולך לגובה הכתף.', lastUsed: now, useCount: 0 },
        { name: 'חתירה אנכית | Upright Row', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אמצעית וטרפזים - זהירות על מפרק הכתף.', tutorialText: 'משוך מוט/משקולות למעלה לאורך הגוף לגובה הסנטר, מרפקים גבוהים.', lastUsed: now, useCount: 0 },
        { name: 'פרפר הפוך במכונה | Reverse Pec Deck', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אחורית.', tutorialText: 'פנים למכונה, פתח ידיים לאחור וכווץ כתפיים אחוריות.', lastUsed: now, useCount: 0 },
        { name: 'הרחקה אופקית בכבל | Reverse Cable Fly', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כתף אחורית.', tutorialText: 'כבלים בגובה הפנים, משוך הצידה עם ידיים ישרות.', lastUsed: now, useCount: 0 },
        { name: 'לחיצה מאחורי העורף | Behind the Neck Press', muscleGroup: 'Shoulders', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'כתף אמצעית - למתקדמים בלבד, דורש גמישות.', tutorialText: 'מוט מאחורי הראש, דחוף למעלה. התחל עם משקל קל.', lastUsed: now, useCount: 0 },

        // ==================== 🦵 רגליים - ארבע ראשי | Legs - Quads ====================
        { name: 'סקוואט | Back Squat', muscleGroup: 'Legs', category: 'strength', tempo: '3-1-1-1', defaultRestTime: 120, defaultSets: 4, notes: 'ארבע-ראשי - טווח תנועה מלא.', tutorialText: 'מוט על גב עליון, שב לאחור ולמטה עד מקביל.', lastUsed: now, useCount: 0 },
        { name: 'סקוואט קדמי | Front Squat', muscleGroup: 'Legs', category: 'strength', tempo: '3-1-1-1', defaultRestTime: 120, defaultSets: 4, notes: 'ארבע-ראשי - דגש חזק יותר מהסקוואט הרגיל + ליבה.', tutorialText: 'מוט על כתפיים קדמיות, מרפקים גבוהים, סקוואט עם גוף זקוף.', lastUsed: now, useCount: 0 },
        { name: 'סקוואט גביע | Goblet Squat', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'ארבע-ראשי - מצוין לטכניקה.', tutorialText: 'החזק משקולת בגובה החזה, סקוואט למטה בין הרגליים.', lastUsed: now, useCount: 0 },
        { name: 'בולגריאן ספליט סקוואט | Bulgarian Split Squat', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'ארבע-ראשי וישבן - עבודה על רגל אחת.', tutorialText: 'רגל אחורית על ספסל, הורד ברך קדמית ל-90 מעלות.', lastUsed: now, useCount: 0 },
        { name: 'האק סקוואט | Hack Squat', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 4, notes: 'ארבע-ראשי - תמיכה לגב, מאפשר עומס גבוה.', tutorialText: 'סקוואט במכונה, דחוף פלטפורמה עם קוואדס.', lastUsed: now, useCount: 0 },
        { name: 'מכרעים / לאנג\'ים | Lunges', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'ארבע-ראשי וישבן - הליכה או סטטי.', tutorialText: 'צעד קדימה, הורד ברך אחורית לרצפה, דחוף חזרה.', lastUsed: now, useCount: 0 },
        { name: 'מכרעים בהליכה | Walking Lunges', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'שמור גוף זקוף.', tutorialText: 'צעד קדימה, הורד ברך אחורית לרצפה.', lastUsed: now, useCount: 0 },
        { name: 'צעד וחצי / עלייה על מדרגה | Step Ups', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'ארבע-ראשי וישבן.', tutorialText: 'עלה על קופסה עם רגל אחת, דחוף דרך העקב.', lastUsed: now, useCount: 0 },
        { name: 'סיסי סקוואט | Sissy Squat', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-2-0', defaultRestTime: 60, defaultSets: 3, notes: 'בידוד קיצוני לארבע-ראשי - ליד הברך.', tutorialText: 'עלה על קצות האצבעות, הטה לאחור תוך כיפוף ברכיים, הורד גוף.', lastUsed: now, useCount: 0 },
        { name: 'פשיטת ברכיים | Leg Extension', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'כווץ קוואדס בסוף.', tutorialText: 'הארך רגליים לגמרי בשליטה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת רגליים | Leg Press', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'רגליים ברוחב כתפיים.', tutorialText: 'הורד משקל עד שברכיים בזווית 90 מעלות.', lastUsed: now, useCount: 0 },

        // ==================== 🍑 רגליים - ירך אחורית וישבן | Hamstrings & Glutes ====================
        { name: 'דדליפט רומני | Romanian Deadlift (RDL)', muscleGroup: 'Legs', category: 'strength', tempo: '3-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'המסטרינג (מתיחה) וישבן.', tutorialText: 'ציר במותניים עם כיפוף ברך קל.', lastUsed: now, useCount: 0 },
        { name: 'דדליפט סומו | Sumo Deadlift', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 120, defaultSets: 4, notes: 'ישבן, מקרבי ירך (ירך פנימית) והמסטרינג.', tutorialText: 'עמידה רחבה, אצבעות החוצה, אחיזה בין הברכיים, דחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'בוקר טוב | Good Mornings', muscleGroup: 'Legs', category: 'strength', tempo: '3-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'המסטרינג וגב תחתון.', tutorialText: 'מוט על הגב, ציר במותניים עם כיפוף ברך קל.', lastUsed: now, useCount: 0 },
        { name: 'הרחקת ירך במכונה | Hip Abductor Machine', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ישבן צידי (Glute Medius).', tutorialText: 'דחוף ירכיים החוצה נגד הרפידות.', lastUsed: now, useCount: 0 },
        { name: 'קירוב ירך במכונה | Hip Adductor Machine', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'מקרבי הירך (ירך פנימית).', tutorialText: 'לחץ ירכיים יחד נגד הרפידות.', lastUsed: now, useCount: 0 },
        { name: 'בעיטה אחורית בכבל | Cable Kickback', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ישבן (Glute Maximus).', tutorialText: 'רצועת קרסול על כבל, בעט רגל לאחור וכווץ ישבן.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת ברכיים בשכיבה | Lying Leg Curl', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'המסטרינג - בידוד.', tutorialText: 'כופף עקבים לישבן.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת ברכיים בישיבה | Seated Leg Curl', muscleGroup: 'Legs', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'המסטרינג - בידוד.', tutorialText: 'לחץ רפידה למטה עם השוקיים, כופף רגליים.', lastUsed: now, useCount: 0 },
        { name: 'גשר ישבן | Glute Bridge', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'הפעלת ישבן.', tutorialText: 'שכב על הגב, דחוף מותניים למעלה תוך כיווץ ישבן.', lastUsed: now, useCount: 0 },
        { name: 'היפ ת\'ראסט | Hip Thrust', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'בונה ישבן ראשי.', tutorialText: 'גב על ספסל, מוט על המותניים, דחוף מותניים למעלה.', lastUsed: now, useCount: 0 },

        // ==================== 🐄 תאומים | Calves ====================
        { name: 'הרמת עקבים | Calf Raise', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 45, defaultSets: 4, notes: 'מתיחה מלאה בתחתית.', tutorialText: 'הרם עקבים כמה שיותר גבוה.', lastUsed: now, useCount: 0 },
        { name: 'הרמת עקבים בישיבה | Seated Calf Raise', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 45, defaultSets: 4, notes: 'שריר הסולאוס (השריר העמוק מתחת לתאומים).', tutorialText: 'בישיבה, משקל על הברכיים, הרם עקבים.', lastUsed: now, useCount: 0 },
        { name: 'הרמת עקבים במכונת לחיצת רגליים | Leg Press Calf Raise', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 45, defaultSets: 4, notes: 'תאומים (Gastrocnemius).', tutorialText: 'במכונת לחיצת רגליים, דחוף רק עם כפות הרגליים.', lastUsed: now, useCount: 0 },
        { name: 'הרמת עקבים חמור | Donkey Calf Raise', muscleGroup: 'Legs', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 60, defaultSets: 4, notes: 'תאומים - מתיחה חזקה.', tutorialText: 'כפוף קדימה, משקל על גב תחתון, הרם עקבים.', lastUsed: now, useCount: 0 },

        // ==================== 💪 יד אחורית | Triceps ====================
        { name: 'פשיטת מרפקים בכבל | Tricep Pushdown', muscleGroup: 'Triceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'שמור מרפקים צמודים.', tutorialText: 'דחוף חבל/מוט למטה עד נעילת ידיים.', lastUsed: now, useCount: 0 },
        { name: 'פשיטה עם חבל | Rope Pushdown', muscleGroup: 'Triceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ראש צידי - מאפשר פיצול בסוף התנועה.', tutorialText: 'דחוף חבל למטה, פצל קצוות בסוף.', lastUsed: now, useCount: 0 },
        { name: 'לחיצת חזה צרה | Close Grip Bench Press', muscleGroup: 'Triceps', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 4, notes: 'כל היד האחורית - תרגיל בסיס.', tutorialText: 'ידיים ברוחב כתפיים, הורד מוט לחזה, דחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'לחיצה צרפתית | Skullcrusher', muscleGroup: 'Triceps', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'ראש ארוך וראש מדיאלי.', tutorialText: 'שכב על ספסל, הורד מוט למצח, הארך למעלה.', lastUsed: now, useCount: 0 },
        { name: 'פשיטת מרפקים מעל הראש | Overhead Tricep Extension', muscleGroup: 'Triceps', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'הראש הארוך - החלק הגדול של היד.', tutorialText: 'משקל מעל הראש, הורד מאחורי הראש, הארך למעלה.', lastUsed: now, useCount: 0 },
        { name: 'קיק-בק | Tricep Kickback', muscleGroup: 'Triceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ראש צידי - חיטוב/כיווץ סופי.', tutorialText: 'כפוף קדימה, הארך יד לאחור וכווץ.', lastUsed: now, useCount: 0 },
        { name: 'מקבילים בין ספסלים | Bench Dips', muscleGroup: 'Triceps', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'כל היד האחורית.', tutorialText: 'ידיים על ספסל מאחוריך, הורד גוף, דחוף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'מקבילים | Dips', muscleGroup: 'Triceps', category: 'strength', tempo: '2-1-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'חזה או יד אחורית.', tutorialText: 'הורד גוף עד מרפקים ב-90 מעלות, דחוף למעלה.', lastUsed: now, useCount: 0 },

        // ==================== 💪 יד קדמית ואמות | Biceps & Forearms ====================
        { name: 'כפיפת מוט | Barbell Curl', muscleGroup: 'Biceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'טכניקה נקייה.', tutorialText: 'כופף מוט לחזה, הורד לאט.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת פטישים | Hammer Curls', muscleGroup: 'Biceps', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'בראכיאליס (שריר הצד שנותן עובי ליד) ואמות.', tutorialText: 'החזק משקולות באחיזה ניטרלית (כפות פנימה), כופף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'כפיפה בכיסא כומר | Preacher Curl', muscleGroup: 'Biceps', category: 'strength', tempo: '2-1-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ראש קצר - דגש על תחילת התנועה.', tutorialText: 'ידיים על רפידה, כופף משקל למעלה.', lastUsed: now, useCount: 0 },
        { name: 'כפיפה בשיפוע חיובי | Incline Dumbbell Curl', muscleGroup: 'Biceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'ראש ארוך - מתיחה חזקה בכתף.', tutorialText: 'על ספסל נטוי, תן לידיים להשתלשל, כופף למעלה.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת ריכוז | Concentration Curl', muscleGroup: 'Biceps', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'דגש על הפיק (הגובה) של השריר.', tutorialText: 'בישיבה, מרפק על ירך פנימית, כופף למעלה וכווץ.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת מוט באחיזה הפוכה | Reverse Curl', muscleGroup: 'Biceps', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'אמות ושריר הבראכיורדיאליס.', tutorialText: 'אחיזה עליונה, כופף מוט למעלה.', lastUsed: now, useCount: 0 },
        { name: 'כפיפת שורש כף היד | Wrist Curls', muscleGroup: 'Biceps', category: 'strength', tempo: '1-0-1-0', defaultRestTime: 45, defaultSets: 3, notes: 'אמות (פלקסורים).', tutorialText: 'אמות על ספסל, כופף שורשי כף יד למעלה.', lastUsed: now, useCount: 0 },
        { name: '21 | 21s', muscleGroup: 'Biceps', category: 'strength', tempo: '1-0-1-0', defaultRestTime: 90, defaultSets: 3, notes: 'טכניקה לשריפת השריר.', tutorialText: '7 חזרות חצי תחתון, 7 חזרות חצי עליון, 7 חזרות מלאות.', lastUsed: now, useCount: 0 },

        // ==================== 🍫 בטן וליבה | Abs & Core ====================
        { name: 'פלאנק | Plank', muscleGroup: 'Core', category: 'strength', tempo: 'isometric', defaultRestTime: 45, defaultSets: 3, notes: 'אל תתן למותניים לצנוח.', tutorialText: 'מרפקים מתחת לכתפיים, גוף בקו ישר.', lastUsed: now, useCount: 0 },
        { name: 'כפיפות בטן | Crunch', muscleGroup: 'Core', category: 'strength', tempo: '1-0-1-1', defaultRestTime: 45, defaultSets: 3, notes: 'כווץ בטן.', tutorialText: 'שכב על הגב, הרם כתפיים מהרצפה.', lastUsed: now, useCount: 0 },
        { name: 'כפיפות בטן בכבל | Cable Crunch', muscleGroup: 'Core', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'קוביות (Rectus Abdominis) - מאפשר הוספת משקל.', tutorialText: 'כרע בכבל, כופף למטה והבא מרפקים לירכיים.', lastUsed: now, useCount: 0 },
        { name: 'הרמת רגליים בתלייה | Hanging Leg Raise', muscleGroup: 'Core', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'שלוט בנדנוד.', tutorialText: 'תלה ממוט, הרם רגליים ל-90 מעלות.', lastUsed: now, useCount: 0 },
        { name: 'הרמת ברכיים בתלייה | Hanging Knee Raise', muscleGroup: 'Core', category: 'strength', tempo: '2-0-1-1', defaultRestTime: 60, defaultSets: 3, notes: 'בטן תחתונה.', tutorialText: 'תלה ממוט, הבא ברכיים לחזה.', lastUsed: now, useCount: 0 },
        { name: 'גלגלת בטן | Ab Wheel Rollout', muscleGroup: 'Core', category: 'strength', tempo: '3-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'כל שרירי הליבה - דורש כוח רב.', tutorialText: 'גלגל החוצה כמה שאפשר, משוך חזרה עם הליבה.', lastUsed: now, useCount: 0 },
        { name: 'טוויסט רוסי | Russian Twist', muscleGroup: 'Core', category: 'strength', tempo: '1-0-1-0', defaultRestTime: 45, defaultSets: 3, notes: 'אלכסונים (Obliques).', tutorialText: 'ישיבה בצורת V, סובב גוף מצד לצד.', lastUsed: now, useCount: 0 },
        { name: 'חוטב עצים בכבל | Woodchoppers', muscleGroup: 'Core', category: 'strength', tempo: '2-0-1-0', defaultRestTime: 60, defaultSets: 3, notes: 'אלכסונים וכוח סיבובי.', tutorialText: 'כבל גבוה/נמוך, משוך באלכסון לרוחב הגוף.', lastUsed: now, useCount: 0 },
        { name: 'ואקום | Stomach Vacuum', muscleGroup: 'Core', category: 'strength', tempo: 'isometric', defaultRestTime: 30, defaultSets: 3, notes: 'רחב בטני (TVA) - השריר שמחזיק את הבטן בפנים.', tutorialText: 'נשוף לגמרי, משוך טבור לעמוד השדרה, החזק.', lastUsed: now, useCount: 0 },
    ];
}
