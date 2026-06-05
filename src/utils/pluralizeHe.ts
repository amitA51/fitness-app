// ============================================================================
// pluralizeHe — Hebrew count + noun with correct singular/plural agreement.
// ============================================================================
// Hebrew, unlike English, keeps the noun SINGULAR for a cardinal of 1
// ("תרגיל אחד", not "1 תרגילים"). This is the single source of truth for the
// count-label pattern that was hardcoded as `{n} <plural-noun>` across the
// workout surfaces. Mirrors the existing day-pluralization in WorkoutStreak.

interface HeNounForms {
  /** Singular form, e.g. 'תרגיל'. */
  one: string;
  /** Plural form, e.g. 'תרגילים'. */
  many: string;
  /** Word for "one" agreeing with the noun's gender. Default 'אחד' (masc.). */
  oneWord?: string;
}

/** Common workout nouns, declared once so callers don't re-spell them. */
export const HE_NOUNS = {
  exercise: { one: 'תרגיל', many: 'תרגילים', oneWord: 'אחד' },
  set: { one: 'סט', many: 'סטים', oneWord: 'אחד' },
  week: { one: 'שבוע', many: 'שבועות', oneWord: 'אחד' },
  day: { one: 'יום', many: 'ימים', oneWord: 'אחד' },
} as const satisfies Record<string, HeNounForms>;

/**
 * Format a count with its Hebrew noun, agreeing for singular vs plural.
 *
 * - `pluralizeHe(1, HE_NOUNS.exercise)` → "תרגיל אחד"
 * - `pluralizeHe(3, HE_NOUNS.exercise)` → "3 תרגילים"
 *
 * For 1 the count word ("אחד") follows the noun (natural Hebrew); for any other
 * value the numeral precedes the plural noun.
 */
export const pluralizeHe = (count: number, noun: HeNounForms): string => {
  if (count === 1) return `${noun.one} ${noun.oneWord ?? 'אחד'}`;
  return `${count} ${noun.many}`;
};
