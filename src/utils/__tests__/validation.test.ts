import { describe, expect, it } from 'vitest';
import {
  WORKOUT_LIMITS,
  clampNumber,
  sanitizeText,
  validateProfileInput,
  validateRPE,
  validateReps,
  validateWeight,
} from '../validation';

describe('clampNumber', () => {
  it('returns the number when within range', () => {
    expect(clampNumber(5, 0, 10, 0)).toBe(5);
  });

  it('clamps to min when below range', () => {
    expect(clampNumber(-1, 0, 10, 0)).toBe(0);
  });

  it('clamps to max when above range', () => {
    expect(clampNumber(15, 0, 10, 0)).toBe(10);
  });

  it('returns boundary values exactly', () => {
    expect(clampNumber(0, 0, 10, 5)).toBe(0);
    expect(clampNumber(10, 0, 10, 5)).toBe(10);
  });

  it('parses numeric strings', () => {
    expect(clampNumber('7', 0, 10, 0)).toBe(7);
    expect(clampNumber('3.5', 0, 10, 0)).toBe(3.5);
  });

  it('returns fallback for NaN', () => {
    expect(clampNumber(Number.NaN, 0, 10, 5)).toBe(5);
  });

  it('returns fallback for Infinity', () => {
    expect(clampNumber(Number.POSITIVE_INFINITY, 0, 10, 5)).toBe(5);
    expect(clampNumber(Number.NEGATIVE_INFINITY, 0, 10, 5)).toBe(5);
  });

  it('returns fallback for undefined', () => {
    expect(clampNumber(undefined, 0, 10, 5)).toBe(5);
  });

  it('coerces null to 0 via Number(null)', () => {
    expect(clampNumber(null, 0, 10, 5)).toBe(0);
  });

  it('returns fallback for non-numeric string', () => {
    expect(clampNumber('abc', 0, 10, 5)).toBe(5);
  });

  it('returns fallback for empty string', () => {
    expect(clampNumber('', 0, 10, 5)).toBe(5);
  });

  it('handles string with leading number (parseFloat behavior)', () => {
    expect(clampNumber('3abc', 0, 10, 5)).toBe(3);
  });
});

describe('sanitizeText', () => {
  it('returns trimmed string', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('strips angle brackets', () => {
    expect(sanitizeText('<script>alert</script>')).toBe('scriptalert/script');
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeText(long)).toHaveLength(500);
  });

  it('respects custom maxLength', () => {
    expect(sanitizeText('abcdef', 3)).toBe('abc');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(123)).toBe('');
    expect(sanitizeText({})).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('preserves Hebrew text', () => {
    expect(sanitizeText('שלום עולם')).toBe('שלום עולם');
  });
});

describe('validateWeight', () => {
  it('returns valid weight as-is', () => {
    expect(validateWeight(80)).toBe(80);
  });

  it('clamps to 0 for negative', () => {
    expect(validateWeight(-5)).toBe(0);
  });

  it('clamps to 1000 for over-max', () => {
    expect(validateWeight(1500)).toBe(1000);
  });

  it('returns 0 for NaN', () => {
    expect(validateWeight(Number.NaN)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(validateWeight(undefined)).toBe(0);
  });

  it('accepts boundary values', () => {
    expect(validateWeight(0)).toBe(0);
    expect(validateWeight(1000)).toBe(1000);
  });

  it('parses string input', () => {
    expect(validateWeight('52.5')).toBe(52.5);
  });
});

describe('validateReps', () => {
  it('returns rounded integer for valid reps', () => {
    expect(validateReps(8)).toBe(8);
  });

  it('rounds fractional values', () => {
    expect(validateReps(5.7)).toBe(6);
    expect(validateReps(5.3)).toBe(5);
  });

  it('clamps to 0 for negative', () => {
    expect(validateReps(-3)).toBe(0);
  });

  it('clamps to 100 for over-max', () => {
    expect(validateReps(150)).toBe(100);
  });

  it('returns 0 for NaN', () => {
    expect(validateReps(Number.NaN)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(validateReps(undefined)).toBe(0);
  });

  it('accepts boundary values', () => {
    expect(validateReps(0)).toBe(0);
    expect(validateReps(100)).toBe(100);
  });
});

describe('validateRPE', () => {
  it('returns valid RPE value', () => {
    expect(validateRPE(7)).toBe(7);
  });

  it('returns null for invalid input (fallback 0 maps to null)', () => {
    expect(validateRPE(Number.NaN)).toBeNull();
    expect(validateRPE(undefined)).toBeNull();
  });

  it('clamps below-range values to min (1)', () => {
    expect(validateRPE(0)).toBe(1);
    expect(validateRPE(-5)).toBe(1);
  });

  it('clamps to max 10', () => {
    expect(validateRPE(15)).toBe(10);
  });

  it('accepts boundary values', () => {
    expect(validateRPE(1)).toBe(1);
    expect(validateRPE(10)).toBe(10);
  });

  it('parses string input', () => {
    expect(validateRPE('8')).toBe(8);
  });

  it('returns null for empty string', () => {
    expect(validateRPE('')).toBeNull();
  });
});

describe('validateProfileInput', () => {
  const validInput = { name: 'Test User', age: 30, weight: 75, height: 175 };

  it('returns valid profile unchanged (except rounding)', () => {
    const result = validateProfileInput(validInput);
    expect(result).toEqual({
      name: 'Test User',
      age: 30,
      weight: 75,
      height: 175,
    });
  });

  it('sanitizes name with max 100 chars', () => {
    const longName = 'a'.repeat(150);
    const result = validateProfileInput({ ...validInput, name: longName });
    expect(result.name).toHaveLength(100);
  });

  it('strips HTML from name', () => {
    const result = validateProfileInput({ ...validInput, name: '<b>Evil</b>' });
    expect(result.name).toBe('bEvil/b');
  });

  it('clamps age to 13-120 and rounds', () => {
    expect(validateProfileInput({ ...validInput, age: 10 }).age).toBe(13);
    expect(validateProfileInput({ ...validInput, age: 130 }).age).toBe(120);
    expect(validateProfileInput({ ...validInput, age: 25.7 }).age).toBe(26);
  });

  it('uses fallback 25 for invalid age', () => {
    expect(validateProfileInput({ ...validInput, age: undefined }).age).toBe(25);
    expect(validateProfileInput({ ...validInput, age: 'abc' }).age).toBe(25);
  });

  it('clamps weight to 20-300', () => {
    expect(validateProfileInput({ ...validInput, weight: 10 }).weight).toBe(20);
    expect(validateProfileInput({ ...validInput, weight: 400 }).weight).toBe(300);
  });

  it('uses fallback 70 for invalid weight', () => {
    expect(validateProfileInput({ ...validInput, weight: Number.NaN }).weight).toBe(70);
  });

  it('clamps height to 100-250 and rounds', () => {
    expect(validateProfileInput({ ...validInput, height: 50 }).height).toBe(100);
    expect(validateProfileInput({ ...validInput, height: 300 }).height).toBe(250);
    expect(validateProfileInput({ ...validInput, height: 175.6 }).height).toBe(176);
  });

  it('uses fallback 170 for invalid height', () => {
    expect(validateProfileInput({ ...validInput, height: undefined }).height).toBe(170);
  });

  it('handles completely empty input', () => {
    const result = validateProfileInput({});
    expect(result).toEqual({ name: '', age: 25, weight: 70, height: 170 });
  });
});

describe('WORKOUT_LIMITS', () => {
  it('has expected structure and values', () => {
    expect(WORKOUT_LIMITS.weight).toEqual({ min: 0, max: 1000 });
    expect(WORKOUT_LIMITS.reps).toEqual({ min: 0, max: 100 });
    expect(WORKOUT_LIMITS.rpe).toEqual({ min: 1, max: 10 });
    expect(WORKOUT_LIMITS.sets).toEqual({ min: 1, max: 20 });
    expect(WORKOUT_LIMITS.restSeconds).toEqual({ min: 0, max: 600 });
  });

  it('is typed Readonly (compile-time only, not frozen at runtime)', () => {
    expect(typeof WORKOUT_LIMITS).toBe('object');
    expect(Object.isFrozen(WORKOUT_LIMITS)).toBe(false);
  });
});
