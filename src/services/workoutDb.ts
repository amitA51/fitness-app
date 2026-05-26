/**
 * Workout Database Service
 *
 * CRUD operations for workout-related entities: templates, sessions, body weight, and exercises.
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { getBUILT_IN_EXERCISES } from '../data/builtInExercises';
import { NotFoundError, ValidationError } from '../errors';
import type {
  BodyWeightEntry,
  CreatePersonalExerciseInput,
  Exercise,
  PersonalExercise,
  PersonalItem,
  WorkoutSession,
  WorkoutTemplate,
} from '../types';
import { createWorkoutSet } from '../types';
import {
  STORES,
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  initDB,
  syncWithRetry,
} from './indexedDBCore';
import { addPersonalItem } from './personalItemsDb';
import { getCurrentUser } from './supabaseAuth';
import {
  deleteCloudBodyWeight,
  deleteCloudPersonalExercise,
  deleteCloudWorkoutSession,
  deleteCloudWorkoutTemplate,
  syncBodyWeight,
  syncPersonalExercise,
  syncWorkoutSession,
  syncWorkoutTemplate,
} from './supabaseSync';

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
  return dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id).then((res) => res || null);
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
    id: crypto.randomUUID(),
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

  const updatedTemplate = { ...template, ...updates, id: template.id };
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
    syncWithRetry(() => deleteCloudWorkoutTemplate(user.id, id), `deleteWorkoutTemplate:${id}`);
  }
};

/**
 * Loads a workout template into a new workout item.
 */
export const loadWorkoutFromTemplate = async (templateId: string): Promise<PersonalItem> => {
  const template = await getWorkoutTemplate(templateId);
  if (!template) throw new NotFoundError('WorkoutTemplate', templateId);

  const exercises: Exercise[] = template.exercises.map((ex) => ({
    id: ex.id,
    name: ex.exerciseName,
    targetMuscle: ex.targetMuscle,
    muscleGroup: ex.muscleGroup,
    tempo: ex.tempo,
    targetRestTime: ex.targetRestTime ?? ex.restSeconds,
    notes: ex.notes,
    sets: (ex.sets ?? []).map((s) => createWorkoutSet({ reps: s.reps, weight: s.weight })),
  }));

  const newWorkout: Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'> = {
    type: 'workout',
    title: template.name,
    content: template.description || '',
    exercises,
    workoutTemplateId: templateId,
    workoutStartTime: new Date().toISOString(),
    isActiveWorkout: true,
  };

  return addPersonalItem(newWorkout);
};

/**
 * Re-add workout template from cloud (no cloud sync trigger).
 */
export const reAddWorkoutTemplate = (template: WorkoutTemplate): Promise<void> =>
  dbPut(LS.WORKOUT_TEMPLATES, template);

/**
 * Replace all workout templates with cloud data.
 */
export const replaceWorkoutTemplatesFromCloud = async (
  templates: WorkoutTemplate[]
): Promise<void> => {
  await dbClear(LS.WORKOUT_TEMPLATES);
  await Promise.all(templates.map((template) => dbPut(LS.WORKOUT_TEMPLATES, template)));
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
 *
 * Uses a reverse cursor on the `startTime` index (added in DB v7) to read
 * only the latest `limit` records — instead of loading the entire store
 * into memory and sorting in JavaScript. Falls back to the previous full
 * scan if the index isn't present (e.g. an older DB connection that
 * hasn't been upgraded yet in this tab).
 */
export const getWorkoutSessions = async (limit = 20): Promise<WorkoutSession[]> => {
  try {
    const db = await initDB();
    const store = db.transaction(LS.WORKOUT_SESSIONS, 'readonly').objectStore(LS.WORKOUT_SESSIONS);

    if (!store.indexNames.contains('startTime')) {
      throw new Error('startTime index missing — falling back to full scan');
    }

    return await new Promise<WorkoutSession[]>((resolve, reject) => {
      const out: WorkoutSession[] = [];
      const request = store.index('startTime').openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor || out.length >= limit) {
          resolve(out);
          return;
        }
        out.push(cursor.value as WorkoutSession);
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }
};

/**
 * Get every workout session in storage, sorted by start time descending.
 *
 * Use this when correctness over arbitrary depth matters (e.g. PR detection
 * across full history). Reads via the `startTime` index cursor so memory cost
 * scales with row count, not with any artificial limit. Falls back to a full
 * scan + JS sort if the index is missing.
 */
export const getAllWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  try {
    const db = await initDB();
    const store = db.transaction(LS.WORKOUT_SESSIONS, 'readonly').objectStore(LS.WORKOUT_SESSIONS);

    if (!store.indexNames.contains('startTime')) {
      throw new Error('startTime index missing — falling back to full scan');
    }

    return await new Promise<WorkoutSession[]>((resolve, reject) => {
      const out: WorkoutSession[] = [];
      const request = store.index('startTime').openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(out);
          return;
        }
        out.push(cursor.value as WorkoutSession);
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }
};

/**
 * Re-add workout session from cloud (no cloud sync trigger).
 */
export const reAddWorkoutSession = (session: WorkoutSession): Promise<void> =>
  dbPut(LS.WORKOUT_SESSIONS, session);

/**
 * Replace all workout sessions with cloud data.
 */
export const replaceWorkoutSessionsFromCloud = async (
  sessions: WorkoutSession[]
): Promise<void> => {
  await dbClear(LS.WORKOUT_SESSIONS);
  await Promise.all(sessions.map((session) => dbPut(LS.WORKOUT_SESSIONS, session)));
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
    syncWithRetry(() => syncBodyWeight(user.id, entry), `saveBodyWeight:${entry.id}`);
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
  await Promise.all(entries.map((entry) => dbPut(LS.BODY_WEIGHT, entry)));
};

/**
 * Delete a body weight entry by ID.
 */
export const deleteBodyWeight = async (id: string): Promise<void> => {
  if (!id) throw new ValidationError('Body weight ID is required for deletion.');
  await dbDelete(LS.BODY_WEIGHT, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudBodyWeight(user.id, id), `deleteBodyWeight:${id}`);
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
  const builtIn = getBUILT_IN_EXERCISES(now);
  const existingNames = new Set(exercises.map((e) => e.name));
  const missingBuiltIns = builtIn.filter((b) => !existingNames.has(b.name));

  if (missingBuiltIns.length > 0) {
    const newExercises = missingBuiltIns.map((ex) => ({
      ...ex,
      id: crypto.randomUUID(),
      createdAt: now,
    })) as PersonalExercise[];

    await Promise.all(newExercises.map((ex) => dbPut(LS.PERSONAL_EXERCISES, ex)));
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
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    useCount: 0,
  } as PersonalExercise;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(LS.PERSONAL_EXERCISES);
    const request = store.add(newExercise);

    request.onsuccess = () => {
      getCurrentUser().then((user) => {
        if (user) {
          syncWithRetry(
            () => syncPersonalExercise(user.id, { ...newExercise, name: newExercise.name ?? '' }),
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
      getCurrentUser().then((user) => {
        if (user) {
          syncWithRetry(
            () => syncPersonalExercise(user.id, { ...updated, name: updated.name ?? '' }),
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
 * Delete a personal exercise and cascade-delete its associated personal records.
 */
export const deletePersonalExercise = async (id: string): Promise<void> => {
  // Cascade: remove all personal records linked to this exercise
  const allPRs = await dbGetAll<{ id: string; exerciseId: string }>(STORES.PERSONAL_RECORDS);
  const orphanedPRs = allPRs.filter((pr) => pr.exerciseId === id);
  await Promise.all(orphanedPRs.map((pr) => dbDelete(STORES.PERSONAL_RECORDS, pr.id)));

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(LS.PERSONAL_EXERCISES);
    const request = store.delete(id);

    request.onsuccess = () => {
      getCurrentUser().then((user) => {
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
  exercises.forEach((ex) => {
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
      await Promise.all(
        remove.map((ex) => {
          const tx = db.transaction(LS.PERSONAL_EXERCISES, 'readwrite');
          const store = tx.objectStore(LS.PERSONAL_EXERCISES);
          return store.delete(ex.id);
        })
      );

      removedCount += remove.length;
    }
  }

  return removedCount;
};

// ==================== BUILT-IN WORKOUT TEMPLATES ====================

export interface BuiltInTemplateExercise {
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: number;
  targetRestTime: number;
}

export interface BuiltInWorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: BuiltInTemplateExercise[];
  muscleGroups: string[];
  icon: string;
}

export const getBuiltInWorkoutTemplates = (): BuiltInWorkoutTemplate[] => [
  {
    id: 'builtin-full-body',
    name: 'אימון כללי',
    description: 'אימון גוף מלא - כל השרירים הגדולים',
    exercises: [
      {
        name: 'סקוואט | Back Squat',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'לחיצת חזה | Bench Press',
        muscleGroup: 'Chest',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'מתח | Pull Up',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'לחיצת כתפיים | Overhead Press',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'כפיפת מוט | Barbell Curl',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'פשיטת מרפקים בכבל | Tricep Pushdown',
        muscleGroup: 'Triceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'פלאנק | Plank',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 60,
        targetRestTime: 45,
      },
    ],
    muscleGroups: ['חזה', 'גב', 'רגליים', 'כתפיים', 'יד קדמית', 'יד אחורית', 'בטן'],
    icon: '§',
  },
  {
    id: 'builtin-chest-shoulders',
    name: 'חזה + כתפיים',
    description: 'דגש על חזה וכתפיים - פיתוח רוחב ועומק',
    exercises: [
      {
        name: 'לחיצת חזה | Bench Press',
        muscleGroup: 'Chest',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'לחיצת חזה בשיפוע חיובי | Incline Dumbbell Press',
        muscleGroup: 'Chest',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'פרפר בכבלים | Cable Fly',
        muscleGroup: 'Chest',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'לחיצת כתפיים | Overhead Press',
        muscleGroup: 'Shoulders',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'הרחקה לצדדים | Dumbbell Lateral Raise',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'פרפר הפוך במכונה | Reverse Pec Deck',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['חזה', 'כתפיים'],
    icon: '§',
  },
  {
    id: 'builtin-back-arms',
    name: 'גב + זרועות',
    description: 'רחב גבי ובידוד ידיים - מראה V',
    exercises: [
      {
        name: 'מתח | Pull Up',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'משיכת פולי עליון | Lat Pulldown',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'חתירה במוט | Barbell Row',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'משיכה לפנים | Face Pull',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'פשיטת מרפקים בכבל | Tricep Pushdown',
        muscleGroup: 'Triceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת מוט | Barbell Curl',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת פטישים | Hammer Curls',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['גב', 'יד קדמית', 'יד אחורית'],
    icon: '§',
  },
  {
    id: 'builtin-legs',
    name: 'רגליים',
    description: 'כל הרגל - ארבע ראשי, ירך אחורי וישבן',
    exercises: [
      {
        name: 'סקוואט | Back Squat',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'דדליפט רומני | Romanian Deadlift (RDL)',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'לחיצת רגליים | Leg Press',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 90,
      },
      {
        name: 'פשיטת ברכיים | Leg Extension',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת ברכיים בשכיבה | Lying Leg Curl',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: "היפ ת'ראסט | Hip Thrust",
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 90,
      },
      {
        name: 'הרמת עקבים | Calf Raise',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 15,
        targetRestTime: 45,
      },
    ],
    muscleGroups: ['רגליים'],
    icon: '§',
  },
  {
    id: 'builtin-core',
    name: 'בטן + ליבה',
    description: 'חיזוק שרירי הליבה והבטן - יציבות ומראה',
    exercises: [
      {
        name: 'פלאנק | Plank',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 60,
        targetRestTime: 45,
      },
      {
        name: 'כפיפות בטן | Crunch',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 20,
        targetRestTime: 45,
      },
      {
        name: 'כפיפות בטן בכבל | Cable Crunch',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'הרמת רגליים בתלייה | Hanging Leg Raise',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'טוויסט רוסי | Russian Twist',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 20,
        targetRestTime: 45,
      },
      {
        name: 'פשיטת גב / סופרמן | Hyperextension',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['בטן', 'ליבה'],
    icon: '§',
  },
];

// Convert built-in template to WorkoutTemplate format
export const convertBuiltInToWorkoutTemplate = (
  builtin: BuiltInWorkoutTemplate
): WorkoutTemplate => ({
  id: builtin.id,
  name: builtin.name,
  description: builtin.description,
  exercises: builtin.exercises.map((ex, index) => ({
    id: `builtin-${builtin.id}-${index}`,
    exerciseId: ex.name,
    exerciseName: ex.name,
    targetMuscle: ex.muscleGroup,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    targetWeight: null,
    restSeconds: ex.targetRestTime,
    order: index,
    notes: '',
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    targetRestTime: ex.targetRestTime,
    sets: Array(ex.targetSets)
      .fill(null)
      .map(() => ({
        reps: ex.targetReps,
        weight: 0,
      })),
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
  muscleGroups: builtin.muscleGroups,
  isBuiltin: true,
});

// ==================== REPLACE FROM CLOUD (for pullAllData) ====================
// These functions clear local IndexedDB and replace with cloud data

/**
 * Replace all personal exercises with cloud data.
 */
export const replacePersonalExercisesFromCloud = async (
  exercises: PersonalExercise[]
): Promise<void> => {
  await dbClear(LS.PERSONAL_EXERCISES);
  await Promise.all(exercises.map((ex) => dbPut(LS.PERSONAL_EXERCISES, ex)));
};

/**
 * Merge body measurements from cloud into local IndexedDB without dropping
 * local-only records. Name kept for backwards compatibility; the implementation
 * is now non-destructive (delegates to mergeGenericRecords defined below).
 */
export const replaceBodyMeasurementsFromCloud = async (measurements: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.BODY_MEASUREMENTS,
    (measurements as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge personal records from cloud (non-destructive).
 */
export const replacePersonalRecordsFromCloud = async (records: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.PERSONAL_RECORDS,
    (records as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge recovery logs from cloud (non-destructive).
 */
export const replaceRecoveryLogsFromCloud = async (logs: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    LS.RECOVERY_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge nutrition logs from cloud (non-destructive).
 */
export const replaceNutritionLogsFromCloud = async (logs: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    LS.NUTRITION_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Replace all user settings with cloud data.
 */
export const replaceUserSettingsFromCloud = async (settings: unknown[]): Promise<void> => {
  await dbClear(LS.USER_SETTINGS);
  await Promise.all(settings.map((s) => dbPut(LS.USER_SETTINGS, s as object)));
};

/**
 * Replace all AI conversations with cloud data.
 */
export const replaceAIConversationsFromCloud = async (conversations: unknown[]): Promise<void> => {
  await dbClear(STORES.AI_CONVERSATIONS);
  await Promise.all(conversations.map((c) => dbPut(STORES.AI_CONVERSATIONS, c as object)));
};

// ==================== MERGE FROM CLOUD (non-destructive) ====================

/**
 * Merge workout templates from cloud - keeps the most recent version of each record.
 * Unlike replace, this preserves local-only records and resolves conflicts by updatedAt timestamp.
 */
export const mergeWorkoutTemplatesFromCloud = async (
  cloudTemplates: WorkoutTemplate[]
): Promise<{ added: number; updated: number; kept: number }> => {
  const localTemplates = await dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES);
  const localMap = new Map(localTemplates.map((t) => [t.id, t]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudTemplates) {
    const local = localMap.get(cloud.id);
    if (!local) {
      // New from cloud - add it
      await dbPut(STORES.WORKOUT_TEMPLATES, cloud);
      added++;
    } else {
      // Both exist - keep the newer one
      const localTime = new Date(local.updatedAt || local.createdAt).getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(STORES.WORKOUT_TEMPLATES, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
};

/**
 * Merge workout sessions from cloud.
 */
export const mergeWorkoutSessionsFromCloud = async (
  cloudSessions: WorkoutSession[]
): Promise<{ added: number; updated: number; kept: number }> => {
  const localSessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  const localMap = new Map(localSessions.map((s) => [s.id, s]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudSessions) {
    const local = localMap.get(cloud.id);
    if (!local) {
      await dbPut(STORES.WORKOUT_SESSIONS, cloud);
      added++;
    } else {
      const localTime = new Date(local.updatedAt || local.createdAt).getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(STORES.WORKOUT_SESSIONS, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
};

/**
 * Generic merge for simple timestamped records.
 */
async function mergeGenericRecords<
  T extends { id?: string; createdAt?: string; updatedAt?: string },
>(storeName: string, cloudRecords: T[]): Promise<{ added: number; updated: number; kept: number }> {
  const localRecords = await dbGetAll<T>(storeName);
  const localMap = new Map(localRecords.map((r) => [String(r.id ?? ''), r]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudRecords) {
    const local = localMap.get(String(cloud.id ?? ''));
    if (!local) {
      await dbPut(storeName, cloud);
      added++;
    } else {
      const localTime = new Date(local.updatedAt || local.createdAt || '').getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(storeName, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
}

export const mergeBodyWeightFromCloud = (
  entries: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.BODY_WEIGHT, entries);
export const mergeBodyMeasurementsFromCloud = (
  measurements: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.BODY_MEASUREMENTS, measurements);
export const mergePersonalRecordsFromCloud = (
  records: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.PERSONAL_RECORDS, records);
export const mergeRecoveryLogsFromCloud = (
  logs: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.RECOVERY_LOGS, logs);
export const mergeNutritionLogsFromCloud = (
  logs: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.NUTRITION_LOGS, logs);
export const mergeUserSettingsFromCloud = (
  settings: { id?: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.USER_SETTINGS, settings);
export const mergeAIConversationsFromCloud = (
  conversations: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.AI_CONVERSATIONS, conversations);
export const mergePersonalExercisesFromCloud = (
  exercises: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.PERSONAL_EXERCISES, exercises);
