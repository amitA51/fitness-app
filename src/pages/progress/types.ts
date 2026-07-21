/**
 * Top-level Progress sections. Restructured from the original six
 * (overview · workouts · strength · weight · measurements · recovery) into four
 * grouped tabs: Strength folds into Workouts, and Weight + Measurements merge
 * into a single Body tab. No functionality is dropped — only regrouped.
 */
export type ProgressTab = 'overview' | 'workouts' | 'body' | 'recovery';

/** Secondary segmented control inside the Workouts tab, to de-densify content. */
export type WorkoutsSubTab = 'history' | 'strength';

/** Secondary segmented control inside the Body tab. */
export type BodySubTab = 'weight' | 'measurements' | 'photos';

export interface WeeklyRecoveryAverage {
  avgSleep: number;
  avgEnergy: number;
  avgSoreness: number;
  avgStress: number;
  avgScore: number;
}

export interface StrengthDataPoint {
  date: string;
  value: number;
  volume: number;
}

export interface ExerciseStrengthCurve {
  exerciseName: string;
  data: StrengthDataPoint[];
  latestWeight: number;
  change: number;
  changePct: number;
}

/**
 * How an exercise is trending, for the scannable strength list.
 * - improving / stable / declining — graded from the e1RM trend window.
 * - new      — too few sessions to judge a trend yet.
 * - dormant  — not trained within the dormant window (needs a nudge back).
 */
export type ExerciseTrendStatus = 'improving' | 'stable' | 'declining' | 'new' | 'dormant';

/**
 * One session's strength contribution for an exercise: the best WORKING set
 * (highest estimated 1RM, warmups excluded) plus the context needed to explain
 * the number in the detail view (how many working sets, how much volume).
 */
export interface StrengthSessionPoint {
  /** Session date, YYYY-MM-DD. */
  date: string;
  /** Estimated 1RM of the best working set that session (rounded kg). */
  e1RM: number;
  /** Weight of the set that produced the best e1RM. */
  topWeight: number;
  /** Reps of the set that produced the best e1RM. */
  topReps: number;
  /** Count of completed, non-warmup sets that session. */
  workingSets: number;
  /** Completed working-set volume that session. */
  volume: number;
}

/**
 * Per-exercise strength progress model — the honest, e1RM-based answer to
 * "am I getting stronger?". One row per tracked exercise in the master list;
 * `points` drives the drill-down chart + history.
 */
export interface ExerciseProgress {
  exerciseName: string;
  /** Chronological (oldest → newest) strength points, one per training day. */
  points: StrengthSessionPoint[];
  /** e1RM of the most recent point. */
  currentE1RM: number;
  latestTopWeight: number;
  latestTopReps: number;
  /** Signed e1RM change (kg) across the recent trend window. */
  deltaE1RM: number;
  /** Same change as a whole-ish percent (1 decimal). */
  deltaPct: number;
  status: ExerciseTrendStatus;
  /** Date (YYYY-MM-DD) of the most recent session with this exercise. */
  lastTrainedDate: string;
  /** Whole days between `lastTrainedDate` and now. */
  daysSinceLast: number;
  /** Number of distinct training days tracked for this exercise. */
  sessionCount: number;
}
