import { describe, expect, it } from 'vitest';
import { HE_NOUNS, pluralizeHe } from './pluralizeHe';

describe('pluralizeHe', () => {
  it('uses the masculine singular form with its count word for 1', () => {
    expect(pluralizeHe(1, HE_NOUNS.exercise)).toBe('תרגיל אחד');
  });

  it('uses the plural form with the numeral for counts other than 1', () => {
    expect(pluralizeHe(3, HE_NOUNS.exercise)).toBe('3 תרגילים');
    expect(pluralizeHe(0, HE_NOUNS.exercise)).toBe('0 תרגילים');
  });

  describe('feminine measurement noun', () => {
    it("reads 'מדידה אחת' (feminine oneWord), not 'מדידה אחד', for a count of 1", () => {
      expect(pluralizeHe(1, HE_NOUNS.measurement)).toBe('מדידה אחת');
    });

    it("reads '{n} מדידות' for counts other than 1", () => {
      expect(pluralizeHe(2, HE_NOUNS.measurement)).toBe('2 מדידות');
      expect(pluralizeHe(7, HE_NOUNS.measurement)).toBe('7 מדידות');
    });
  });

  describe('workout noun', () => {
    it("reads 'אימון אחד' for a count of 1", () => {
      expect(pluralizeHe(1, HE_NOUNS.workout)).toBe('אימון אחד');
    });

    it("reads '{n} אימונים' for counts other than 1", () => {
      expect(pluralizeHe(4, HE_NOUNS.workout)).toBe('4 אימונים');
    });
  });
});
