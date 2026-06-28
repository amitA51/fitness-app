import { describe, expect, it } from 'vitest';
import { regionsForMuscle, regionsForMuscles } from './muscleMapData';

describe('regionsForMuscle', () => {
  it('maps English catalog keys (case-insensitive)', () => {
    expect(regionsForMuscle('Chest')).toEqual(['chest']);
    expect(regionsForMuscle('chest')).toEqual(['chest']);
    expect(regionsForMuscle('SHOULDERS')).toEqual(['shoulders']);
  });

  it('fans broad groups out to multiple regions', () => {
    expect(regionsForMuscle('Legs')).toEqual(['quads', 'hamstrings', 'glutes', 'calves']);
    expect(regionsForMuscle('Back')).toEqual(['lats', 'lowerback', 'traps']);
    expect(regionsForMuscle('Arms')).toEqual(['biceps', 'triceps', 'forearms']);
  });

  it('maps granular secondary muscles', () => {
    expect(regionsForMuscle('Hamstrings')).toEqual(['hamstrings']);
    expect(regionsForMuscle('Glutes')).toEqual(['glutes']);
    expect(regionsForMuscle('Lower Back')).toEqual(['lowerback']);
    expect(regionsForMuscle('Soleus')).toEqual(['calves']);
    expect(regionsForMuscle('Traps')).toEqual(['traps']);
  });

  it('maps Hebrew labels (matching constants/muscleNames)', () => {
    expect(regionsForMuscle('חזה')).toEqual(['chest']);
    expect(regionsForMuscle('בטן')).toEqual(['abs', 'obliques']);
    expect(regionsForMuscle('יד אחורית')).toEqual(['triceps']);
  });

  it('returns [] for cardio, unknown, empty, and nullish', () => {
    expect(regionsForMuscle('Cardio')).toEqual([]);
    expect(regionsForMuscle('Telekinesis')).toEqual([]);
    expect(regionsForMuscle('')).toEqual([]);
    expect(regionsForMuscle(undefined)).toEqual([]);
    expect(regionsForMuscle(null)).toEqual([]);
  });
});

describe('regionsForMuscles', () => {
  it('collapses a list to a unique region set', () => {
    const set = regionsForMuscles(['Chest', 'Shoulders', 'Triceps']);
    expect([...set].sort()).toEqual(['chest', 'shoulders', 'triceps']);
  });

  it('dedupes overlapping regions and ignores unknowns/nullish', () => {
    const set = regionsForMuscles(['Legs', 'Quads', 'Calves', 'Cardio', undefined, '']);
    // Legs already covers quads+calves; no duplicates.
    expect([...set].sort()).toEqual(['calves', 'glutes', 'hamstrings', 'quads']);
  });
});
