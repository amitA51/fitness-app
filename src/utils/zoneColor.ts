// ============================================================================
// zoneColor — the single 3-state semantic color vocabulary for status grading.
// ============================================================================
// Any "how good is this value" surface (consistency %, adherence, a status
// badge) maps onto exactly three zones so grading stays coherent app-wide:
//   good      → mint  (var(--fs-accent))  — on track / strong
//   neutral   → muted (var(--fs-muted))   — mid / acceptable, no opinion
//   attention → warn  (var(--fs-warn))    — below target / needs attention
//
// IMPORTANT: --fs-signal (lime) is intentionally NOT part of this scale. Lime
// is reserved exclusively for PR celebration; using it as a "mid/ok" grade is
// an anti-slop violation (see DESIGN.md). Mid-tier is muted, never lime.

export type Zone = 'good' | 'neutral' | 'attention';

/** Resolve a zone to its tokenized CSS color (always a `var(--fs-*)` string). */
export function zoneColor(zone: Zone): string {
  switch (zone) {
    case 'good':
      return 'var(--fs-accent)';
    case 'neutral':
      return 'var(--fs-muted)';
    case 'attention':
      return 'var(--fs-warn)';
  }
}

/**
 * Bucket a 0–100 percentage into a zone.
 * @param pct       the value to grade
 * @param goodAt    inclusive threshold for `good` (default 75)
 * @param neutralAt inclusive threshold for `neutral` (default 50); below it is `attention`
 */
export function pctToZone(pct: number, goodAt = 75, neutralAt = 50): Zone {
  if (pct >= goodAt) return 'good';
  if (pct >= neutralAt) return 'neutral';
  return 'attention';
}
