import { describe, expect, it } from 'vitest';
import { getExerciseImage, getExerciseImages } from './exerciseImages';

describe('exerciseImages', () => {
  it('resolves the English half of a bilingual "Hebrew | English" name', () => {
    const urls = getExerciseImages('בוקר טוב | Good Mornings');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/Good_Morning/0.jpg');
  });

  it('accepts a bare English name', () => {
    expect(getExerciseImage('Bench Press')).toContain(
      '/Barbell_Bench_Press_-_Medium_Grip/0.jpg'
    );
  });

  it('returns absolute jsDelivr CDN URLs', () => {
    const url = getExerciseImage('Deadlift');
    expect(url).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@main\/exercises\//
    );
  });

  it('returns [] / undefined for unmapped exercises', () => {
    expect(getExerciseImages('בולגריאן ספליט סקוואט | Bulgarian Split Squat')).toEqual([]);
    expect(getExerciseImage('Totally Made Up Movement')).toBeUndefined();
  });

  it('handles empty / nullish input', () => {
    expect(getExerciseImages('')).toEqual([]);
    expect(getExerciseImages(null)).toEqual([]);
    expect(getExerciseImages(undefined)).toEqual([]);
    expect(getExerciseImage(undefined)).toBeUndefined();
  });

  it('trims surrounding whitespace around the name', () => {
    expect(getExerciseImage('  Plank  ')).toContain('/Plank/0.jpg');
  });
});
