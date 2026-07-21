// ============================================================================
// strengthFormat — tiny display helpers shared by the strength list + detail.
// ============================================================================
// Presentational only (labels, relative dates). The numeric truth lives in
// progressMetrics; this just phrases it in natural, dugri Hebrew.

/** Strip the equipment/variant suffix ("Bench Press | Barbell" → "Bench Press"). */
export const exerciseLabel = (raw: string): string => raw.split('|')[0]?.trim() || raw;

/**
 * Relative "last trained" phrase in natural Hebrew, using the dual forms
 * (יומיים / שבועיים) Israelis actually say. Digits stay LTR-safe as lone
 * numbers inside the Hebrew run.
 */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 14) return 'לפני שבוע';
  if (days < 21) return 'לפני שבועיים';
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 45) return 'לפני חודש';
  if (days < 60) return 'לפני חודש וחצי';
  return `לפני ${Math.floor(days / 30)} חודשים`;
}
