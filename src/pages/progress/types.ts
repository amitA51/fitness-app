export type ProgressTab =
  | 'overview'
  | 'workouts'
  | 'strength'
  | 'weight'
  | 'measurements'
  | 'recovery';

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
