/**
 * Lightweight input validation for fitness data at system boundaries.
 * No external deps — keeps the bundle lean.
 */

import { WORKOUT } from '../constants/workoutConstants';

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
  weight: { min: 0, max: WORKOUT.MAX_WEIGHT },
  reps: { min: 0, max: WORKOUT.MAX_REPS },
  rpe: { min: 1, max: WORKOUT.RPE_SCALE_MAX },
  sets: { min: 1, max: WORKOUT.MAX_SETS },
  restSeconds: { min: 0, max: WORKOUT.MAX_REST_TIME },
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

export function parseUserProfile(raw: unknown): { name?: string } {
  if (raw == null || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? sanitizeText(obj.name, 100) : undefined;
  return name ? { name } : {};
}
