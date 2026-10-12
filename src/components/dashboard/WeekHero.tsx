// ============================================================================
// WeekThisWeekHero — the home screen's "how is my week going" block.
// ============================================================================
// One question per block: sessions completed this week as the largest type on
// the page, measured against an honest weekly target, plus at most ONE progress
// signal (volume vs the same point last week). Every value it prints comes from
// `homeStats`, and anything the history cannot support arrives as `null` and is
// omitted — no invented target, no percentage without a comparable week.
//
// Tokens only, both themes: ink for the numeral (hierarchy through size, not
// colour), mint --fs-accent reserved for the target bar and a positive signal.
// Lime --fs-signal is NOT used here — it belongs to PRs. No entrance motion: a
// number should be readable the instant the screen paints.

import { TrendingDown, TrendingUp } from 'lucide-react';
import { memo } from 'react';
import { UNIT_KM, formatKm } from '../../utils/cardio';

interface WeekHeroProps {
  /** Completed sessions in the current Sunday-based week. */
  sessions: number;
  /** Sessions/week to measure against, or null when history is too thin. */
  target: number | null;
  /** Signed % volume change vs the same point last week, or null. */
  volumeDeltaPct: number | null;
  /** Cardio kilometres this week; the line is omitted at 0. */
  distanceKm?: number;
}

export const WeekHero = memo(function WeekHero({
  sessions,
  target,
  volumeDeltaPct,
  distanceKm = 0,
}: WeekHeroProps) {
  const pct = target && target > 0 ? Math.min(100, Math.round((sessions / target) * 100)) : null;
  const up = (volumeDeltaPct ?? 0) >= 0;

  return (
    <section
      className="fs-surface-card-soft"
      aria-labelledby="week-hero-kicker"
      style={{ display: 'grid', gap: 12 }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span
          id="week-hero-kicker"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          השבוע
        </span>

        {volumeDeltaPct !== null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: up
                ? 'color-mix(in srgb, var(--fs-accent) 14%, transparent)'
                : 'var(--fs-surface-2)',
              color: up ? 'var(--fs-accent-2)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {up ? (
              <TrendingUp size={14} aria-hidden="true" />
            ) : (
              <TrendingDown size={14} aria-hidden="true" />
            )}
            <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {up ? '+' : ''}
              {volumeDeltaPct}%
            </span>
            <span className="sr-only">נפח לעומת אותה נקודה בשבוע שעבר</span>
          </span>
        )}
      </div>

      {/* The numeral is the largest thing on the page. Digits are bidi-isolated
          so "3 / 4" keeps its order inside the RTL column. */}
      <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          aria-hidden="true"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(44px, 14vw, 60px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--fs-ink)',
          }}
        >
          {sessions}
        </span>
        {target !== null && (
          <span
            aria-hidden="true"
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--fs-muted)',
            }}
          >
            / {target}
          </span>
        )}
        <span className="sr-only">
          {target !== null
            ? `${sessions} אימונים מתוך ${target} השבוע`
            : `${sessions} אימונים השבוע`}
          {distanceKm > 0 && `, ${formatKm(distanceKm)} ${UNIT_KM} של אירובי`}
        </span>
      </p>

      <p
        aria-hidden="true"
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
          lineHeight: 1.35,
        }}
      >
        {target !== null ? 'אימונים מתוך היעד השבועי' : 'אימונים הושלמו'}
        {distanceKm > 0 && (
          <>
            {' · '}
            <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {formatKm(distanceKm)}
            </span>{' '}
            {UNIT_KM}
          </>
        )}
      </p>

      {/* Target bar — fills from the reading start (right in RTL) because the
          track is a flex row, so direction mirrors it without a physical rule. */}
      {pct !== null && (
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            height: 6,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--fs-surface-2)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              width: `${pct}%`,
              background: 'var(--fs-accent)',
              borderRadius: 'var(--radius-pill)',
            }}
          />
        </span>
      )}
    </section>
  );
});

export default WeekHero;
