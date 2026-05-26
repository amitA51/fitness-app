/**
 * Lightweight input validation for fitness data at system boundaries.
 * No external deps — keeps the bundle lean.
 */

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeText(raw: unknown, maxLength = 500): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLength).replace(/[<>]/g, '');
}

export interface WorkoutInputLimits {
  weight: { min: number; max: number };
  reps: { min: number; max: number };
  rpe: { min: number; max: number };
  sets: { min: number; max: number };
  restSeconds: { min: number; max: number };
}

export const WORKOUT_LIMITS: Readonly<WorkoutInputLimits> = {
  weight: { min: 0, max: 999 },
  reps: { min: 0, max: 999 },
  rpe: { min: 1, max: 10 },
  sets: { min: 1, max: 30 },
  restSeconds: { min: 0, max: 600 },
};

export function validateWeight(v: unknown): number {
  return clampNumber(v, WORKOUT_LIMITS.weight.min, WORKOUT_LIMITS.weight.max, 0);
}

export function validateReps(v: unknown): number {
  return Math.round(clampNumber(v, WORKOUT_LIMITS.reps.min, WORKOUT_LIMITS.reps.max, 0));
}

export function validateRPE(v: unknown): number | null {
  const n = clampNumber(v, WORKOUT_LIMITS.rpe.min, WORKOUT_LIMITS.rpe.max, 0);
  return n === 0 ? null : n;
}

export interface ProfileInput {
  name: string;
  age: number;
  weight: number;
  height: number;
}

export function validateProfileInput(raw: Record<string, unknown>): ProfileInput {
  return {
    name: sanitizeText(raw.name, 100),
    age: Math.round(clampNumber(raw.age, 13, 120, 25)),
    weight: clampNumber(raw.weight, 20, 300, 70),
    height: Math.round(clampNumber(raw.height, 100, 250, 170)),
  };
}
