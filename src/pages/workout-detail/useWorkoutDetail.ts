/**
 * useWorkoutDetail — loads a single completed session plus the session it
 * should be compared against, derived from recent history in the same fetch.
 */

import { useEffect, useState } from 'react';
import { getWorkoutSession, getWorkoutSessions } from '../../services/workoutDb';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
import { derivePreviousSession } from './helpers';

interface WorkoutDetailState {
  session: WorkoutSession | null;
  previousSession: WorkoutSession | null;
  loading: boolean;
  error: string | null;
}

/** How many recent sessions to scan when deriving the comparison baseline. */
const RECENT_SESSIONS_LIMIT = 30;

export function useWorkoutDetail(id: string | undefined): WorkoutDetailState {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [previousSession, setPreviousSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('מזהה אימון לא נמצא');
      setLoading(false);
      return;
    }
    const sessionId = id;
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        // Load the session and recent history in parallel to avoid a waterfall;
        // the previous session is derived from the same fetch.
        const [data, recentSessions] = await Promise.all([
          getWorkoutSession(sessionId),
          getWorkoutSessions(RECENT_SESSIONS_LIMIT),
        ]);
        if (cancelled) return;
        if (!data) {
          setSession(null);
          setPreviousSession(null);
          setError('האימון לא נמצא');
        } else {
          setSession(data);
          setPreviousSession(derivePreviousSession(data, recentSessions));
        }
      } catch (err) {
        if (cancelled) return;
        setError('שגיאה בטעינת האימון');
        logger.workout.error('Error loading workout session', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { session, previousSession, loading, error };
}
