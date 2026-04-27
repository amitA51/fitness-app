// Unit conversion utilities for metric <-> imperial

export type UnitSystem = 'metric' | 'imperial';

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;
const CM_TO_INCHES = 0.393701;
const INCHES_TO_CM = 1 / CM_TO_INCHES;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function cmToInches(cm: number): number {
  return Math.round(cm * CM_TO_INCHES * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * INCHES_TO_CM * 10) / 10;
}

export function displayWeight(kg: number, system: UnitSystem): string {
  if (system === 'imperial') {
    return `${kgToLbs(kg)}`;
  }
  return `${kg}`;
}

export function weightUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'lbs' : 'ק״ג';
}

export function heightUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'ס״מ';
}

export function toDisplayWeight(kg: number, system: UnitSystem): number {
  return system === 'imperial' ? kgToLbs(kg) : kg;
}

export function toStorageWeight(displayWeight: number, system: UnitSystem): number {
  return system === 'imperial' ? lbsToKg(displayWeight) : displayWeight;
}
