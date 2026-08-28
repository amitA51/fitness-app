// ============================================================================
// SPARKOS FITNESS - useProgressData
// ============================================================================
// SINGLE source of all Progress-screen loading. Previously sessions were fetched
// three times (Progress.tsx:getWorkoutSessions(50), StrengthTab:getWorkoutSessions(100),
// RecoveryTab: its own getRecoveryLogsByDateRange). This hook loads everything once
// over a uniform window and hands the results down as props, so every tab reads
// from the same data and the same point in time.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateWeightTrend,
  getBodyMeasurementsByDateRange,
  getBodyWeightsByDateRange,
  getLatestMeasurement,
  getLatestWeight,
  getLegacyRecoveryScore,
  getRecoveryLogsByDateRange,
  getTodayRecoveryLog,
  getWeeklyRecoveryAverage,
} from '../../services/bodyStatsService';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  RecoveryLog,
  WeightTrend,
} from '../../services/bodyStatsService';
import { getWorkoutSessions } from '../../services/dataService';
import { getAllPRs } from '../../services/prService';
import { type TrainingLoadResult, calculateTrainingLoad } from '../../services/trainingLoadService';
import type { PersonalRecord, WorkoutSession } from '../../types';
import { toLocalDateStr, todayStr } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import type { WeeklyRecoveryAverage } from './types';

/**
 * Uniform load window for body/recovery range queries (days). Widened from 30 to
 * a full year so the per-chart time-range control (W/M/3M/6M/Y) can slice the
 * already-loaded arrays by date instead of triggering a re-fetch per range.
 */
const WINDOW_DAYS = 365;
/**
 * How many recent workout sessions to pull for all session-derived metrics.
 * Raised alongside WINDOW_DAYS so a year-long volume trend isn't truncated by the
 * session cap before the date slice runs.
 */
const SESSION_LIMIT = 400;

const EMPTY_WEEKLY: WeeklyRecoveryAverage = {
  avgSleep: 0,
  avgEnergy: 0,
  avgSoreness: 0,
  avgStress: 0,
  avgScore: 0,
};

export interface ProgressData {
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
  weightEntries: BodyWeightEntry[];
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  measurements: BodyMeasurement[];
  latestMeasurement: BodyMeasurement | null;
  todayRecovery: RecoveryLog | null;
  recoveryScore: ReturnType<typeof getLegacyRecoveryScore> | null;
  recoveryHistory: RecoveryLog[];
  weeklyRecovery: WeeklyRecoveryAverage;
  /**
   * Deterministic training-load reading over the SAME sessions + recovery logs
   * loaded above. Computed here rather than in a tab so the recovery logs this
   * hook already fetches actually reach the engine — every previous caller of
   * calculateTrainingLoad from the UI side passed an empty array, which left
   * every recovery-driven penalty inert.
   */
  trainingLoad: TrainingLoadResult;
  isLoading: boolean;
  /** True when the last load failed — the page shows an explicit error + retry. */
  loadError: boolean;
  reload: () => Promise<void>;
}

export function useProgressData(): ProgressData {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [weightEntries, setWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<BodyWeightEntry | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [todayRecovery, setTodayRecovery] = useState<RecoveryLog | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<ReturnType<
    typeof getLegacyRecoveryScore
  > | null>(null);
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryLog[]>([]);
  const [weeklyRecovery, setWeeklyRecovery] = useState<WeeklyRecoveryAverage>(EMPTY_WEEKLY);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    const today = todayStr();
    const windowStart = toLocalDateStr(new Date(Date.now() - WINDOW_DAYS * 86400000));
    const weekAgo = toLocalDateStr(new Date(Date.now() - 7 * 86400000));

    try {
      const [weights, latest, meas, latestMeas, rec, weekly, loadedSessions, allPRs, recHistory] =
        await Promise.all([
          getBodyWeightsByDateRange(windowStart, today),
          getLatestWeight(),
          getBodyMeasurementsByDateRange(windowStart, today),
          getLatestMeasurement(),
          getTodayRecoveryLog(),
          getWeeklyRecoveryAverage(),
          getWorkoutSessions(SESSION_LIMIT),
          getAllPRs(),
          getRecoveryLogsByDateRange(weekAgo, today),
        ]);

      setWeightEntries(weights);
      setLatestWeight(latest);
      setWeightTrend(weights.length >= 2 ? calculateWeightTrend(weights) : null);
      setMeasurements(meas);
      setLatestMeasurement(latestMeas);
      setTodayRecovery(rec);
      setRecoveryScore(rec ? getLegacyRecoveryScore(rec) : null);
      setWeeklyRecovery(weekly);
      setSessions(loadedSessions);
      setPRs(allPRs);
      setRecoveryHistory(recHistory);
      setLoadError(false);
    } catch (error) {
      // Surface the failure to BOTH the logger and the UI: without an exposed
      // error flag the page rendered the "first workout" empty state to users
      // who actually have data. State keeps its last-good values.
      logger.analytics.error('Failed to load progress data', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // recoveryHistory is the last 7 days of logs; the engine reads the most recent
  // one for its recovery penalty, so this is exactly the input it needs.
  const trainingLoad = useMemo(
    () => calculateTrainingLoad(sessions, recoveryHistory),
    [sessions, recoveryHistory]
  );

  return {
    sessions,
    prs,
    weightEntries,
    latestWeight,
    weightTrend,
    measurements,
    latestMeasurement,
    todayRecovery,
    recoveryScore,
    recoveryHistory,
    weeklyRecovery,
    trainingLoad,
    isLoading,
    loadError,
    reload,
  };
}
