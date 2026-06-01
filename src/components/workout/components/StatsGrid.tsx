// StatsGrid - Sport Annual Editorial Design
// Data strips, Big Shoulders typography, navy/bone/mustard

import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, formatInt, formatThousands, gsap, useGSAP } from '@/lib/gsap';
import { m } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import type React from 'react';
import { memo, useRef } from 'react';

export interface ComparisonData {
  prevVolume: number;
  prevDuration: number;
  prevSets: number;
  volumeChange: number;
  durationChange: number;
  setsChange: number;
}

// ============================================================
// COUNT-UP VALUE
// ----------------------------------------------------------------------------
// RAF-driven rolling number (useCountUp writes to textContent — no React
// re-render). Replaces the old setInterval AnimatedCounter which forced ~40
// re-renders per counter. The number span is dir="ltr" so the thousands
// separator never gets reordered by the surrounding RTL Hebrew, and the JSX
// renders the final value as the SSR / screen-reader fallback.
// ============================================================

interface CountUpValueProps {
  value: number;
  suffix?: string;
  delay?: number;
  format?: (value: number) => string;
}

const CountUpValue: React.FC<CountUpValueProps> = memo(
  ({ value, suffix = '', delay = 0, format = formatInt }) => {
    const ref = useRef<HTMLSpanElement>(null);
    useCountUp(ref, value, { delay, format, ease: EASE.out });

    return (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span ref={ref} dir="ltr">
          {format(value)}
        </span>
        {suffix}
      </span>
    );
  }
);
CountUpValue.displayName = 'CountUpValue';

// ============================================================
// COMPARISON BADGE
// ============================================================

interface ComparisonBadgeProps {
  label: string;
  current: number;
  previous: number;
  unit?: string;
  isPositive?: boolean;
  delay?: number;
}

const ComparisonBadge: React.FC<ComparisonBadgeProps> = memo(
  ({ label, current, previous, unit = '', isPositive = true, delay = 0 }) => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isImprovement = isPositive ? change > 0 : change < 0;
    const isSame = Math.abs(change) < 1;

    return (
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--fs-steel)',
          borderRadius: '22px 16px 22px 16px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          <div
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'start',
            }}
          >
            {current.toLocaleString()}
            {unit}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          <div
            style={{
              padding: '2px 8px',
              background: isSame
                ? 'var(--fs-surface-2)'
                : isImprovement
                  ? 'var(--fs-accent)'
                  : 'var(--color-error)',
              color: isSame ? 'var(--fs-muted)' : 'var(--fs-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.1em',
            }}
          >
            {isSame
              ? '≈'
              : isImprovement
                ? `+${Math.abs(change).toFixed(0)}%`
                : `-${Math.abs(change).toFixed(0)}%`}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
              direction: 'ltr',
            }}
          >
            {previous.toLocaleString()}
            {unit}
          </div>
        </div>
      </m.div>
    );
  }
);
ComparisonBadge.displayName = 'ComparisonBadge';

// ============================================================
// STAT CARD
// ============================================================

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  delay?: number;
  format?: (value: number) => string;
}

// Entrance is driven by the StatsGrid master timeline (scoped .js-stat-cell
// selector). The card renders at its final position; the timeline tweens it in.
const StatCard: React.FC<StatCardProps> = memo(
  ({ label, value, suffix, delay = 0, format = formatInt }) => {
    return (
      <div
        className="fs-accent-rail js-stat-cell"
        style={{
          padding: '16px',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--fs-steel)',
          borderRadius: '22px 16px 22px 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 36,
            color: 'var(--fs-heading)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <CountUpValue value={value} suffix={suffix} delay={delay} format={format} />
        </div>
      </div>
    );
  }
);
StatCard.displayName = 'StatCard';

// ============================================================
// STATS GRID
// ============================================================

export interface StatsGridProps {
  totalVolume: number;
  duration: number;
  totalSets: number;
  prsCount: number | null;
  comparison?: ComparisonData | null;
  /** Seconds to wait before the card stagger begins (after the headline lands). */
  startDelay?: number;
}

export const StatsGrid: React.FC<StatsGridProps> = memo(
  ({ totalVolume, duration, totalSets, prsCount, comparison, startDelay = 0 }) => {
    const reduced = useReducedMotion();
    const gridRef = useRef<HTMLDivElement>(null);

    // Master entrance: stagger the four stat cells in. Vertical + scale only,
    // so it reads identically in RTL and LTR (no horizontal mirroring needed).
    // The per-cell count-ups run via useCountUp with matching delays so the
    // number rolls as its card settles.
    useGSAP(
      () => {
        if (reduced) return; // cells render at their final state already
        const cells = gsap.utils.toArray<HTMLElement>('.js-stat-cell', gridRef.current);
        if (cells.length === 0) return;
        gsap.from(cells, {
          opacity: 0,
          y: 16,
          scale: 0.96,
          duration: DUR.base,
          ease: EASE.reveal,
          delay: startDelay,
          stagger: gsap.utils.distribute({ amount: 0.24, ease: EASE.out }),
        });
      },
      { scope: gridRef, dependencies: [reduced, startDelay] }
    );

    // Count-up delays trail the card stagger so each number rolls as it lands.
    const cellDelay = (i: number): number => startDelay + i * 0.08;

    return (
      <div className="flex flex-col gap-3" ref={gridRef}>
        {/* Main 2x2 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '2px solid var(--fs-primary)',
          }}
        >
          <StatCard
            label="נפח"
            value={totalVolume}
            suffix={' ק"ג'}
            delay={cellDelay(0)}
            format={formatThousands}
          />
          <div
            className="js-stat-cell"
            style={{
              padding: '16px',
              background: 'var(--fs-primary)',
              borderInlineStart: '2px solid var(--fs-primary)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.22em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              שיאים
            </div>
            {/* PR count is the hero number in the WorkoutSummary headline, where
                it counts up. Here it renders static (snap) to avoid
                double-animating the same number across the two surfaces. */}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 36,
                color: prsCount && prsCount > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {prsCount ?? 0}
            </div>
          </div>
          <StatCard label="סטים" value={totalSets} delay={cellDelay(2)} />
          <StatCard label="משך" value={duration} suffix=" דק׳" delay={cellDelay(3)} />
        </div>

        {/* Comparison section */}
        {comparison && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TrendingUp size={12} strokeWidth={2.5} style={{ color: 'var(--fs-accent)' }} />
              בהשוואה לאימון הקודם
            </div>
            <div className="flex flex-col gap-2">
              <ComparisonBadge
                label="נפח"
                current={totalVolume}
                previous={comparison.prevVolume}
                unit={' ק"ג'}
                isPositive={true}
                delay={0.3}
              />
              <ComparisonBadge
                label="משך"
                current={duration}
                previous={comparison.prevDuration}
                unit=" דק׳"
                isPositive={true}
                delay={0.35}
              />
              <ComparisonBadge
                label="סטים"
                current={totalSets}
                previous={comparison.prevSets}
                isPositive={true}
                delay={0.4}
              />
            </div>
          </m.div>
        )}
      </div>
    );
  }
);

StatsGrid.displayName = 'StatsGrid';
