// ============================================================================
// SPARKOS FITNESS - Data Context
// ============================================================================

import type React from 'react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getWorkoutSessions } from '../services/dataService';
import { getWorkoutTemplates } from '../services/workoutDb';
import {
  createPersonalExercise,
  deletePersonalExercise,
  getPersonalExercises,
  updatePersonalExercise,
} from '../services/workoutDb';
import type { Exercise, PersonalItem, WorkoutSession, WorkoutTemplate } from '../types';
import { logger } from '../utils/logger';

interface DataContextValue {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  personalItems: PersonalItem[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updatePersonalItem: (id: string, updates: Partial<PersonalItem>) => Promise<void>;
  removePersonalItem: (id: string) => Promise<void>;
  addPersonalItem: (item: Omit<PersonalItem, 'id' | 'createdAt'>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

function mapExerciseToPersonalItem(ex: Exercise): PersonalItem {
  return {
    id: ex.id,
    type: 'exercise',
    name: ex.name,
    targetMuscle: ex.targetMuscle,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    instructions: ex.instructions,
    videoUrl: ex.videoUrl,
    imageUrl: ex.imageUrl,
    isCustom: ex.isCustom,
    isTimed: ex.isTimed,
    notes: ex.notes,
    createdAt: ex.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActiveWorkout: false,
  };
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      logger.db.info('Loading data from IndexedDB...');

      const [loadedExercises, loadedSessions, loadedTemplates] = await Promise.all([
        getPersonalExercises(),
        getWorkoutSessions(100),
        getWorkoutTemplates(),
      ]);

      const loadedPersonalItems = loadedExercises.map(mapExerciseToPersonalItem);

      setExercises(loadedExercises);
      setSessions(loadedSessions);
      setTemplates(loadedTemplates);
      setPersonalItems(loadedPersonalItems);

      logger.db.info('Data loaded successfully', {
        exercises: loadedExercises.length,
        sessions: loadedSessions.length,
        templates: loadedTemplates.length,
      });
    } catch (err) {
      logger.db.error('Failed to load data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const updatePersonalItem = useCallback(async (id: string, updates: Partial<PersonalItem>) => {
    try {
      await updatePersonalExercise(id, updates);
      setPersonalItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    } catch (err) {
      logger.db.error('Failed to update personal item', err);
      throw err;
    }
  }, []);

  const removePersonalItem = useCallback(async (id: string) => {
    try {
      await deletePersonalExercise(id);
      setPersonalItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      logger.db.error('Failed to remove personal item', err);
      throw err;
    }
  }, []);

  const addPersonalItem = useCallback(async (item: Omit<PersonalItem, 'id' | 'createdAt'>) => {
    try {
      const newItem = await createPersonalExercise({
        name: item.name ?? '',
        targetMuscle: item.targetMuscle,
        muscleGroup: item.muscleGroup,
        equipment: item.equipment,
        instructions: item.instructions,
        videoUrl: item.videoUrl,
        imageUrl: item.imageUrl,
        isCustom: item.isCustom,
        isTimed: item.isTimed,
        notes: item.notes,
        category: item.category,
        tempo: item.tempo,
        defaultRestTime: item.defaultRestTime,
        defaultSets: item.defaultSets,
        tutorialText: item.tutorialText,
        isFavorite: item.isFavorite,
        useCount: item.useCount,
        userId: 'local-user',
        lastWeight: null,
        lastReps: null,
        personalRecords: [],
      });
      setPersonalItems((prev) => [...prev, mapExerciseToPersonalItem(newItem)]);
    } catch (err) {
      logger.db.error('Failed to add personal item', err);
      throw err;
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadData();
    setLoading(false);
  }, [loadData]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadData();
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const contextValue = useMemo(
    () => ({
      exercises,
      sessions,
      templates,
      personalItems,
      loading,
      error,
      refreshData,
      updatePersonalItem,
      removePersonalItem,
      addPersonalItem,
    }),
    [
      exercises,
      sessions,
      templates,
      personalItems,
      loading,
      error,
      refreshData,
      updatePersonalItem,
      removePersonalItem,
      addPersonalItem,
    ]
  );

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};

export default DataContext;
