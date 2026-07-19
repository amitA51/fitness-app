// ============================================================================
// VerdictLine (C3) — turns data into a stated takeaway ("so what").
// ============================================================================
// A mono kicker + a plain-Hebrew sentence whose driving number is rendered
// inline as a tinted .kinetic-number. Tone is carried ONLY by the number's
// zone color (good=accent / neutral=muted / attention=warn) — never lime
// (PR-celebration only). Used by Dashboard, Progress, weekly review, forecast.
// Sentences are supplied by callers (route copy through hebrew-content-writer).

import type { ReactNode } from 'react';
import { type Zone, zoneColor } from '../../utils/zoneColor';

interface VerdictLineProps {
  /** Short mono uppercase label, e.g. "סיכום השבוע". */
  kicker: string;
  /** The verdict sentence — compose with <VerdictNumber> for the driving figure. */
  children: ReactNode;
  className?: string;
}

export function VerdictLine({ kicker, children, className }: VerdictLineProps) {
  return (
    <div className={className}>
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
          marginBottom: 6,
        }}
      >
        {kicker}
      </span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--fs-ink)' }}>{children}</p>
    </div>
  );
}

interface VerdictNumberProps {
  value: ReactNode;
  zone?: Zone;
}

/** The single tinted, LTR number inside a VerdictLine sentence. */
export function VerdictNumber({ value, zone = 'good' }: VerdictNumberProps) {
  return (
    <span className="kinetic-number" dir="ltr" style={{ fontWeight: 600, color: zoneColor(zone) }}>
      {value}
    </span>
  );
}
