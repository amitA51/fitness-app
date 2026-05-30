import { describe, expect, it } from 'vitest';
import { cmToInches, inchesToCm, kgToLbs, lbsToKg } from '../units';

describe('unit conversions', () => {
  it('converts kg <-> lbs and back within rounding tolerance', () => {
    expect(kgToLbs(100)).toBe(220.5);
    expect(lbsToKg(kgToLbs(100))).toBeCloseTo(100, 0);
  });

  it('converts cm <-> inches', () => {
    expect(cmToInches(180)).toBe(70.9);
    expect(inchesToCm(cmToInches(180))).toBeCloseTo(180, 0);
  });

  it('returns 0 for non-finite input instead of propagating NaN/Infinity', () => {
    expect(kgToLbs(Number.NaN)).toBe(0);
    expect(lbsToKg(Number.POSITIVE_INFINITY)).toBe(0);
    expect(cmToInches(Number.NaN)).toBe(0);
    expect(inchesToCm(Number.NaN)).toBe(0);
  });
});
