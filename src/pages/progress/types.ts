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
export type BodySubTab = 'weight' | 'measurements';

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
