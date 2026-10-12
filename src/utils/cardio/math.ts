// ============================================================================
// Cardio math — pace, energy, heart-rate zones, race estimates. All pure.
// ============================================================================
// Sources (checked 2026-10-11):
//  • Walking / running / treadmill energy: ACSM metabolic equations (ACSM's
//    Guidelines for Exercise Testing and Prescription):
//      walking VO2 = 3.5 + 0.1·S + 1.8·S·G     running VO2 = 3.5 + 0.2·S + 0.9·S·G
//    S = speed in m/min, G = grade (0.05 for 5%), MET = VO2 / 3.5. They handle
//    treadmill incline, which a flat MET table cannot.
//  • Everything else: Compendium of Physical Activities (Ainsworth et al. 2011,
//    and the 2024 update at pacompendium.com), kcal = MET × kg × hours.
//  • HRmax = 208 − 0.7 × age (Tanaka, Monahan & Seals 2001, meta-analysis of
//    18,712 subjects) — the 220 − age rule rests on weak 1971 data.
//  • Zones: five zones of 50/60/70/80/90 % of HRmax (Garmin's default), or of
//    heart-rate reserve (Karvonen) when a resting heart rate is known.
//  • Race estimate: Riegel, T2 = T1 × (D2 / D1)^1.06 — well calibrated up to a
//    half marathon, optimistic for the marathon, so the marathon is not offered.
//  • Long-run spike: a single run more than 10% longer than the longest run of
//    the previous 30 days carried a higher injury hazard in a 5,205-runner
//    cohort (BJSM 2025); the week-over-week "10% rule" showed no relationship.

import type { CardioActivity } from '../../types';
import { TREADMILL_WALK_MAX_KMH } from './activities';

// ---------------------------------------------------------------------------
// Pace & speed
// ---------------------------------------------------------------------------

const valid = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Seconds per kilometre, or null without both a distance and a time. */
export function paceSecPerKm(
  distanceKm: number | null | undefined,
  durationSec: number | null | undefined
): number | null {
  if (!valid(distanceKm) || !valid(durationSec)) return null;
  return durationSec / distanceKm;
}

/** Kilometres per hour, or null without both a distance and a time. */
export function speedKmh(
  distanceKm: number | null | undefined,
  durationSec: number | null | undefined
): number | null {
  if (!valid(distanceKm) || !valid(durationSec)) return null;
  return distanceKm / (durationSec / 3600);
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/** Inputs that shape an effort's MET value. Everything is optional. */
export interface MetInput {
  speedKmh?: number | null;
  /** Treadmill grade, percent. */
  inclinePct?: number | null;
  /** Elevation gained, metres (with distance → an average grade). */
  elevationGainM?: number | null;
  distanceKm?: number | null;
  /** Perceived effort 1–10 (the set's RPE). */
  effort?: number | null;
}

/** ACSM walking equation → MET. */
function acsmWalkingMet(kmh: number, grade: number): number {
  const s = (kmh * 1000) / 60;
  return (3.5 + 0.1 * s + 1.8 * s * grade) / 3.5;
}

/** ACSM running equation → MET. */
function acsmRunningMet(kmh: number, grade: number): number {
  const s = (kmh * 1000) / 60;
  return (3.5 + 0.2 * s + 0.9 * s * grade) / 3.5;
}

/** Grade from a typed incline, else from elevation over distance, clamped 0–30%. */
function gradeOf(input: MetInput): number {
  if (valid(input.inclinePct)) return Math.min(input.inclinePct, 30) / 100;
  if (valid(input.elevationGainM) && valid(input.distanceKm)) {
    return Math.min(input.elevationGainM / (input.distanceKm * 1000), 0.3);
  }
  return 0;
}

/** Pick a MET by perceived effort: [light ≤3, moderate (default), hard 7–8, max 9–10]. */
function byEffort(
  effort: number | null | undefined,
  light: number,
  moderate: number,
  hard: number,
  max: number
): number {
  if (!valid(effort)) return moderate;
  if (effort <= 3) return light;
  if (effort <= 6) return moderate;
  if (effort <= 8) return hard;
  return max;
}

/** Compendium bicycling METs by road speed. */
function cyclingMet(kmh: number | null | undefined): number {
  if (!valid(kmh)) return 7.5; // bicycling, general
  if (kmh < 16) return 4.0;
  if (kmh < 19.2) return 6.8;
  if (kmh < 22.4) return 8.0;
  if (kmh < 25.7) return 10.0;
  if (kmh < 32.2) return 12.0;
  return 15.8;
}

/** Compendium swimming METs by pace per 100 m. */
function swimmingMet(speed: number | null | undefined): number {
  if (!valid(speed)) return 6.0; // swimming, general
  const secPer100m = 360 / speed; // km/h → s per 100 m
  if (secPer100m > 150) return 5.8; // freestyle, slow
  if (secPer100m > 120) return 8.3; // crawl, medium
  return 9.8; // freestyle, fast
}

/**
 * MET value of one cardio effort. Speed-driven where the activity has a
 * meaningful speed, effort-driven on machines whose distance means little.
 */
export function cardioMet(activity: CardioActivity, input: MetInput = {}): number {
  const kmh = input.speedKmh;
  const grade = gradeOf(input);
  switch (activity) {
    case 'run':
      return valid(kmh) ? acsmRunningMet(kmh, grade) : 9.8;
    case 'treadmill':
      if (!valid(kmh)) return 9.0;
      return kmh < TREADMILL_WALK_MAX_KMH ? acsmWalkingMet(kmh, grade) : acsmRunningMet(kmh, grade);
    case 'walk':
      return valid(kmh) ? acsmWalkingMet(kmh, grade) : 3.5;
    case 'hike':
      // Off-road walking costs more than the treadmill equation says; the
      // Compendium's general hiking value is the floor once terrain is unknown.
      return valid(kmh) ? Math.max(acsmWalkingMet(kmh, grade), grade > 0 ? 4.5 : 6.0) : 6.0;
    case 'cycle':
      return cyclingMet(kmh);
    case 'indoor_cycle':
      return byEffort(input.effort, 3.5, 6.8, 8.8, 11.0);
    case 'row':
      return byEffort(input.effort, 3.5, 6.0, 7.5, 12.0);
    case 'elliptical':
      return byEffort(input.effort, 4.0, 5.0, 7.0, 9.0);
    case 'stairs':
      return 9.0;
    case 'swim':
      return swimmingMet(kmh);
    case 'jump_rope':
      return byEffort(input.effort, 8.8, 11.8, 12.3, 12.3);
    case 'hiit':
      return byEffort(input.effort, 7.0, 8.0, 11.0, 11.0);
    default:
      return byEffort(input.effort, 3.5, 5.5, 7.5, 10.0);
  }
}

export interface CardioCaloriesInput extends Omit<MetInput, 'speedKmh'> {
  activity: CardioActivity;
  durationSec: number | null | undefined;
  weightKg: number | null | undefined;
}

/**
 * Estimated kcal of one effort: MET × kg × hours, rounded. Null without a body
 * weight or a duration — a guess built on a guessed weight is not shown.
 */
export function estimateCardioCalories(input: CardioCaloriesInput): number | null {
  const { activity, durationSec, weightKg, distanceKm } = input;
  if (!valid(weightKg) || !valid(durationSec)) return null;
  const met = cardioMet(activity, { ...input, speedKmh: speedKmh(distanceKm, durationSec) });
  return Math.round(met * weightKg * (durationSec / 3600));
}

// ---------------------------------------------------------------------------
// Heart rate
// ---------------------------------------------------------------------------

/** Age-predicted maximum heart rate (Tanaka). Null for an implausible age. */
export function hrMaxFromAge(age: number | null | undefined): number | null {
  if (!valid(age) || age < 10 || age > 100) return null;
  return Math.round(208 - 0.7 * age);
}

export type HrZoneNumber = 1 | 2 | 3 | 4 | 5;

export interface HrZone {
  zone: HrZoneNumber;
  /** Lower bound, bpm (inclusive). */
  min: number;
  /** Upper bound, bpm (exclusive, except zone 5). */
  max: number;
}

const ZONE_FRACTIONS: readonly [number, number][] = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0],
];

/**
 * Five heart-rate zones. With a resting heart rate the bands are fractions of
 * heart-rate reserve (Karvonen), which fits trained people better.
 */
export function hrZones(hrMax: number, restingHr?: number | null): HrZone[] {
  const rest = valid(restingHr) && restingHr < hrMax ? restingHr : 0;
  const span = hrMax - rest;
  return ZONE_FRACTIONS.map(([lo, hi], i) => ({
    zone: (i + 1) as HrZoneNumber,
    min: Math.round(rest + lo * span),
    max: Math.round(rest + hi * span),
  }));
}

/** Zone of a heart rate, or null below zone 1 / without data. */
export function hrZoneOf(
  hr: number | null | undefined,
  zones: readonly HrZone[]
): HrZoneNumber | null {
  if (!valid(hr) || zones.length === 0) return null;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i] as HrZone;
    if (hr >= z.min) return z.zone;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Race estimate & load warning
// ---------------------------------------------------------------------------

/** Riegel's fatigue exponent. */
const RIEGEL_EXPONENT = 1.06;
/** Riegel is trusted from 1.5 km up to the half marathon. */
const RIEGEL_MIN_KM = 1.5;
const RIEGEL_MAX_KM = 21.1;

/**
 * Estimated time over `targetKm` from a known effort, or null outside the
 * range where the formula holds.
 */
export function predictRaceSec(knownSec: number, knownKm: number, targetKm: number): number | null {
  if (!valid(knownSec) || !valid(knownKm) || !valid(targetKm)) return null;
  const inRange = (km: number) => km >= RIEGEL_MIN_KM && km <= RIEGEL_MAX_KM;
  if (!inRange(knownKm) || !inRange(targetKm)) return null;
  return knownSec * (targetKm / knownKm) ** RIEGEL_EXPONENT;
}

/** A run longer than the 30-day longest by more than this fraction is a spike. */
export const LONG_RUN_SPIKE_THRESHOLD = 0.1;

/**
 * How much longer `distanceKm` is than `longestPrior30dKm`, as a fraction
 * (0.25 = 25% longer), when it crosses the spike threshold; otherwise null.
 * No prior run → no baseline → null.
 */
export function longRunSpike(distanceKm: number, longestPrior30dKm: number | null): number | null {
  if (!valid(distanceKm) || !valid(longestPrior30dKm)) return null;
  const over = distanceKm / longestPrior30dKm - 1;
  return over > LONG_RUN_SPIKE_THRESHOLD ? over : null;
}
