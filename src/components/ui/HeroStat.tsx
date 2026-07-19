// ============================================================================
// HeroStat (C5) — one protagonist number per card.
// ============================================================================
// Numbers are heroes: the primary metric renders large in Bricolage display,
// LTR + tabular, with supporting metrics demoted to a mono label. Backs the
// dashboard headline, CoachBrief, weekly review, and WorkoutSummary stat grid.
// Pass an optional zone to tint the number (good/neutral/attention) — omit for
// the default ink color.

import type { ReactNode } from 'react';
import { type Zone, zoneColor } from '../../utils/zoneColor';

interface HeroStatProps {
  value: ReactNode;
  label: string;
  /** Small unit suffix (e.g. ק"ג, %). */
  unit?: string;
  zone?: Zone;
  /** Display font-size of the hero number in px. Default 40. */
  size?: number;
  align?: 'start' | 'center';
}

export function HeroStat({ value, label, unit, zone, size = 40, align = 'start' }: HeroStatProps) {
  const color = zone ? zoneColor(zone) : 'var(--fs-ink)';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span
          className="kinetic-number"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: Math.max(10, Math.round(size * 0.28)),
              fontWeight: 700,
              color: 'var(--fs-muted)',
            }}
          >
            {unit}
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
