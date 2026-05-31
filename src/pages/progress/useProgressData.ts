// ============================================================================
// SPARKOS FITNESS - useProgressData
// ============================================================================
// SINGLE source of all Progress-screen loading. Previously sessions were fetched
// three times (Progress.tsx:getWorkoutSessions(50), StrengthTab:getWorkoutSessions(100),
// RecoveryTab: its own getRecoveryLogsByDateRange). This hook loads everything once
// over a uniform window and hands the results down as props, so every tab reads
// from the same data and the same point in time.

import { useCallback, useEffect, useState } from 'react';
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
import type { PersonalRecord, WorkoutSession } from '../../types';
import { toLocalDateStr, todayStr } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import type { WeeklyRecoveryAverage } from './types';

/** Uniform load window for body/recovery range queries (days). */
const WINDOW_DAYS = 30;
/** How many recent workout sessions to pull for all session-derived metrics. */
const SESSION_LIMIT = 100;

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
  isLoading: boolean;
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
    } catch (error) {
      // Surface the failure through the project logger rather than swallowing it.
      // State keeps its last-good values so the screen degrades gracefully.
      logger.analytics.error('Failed to load progress data', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
    isLoading,
    reload,
  };
}
