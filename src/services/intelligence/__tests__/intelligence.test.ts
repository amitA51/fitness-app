import { describe, expect, it } from 'vitest';
import { calculateRecoveryScore } from '../../bodyStatsService';
import { computeNutritionAdherence } from '../nutritionAdherence';
import { normalizeProfile } from '../profile';
import {
  FATIGUE_BANDS,
  readinessBandFromFatigue,
  recommendationFromFatigue,
} from '../scoringThresholds';

describe('scoringThresholds — readiness label and recommendation are aligned', () => {
  // The whole point of centralizing thresholds: a label can never disagree with
  // the recommendation (previously 'good' readiness could sit next to 'deload').
  const map: Record<string, string> = {
    high: 'push',
    good: 'maintain',
    moderate: 'deload',
    low: 'rest',
  };

  it('maps each readiness band 1:1 to exactly one recommendation across 0-100', () => {
    for (let fatigue = 0; fatigue <= 100; fatigue++) {
      const band = readinessBandFromFatigue(fatigue);
      const rec = recommendationFromFatigue(fatigue);
      expect(map[band]).toBe(rec);
    }
  });

  it('deloads at the shared 55 cut-point', () => {
    expect(recommendationFromFatigue(FATIGUE_BANDS.DELOAD)).toBe('deload');
    expect(recommendationFromFatigue(FATIGUE_BANDS.DELOAD - 1)).toBe('maintain');
  });
});

describe('nutritionAdherence — goal-aware, protein-inclusive (RN-2)', () => {
  const macros = (calories: number, protein: number) => ({
    calories,
    protein,
    carbs: 0,
    fat: 0,
  });

  it('does NOT treat over-eating as perfect (signed positive delta)', () => {
    const a = computeNutritionAdherence(macros(3000, 180), macros(2000, 150), 'maintain');
    expect(a?.calorieDeltaPercent).toBe(50); // +50%, not clamped to 0/100
    expect(a?.onTrack).toBe(false);
  });

  it('treats a deficit as on-track when the goal is to lose', () => {
    const a = computeNutritionAdherence(macros(1700, 150), macros(2000, 150), 'lose');
    expect(a?.calorieDeltaPercent).toBe(-15);
    expect(a?.onTrack).toBe(true);
  });

  it('fails onTrack on a protein shortfall even when calories are on target', () => {
    const a = computeNutritionAdherence(macros(2000, 90), macros(2000, 150), 'maintain');
    expect(a?.proteinAdherencePercent).toBe(60);
    expect(a?.onTrack).toBe(false);
  });

  it('returns null when there is no calorie goal', () => {
    expect(computeNutritionAdherence(macros(2000, 150), macros(0, 0), 'maintain')).toBeNull();
  });
});

describe('profile.normalizeProfile', () => {
  it('maps Hebrew weight goal to a direction and computes completeness', () => {
    const p = normalizeProfile(
      { age: 30, weight: 80, height: 180, gender: 'male', weightGoal: 'עלייה במסה' },
      { experienceLevel: 'intermediate', primaryGoal: 'muscle', equipment: 'gym' }
    );
    expect(p.weightDirection).toBe('gain');
    expect(p.experienceLevel).toBe('intermediate');
    expect(p.age).toBe(30);
    expect(p.weightKg).toBe(80);
    expect(p.completeness).toBe(1);
  });

  it('reports low completeness for an empty profile', () => {
    const p = normalizeProfile(null, null);
    expect(p.completeness).toBe(0);
    expect(p.weightDirection).toBeNull();
  });
});

describe('recovery score (RN-1) — true 0-100 range and input clamping', () => {
  const log = (overrides: Partial<Parameters<typeof calculateRecoveryScore>[0]>) =>
    calculateRecoveryScore({
      id: '',
      date: '2026-06-02',
      createdAt: '',
      sleepHours: 8,
      sleepQuality: 5,
      sorenessLevel: 5,
      energyLevel: 5,
      stressLevel: 5,
      tightAreas: [],
      ...overrides,
    });

  it('reaches the poor band on a worst-case day', () => {
    const worst = log({
      sleepHours: 4,
      sleepQuality: 1,
      sorenessLevel: 1,
      energyLevel: 1,
      stressLevel: 1,
    });
    expect(worst.overall).toBeLessThanOrEqual(25);
    expect(worst.label).toBe('poor');
  });

  it('reaches excellent on a best-case day', () => {
    const best = log({});
    expect(best.overall).toBeGreaterThan(90);
    expect(best.label).toBe('excellent');
  });

  it('clamps out-of-range synced data so no component exceeds 100', () => {
    // sorenessLevel 6 is impossible per the type but can arrive from sync.
    const clamped = log({ sorenessLevel: 6 as 5, sleepHours: 80 });
    expect(clamped.soreness).toBeLessThanOrEqual(100);
    expect(clamped.overall).toBeLessThanOrEqual(100);
    expect(clamped.overall).toBeGreaterThanOrEqual(0);
  });
});
