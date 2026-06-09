// ============================================================================
// ChartSummary — summary-first lead-in above a trend chart.
// ============================================================================
// A mono kicker + a one-line Hebrew takeaway so each chart card LEADS with
// meaning instead of raw axes. The optional number is rendered LTR + tinted by
// the zone vocabulary (good=accent / neutral=muted / attention=warn) — never
// lime (--fs-signal is reserved for PR celebration). Pure presentational.

import type { ReactNode } from 'react';
import { type Zone, zoneColor } from '../../../utils/zoneColor';

interface ChartSummaryProps {
  /** Short mono uppercase label, e.g. "מגמת נפח · 14 אימונים". */
  kicker: string;
  /** The takeaway sentence — may embed <ChartSummaryNumber> for the figure. */
  children: ReactNode;
}

export function ChartSummary({ kicker, children }: ChartSummaryProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 4,
        }}
      >
        {kicker}
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--fs-ink)' }}>{children}</p>
    </div>
  );
}

/** The single tinted, LTR number inside a ChartSummary sentence. */
export function ChartSummaryNumber({ value, zone = 'neutral' }: { value: ReactNode; zone?: Zone }) {
  return (
    <span className="kinetic-number" dir="ltr" style={{ fontWeight: 700, color: zoneColor(zone) }}>
      {value}
    </span>
  );
}
