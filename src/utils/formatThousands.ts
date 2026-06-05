// ============================================================================
// Pure number formatters (no GSAP dependency)
// ============================================================================
// Extracted from lib/gsap so modules that only need the formatter (e.g. the
// Dashboard landing chunk) don't drag the ~28KB GSAP bundle in with them.
// lib/gsap re-exports these for backwards compatibility.

/** Whole-number string, rounded. */
export const formatInt = (n: number): string => String(Math.round(n));

/** Thousands-separated whole number (e.g. 8140 → "8,140"). LTR-forced by callers. */
export const formatThousands = (n: number): string => Math.round(n).toLocaleString('en-US');

/**
 * Thousands-separated, keeping ONE decimal only when the value is fractional
 * (e.g. 8140 → "8,140", 12.5 → "12.5"). Used for volume so a half-kilo plate
 * isn't rounded up to a whole kilo ("13 ק״ג" for 12.5). LTR-forced by callers.
 */
export const formatThousandsDecimal = (n: number): string => {
  const isFractional = !Number.isInteger(n);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: isFractional ? 1 : 0,
    maximumFractionDigits: 1,
  });
};
