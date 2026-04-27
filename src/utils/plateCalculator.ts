import type { Exercise } from '../types';

export const DEFAULT_BAR_WEIGHT_KG = 20;
export const DEFAULT_METRIC_PLATES_KG = [20, 15, 10, 5, 2.5, 1.25] as const;

const DECIMAL_PRECISION = 100;
const EPSILON = 0.0001;

export interface PlateLoadOptions {
  barWeight?: number;
  availablePlates?: readonly number[];
}

export interface PlateLoadResult {
  barWeight: number;
  isExact: boolean;
  loadedWeight: number;
  platesPerSide: number[];
  remainderKg: number;
  targetWeight: number;
}

const roundKg = (value: number): number =>
  Math.round(value * DECIMAL_PRECISION) / DECIMAL_PRECISION;

const normalizePlates = (plates: readonly number[]): number[] => {
  return [...new Set(plates.filter((plate) => Number.isFinite(plate) && plate > 0))]
    .sort((a, b) => b - a)
    .map(roundKg);
};

export function calculateBarbellPlateLoad(
  targetWeight: number,
  options: PlateLoadOptions = {}
): PlateLoadResult | null {
  const barWeight = options.barWeight ?? DEFAULT_BAR_WEIGHT_KG;
  const availablePlates = normalizePlates(options.availablePlates ?? DEFAULT_METRIC_PLATES_KG);

  if (
    !Number.isFinite(targetWeight) ||
    !Number.isFinite(barWeight) ||
    targetWeight <= barWeight ||
    availablePlates.length === 0
  ) {
    return null;
  }

  let remainingPerSide = roundKg((targetWeight - barWeight) / 2);
  const platesPerSide: number[] = [];

  for (const plate of availablePlates) {
    while (remainingPerSide + EPSILON >= plate) {
      platesPerSide.push(plate);
      remainingPerSide = roundKg(remainingPerSide - plate);
    }
  }

  const loadedPerSide = roundKg(platesPerSide.reduce((sum, plate) => sum + plate, 0));
  const loadedWeight = roundKg(barWeight + loadedPerSide * 2);
  const remainderKg = roundKg(targetWeight - loadedWeight);

  return {
    barWeight: roundKg(barWeight),
    isExact: Math.abs(remainderKg) < EPSILON,
    loadedWeight,
    platesPerSide,
    remainderKg,
    targetWeight: roundKg(targetWeight),
  };
}

export function formatPlateLoad(load: PlateLoadResult | null): string | null {
  if (!load || load.platesPerSide.length === 0) {
    return null;
  }

  const plates = load.platesPerSide.map((plate) => String(plate)).join(' + ');

  if (load.isExact) {
    return `${plates} כל צד`;
  }

  return `${plates} כל צד · בפועל ${load.loadedWeight} ק״ג`;
}

export function isBarbellExercise(exercise: Pick<Exercise, 'equipment' | 'name'>): boolean {
  const equipment = exercise.equipment?.toLowerCase() ?? '';

  if (equipment.includes('dumbbell')) {
    return false;
  }

  if (equipment.includes('barbell')) {
    return true;
  }

  const name = exercise.name?.toLowerCase() ?? '';
  return /\b(bench press|squat|deadlift|barbell)\b/.test(name) || name.includes('מוט');
}
