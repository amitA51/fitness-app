// ============================================================================
// SPARKOS FITNESS - Data Context
// ============================================================================
// Provides the recent workout-session list (capped) to the dashboard. Exercise
// and template data is loaded on demand by the screens that need it (via the
// workoutDb services directly), so this provider intentionally does NOT eagerly
// load or expose them — that keeps app startup light and avoids re-rendering
// consumers on data they never read.

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
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';

const RECENT_SESSIONS_LIMIT = 20;

interface DataContextValue {
  sessions: WorkoutSession[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
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
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      logger.db.info('Loading recent sessions from IndexedDB...');
      const loadedSessions = await getWorkoutSessions(RECENT_SESSIONS_LIMIT);
      setSessions(loadedSessions);
      logger.db.info('Sessions loaded successfully', { sessions: loadedSessions.length });
    } catch (err) {
      logger.db.error('Failed to load data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
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

    // No `cancelled` cleanup guard here, on purpose: under StrictMode the first
    // mount's cleanup ran before loadData resolved, the remount was blocked by
    // initialLoadRef, and the skipped setLoading(false) left the dashboard
    // skeletons up forever. React 18 makes post-unmount setState a no-op, so
    // always clearing the flag is safe.
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const contextValue = useMemo(
    () => ({
      sessions,
      loading,
      error,
      refreshData,
    }),
    [sessions, loading, error, refreshData]
  );

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
};

export default DataContext;
