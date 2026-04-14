// ============================================================================
// SPARKOS FITNESS - Data Context
// ============================================================================

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Exercise, WorkoutSession, WorkoutTemplate, PersonalItem } from '../types';
import { logger } from '../utils/logger';
import { getPersonalExercises, createPersonalExercise, updatePersonalExercise, deletePersonalExercise } from '../services/workoutDb';
import { getWorkoutSessions } from '../services/dataService';
import { getWorkoutTemplates } from '../services/workoutService';

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

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      logger.db.info('Loading data from IndexedDB...');
      
      // Load all data in parallel for better performance
      const [loadedExercises, loadedSessions, loadedTemplates, loadedPersonalItems] = await Promise.all([
        getPersonalExercises(),
        getWorkoutSessions(100), // Get last 100 sessions
        getWorkoutTemplates(),
        getPersonalExercises().then(exercises => exercises.map(ex => ({
          type: 'exercise' as const,
          name: ex.name,
          isActiveWorkout: false,
          createdAt: ex.createdAt,
          updatedAt: new Date().toISOString(),
          ...ex
        } as unknown as PersonalItem))),
      ]);

      setExercises(loadedExercises);
      setSessions(loadedSessions);
      setTemplates(loadedTemplates);
      setPersonalItems(loadedPersonalItems);
      
      logger.db.info('Data loaded successfully', {
        exercises: loadedExercises.length,
        sessions: loadedSessions.length,
        templates: loadedTemplates.length,
        personalItems: loadedPersonalItems.length,
      });
    } catch (err) {
      logger.db.error('Failed to load data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const updatePersonalItem = useCallback(async (id: string, updates: Partial<PersonalItem>) => {
    try {
      await updatePersonalExercise(id, updates);
      setPersonalItems(prev => prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (err) {
      logger.db.error('Failed to update personal item', err);
      throw err;
    }
  }, []);

  const removePersonalItem = useCallback(async (id: string) => {
    try {
      await deletePersonalExercise(id);
      setPersonalItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      logger.db.error('Failed to remove personal item', err);
      throw err;
    }
  }, []);

  const addPersonalItem = useCallback(async (item: Omit<PersonalItem, 'id' | 'createdAt'>) => {
    try {
      const newItem = await createPersonalExercise({
        ...item,
        userId: 'local-user',
        lastWeight: null,
        lastReps: null,
        personalRecords: [],
      } as any);
      setPersonalItems(prev => [...prev, { ...newItem, type: 'exercise' } as unknown as PersonalItem]);
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
    refreshData();
  }, [refreshData]);

  return (
    <DataContext.Provider
      value={{
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export default DataContext;
