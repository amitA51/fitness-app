// ============================================================================
// CLIENT 360 — consolidated data hook (Fresh Steel / Obsidian)
// ============================================================================
// ONE loader that replaces the 9 scattered useAsyncData calls the old
// ClientDetail had. Each domain keeps its own useAsyncData (so per-domain reload
// + error stay granular and the edit sheets can refresh just their slice), but
// the orchestrator consumes a single typed object. `isLoading` reflects only the
// few critical loads (link + analytics + recent sessions) so the shell renders
// fast and lists fill in.

import {
  type CheckIn,
  type ClientAnalytics,
  getClientAnalytics,
  getClientBodyWeight,
  getClientLink,
  getClientMeasurements,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  listCheckIns,
  listCoachAssignments,
} from '../../../services/coach';
import type {
  BodyMeasurement,
  NutritionLog,
  PersonalRecordRow,
} from '../../../services/supabaseSyncMappers';
import type { BodyWeightEntry, WorkoutSession } from '../../../types';
import type { Assignment, CoachClient } from '../../../types/coach';
import { useAsyncData } from '../_shared';

/** How many recent sessions the Training tab lists. */
const RECENT_SESSIONS_LIMIT = 10;
/** Trailing days of nutrition logs the Nutrition tab shows. */
const NUTRITION_DAYS = 7;

export interface ClientData {
  link: CoachClient | null;
  analytics: ClientAnalytics | null;
  sessions: WorkoutSession[];
  weights: BodyWeightEntry[];
  measurements: BodyMeasurement[];
  prs: PersonalRecordRow[];
  nutrition: NutritionLog[];
  checkIns: CheckIn[];
  assignments: Assignment[];
  /** Critical-path loading (link + analytics + recent sessions). */
  isLoading: boolean;
  /** Any critical load failed. */
  error: string | null;
  /** Reload the critical surfaces (link, analytics, sessions). */
  reload: () => void;
  reloadSessions: () => void;
  reloadNutrition: () => void;
  reloadWeights: () => void;
  // Per-domain load state so the Nutrition/Metrics lists can show their own
  // loading/error/empty cycle (a failed fetch is otherwise indistinguishable
  // from "no data", since the underlying reads swallow failures to []).
  nutritionLoading: boolean;
  nutritionError: string | null;
  weightsLoading: boolean;
  weightsError: string | null;
  measurementsLoading: boolean;
  measurementsError: string | null;
  reloadMeasurements: () => void;
  prsLoading: boolean;
  prsError: string | null;
  reloadPrs: () => void;
}

/**
 * Load every Client-360 domain for `clientId`. Per-domain useAsyncData keeps the
 * reloads independent so an edit sheet refreshes only its slice.
 */
export function useClientData(clientId: string): ClientData {
  const linkQ = useAsyncData(() => getClientLink(clientId), null);
  const analyticsQ = useAsyncData(() => getClientAnalytics(clientId), null);
  const sessionsQ = useAsyncData(() => getClientSessions(clientId, RECENT_SESSIONS_LIMIT), []);
  const weightsQ = useAsyncData(() => getClientBodyWeight(clientId), []);
  const measurementsQ = useAsyncData(() => getClientMeasurements(clientId), []);
  const prsQ = useAsyncData(() => getClientPRs(clientId), []);
  const nutritionQ = useAsyncData(() => getClientNutrition(clientId, NUTRITION_DAYS), []);
  const checkInsQ = useAsyncData(() => listCheckIns(clientId), []);
  const assignmentsQ = useAsyncData(() => listCoachAssignments(clientId), []);

  const reload = () => {
    linkQ.reload();
    analyticsQ.reload();
    sessionsQ.reload();
  };

  return {
    link: linkQ.data,
    analytics: analyticsQ.data,
    sessions: sessionsQ.data,
    weights: weightsQ.data,
    measurements: measurementsQ.data,
    prs: prsQ.data,
    nutrition: nutritionQ.data,
    checkIns: checkInsQ.data,
    assignments: assignmentsQ.data,
    isLoading: linkQ.loading || analyticsQ.loading || sessionsQ.loading,
    error: linkQ.error ?? analyticsQ.error ?? sessionsQ.error,
    reload,
    reloadSessions: sessionsQ.reload,
    reloadNutrition: nutritionQ.reload,
    reloadWeights: weightsQ.reload,
    nutritionLoading: nutritionQ.loading,
    nutritionError: nutritionQ.error,
    weightsLoading: weightsQ.loading,
    weightsError: weightsQ.error,
    measurementsLoading: measurementsQ.loading,
    measurementsError: measurementsQ.error,
    reloadMeasurements: measurementsQ.reload,
    prsLoading: prsQ.loading,
    prsError: prsQ.error,
    reloadPrs: prsQ.reload,
  };
}
