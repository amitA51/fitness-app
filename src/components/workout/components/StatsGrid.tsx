// StatsGrid - Fresh Steel / Obsidian design language
// Data strips, Bricolage Grotesque typography, primary/surface/accent

import { HeroStat } from '@/components/ui/HeroStat';
import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { gsap, useGSAP } from '@/lib/gsap';
import { DUR, EASE } from '@/lib/motionTokens';
import { formatInt, formatThousandsDecimal } from '@/utils/formatThousands';
import { type Zone, zoneColor } from '@/utils/zoneColor';
import { m } from 'framer-motion';
import { Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
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
    const pct = Math.abs(change).toFixed(0);

    // The trend reads as a TINTED, DIRECTIONAL trend arrow + % + 'מול הקודם' —
    // deliberately a TrendingUp/Down (data-trend) glyph, never a plain
    // chevron, so it can't be misread as navigation. Color via the shared
    // zone vocabulary: up = good (mint), down = attention (warn), flat =
    // neutral (muted). Lime (--fs-signal) is reserved for true PRs and is NOT
    // used here. The whole cluster carries one Hebrew aria-label.
    const zone: Zone = isSame ? 'neutral' : isImprovement ? 'good' : 'attention';
    const trendColor = zoneColor(zone);
    const TrendIcon = isSame ? Minus : isImprovement ? TrendingUp : TrendingDown;
    const directionWord = isSame ? 'ללא שינוי' : isImprovement ? 'עלייה' : 'ירידה';
    const trendAria = isSame
      ? `${label}: ללא שינוי מול האימון הקודם`
      : `${label}: ${directionWord} של ${pct} אחוז מול האימון הקודם`;

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
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            {label}
          </div>
          <div
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
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
          aria-label={trendAria}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 999,
              background: `color-mix(in srgb, ${trendColor} 14%, transparent)`,
              color: trendColor,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <TrendIcon size={13} strokeWidth={2.75} aria-hidden="true" />
            <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {isSame ? '0%' : `${isImprovement ? '+' : '−'}${pct}%`}
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
            }}
          >
            מול הקודם
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

// Demoted supporting stat: ~24px display number over a mono uppercase label.
// One metric is the protagonist (HeroStat, below) and these three read clearly
// as secondary. Entrance is driven by the StatsGrid master timeline (scoped
// .js-stat-cell selector); the card renders at its final position and the
// timeline tweens it in.
const StatCard: React.FC<StatCardProps> = memo(
  ({ label, value, suffix, delay = 0, format = formatInt }) => {
    return (
      <div
        className="js-stat-cell"
        style={{
          padding: '12px 10px',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--fs-steel)',
          borderRadius: '16px 12px 16px 12px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 24,
            color: 'var(--fs-heading)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <CountUpValue value={value} suffix={suffix} delay={delay} format={format} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
            marginTop: 6,
          }}
        >
          {label}
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
    const heroNumRef = useRef<HTMLSpanElement>(null);

    // ONE metric is the protagonist. When the session earned PRs, the PR count
    // is the hero (mint, the win); otherwise total volume — the headline number
    // of any lift session — takes the throne. The other three drop to a demoted
    // strip below.
    const prCount = prsCount ?? 0;
    const heroIsPr = prCount > 0;
    const heroValue = heroIsPr ? prCount : totalVolume;
    const heroFormat = heroIsPr ? formatInt : formatThousandsDecimal;

    // Differentiated entrance: the hero settles FIRST with an overshoot
    // (back.out via EASE.pop), then the demoted cells stagger in after it lands.
    // Reduced motion: everything is already at its final state (guarded), and
    // useCountUp snaps the hero number — so the screen is instant + complete.
    const heroDelay = startDelay;
    const stripStart = startDelay + 0.28;
    useGSAP(
      () => {
        if (reduced) return; // cells + hero render at their final state already
        const hero = gridRef.current?.querySelector<HTMLElement>('.js-hero-cell');
        if (hero) {
          gsap.from(hero, {
            opacity: 0,
            y: 18,
            scale: 0.9,
            duration: DUR.base,
            ease: EASE.pop, // back.out overshoot — the protagonist lands with weight
            delay: heroDelay,
          });
        }
        const cells = gsap.utils.toArray<HTMLElement>('.js-stat-cell', gridRef.current);
        if (cells.length === 0) return;
        gsap.from(cells, {
          opacity: 0,
          y: 14,
          scale: 0.96,
          duration: DUR.base,
          ease: EASE.reveal,
          delay: stripStart,
          stagger: gsap.utils.distribute({ amount: 0.2, ease: EASE.out }),
        });
      },
      { scope: gridRef, dependencies: [reduced, startDelay, heroIsPr] }
    );

    // Hero number count-up trails its own (earlier) settle; the strip count-ups
    // trail the strip stagger so each number rolls as its card lands.
    useCountUp(heroNumRef, heroValue, {
      delay: heroDelay,
      duration: DUR.count,
      format: heroFormat,
      ease: heroIsPr ? EASE.pop : EASE.out,
    });
    const cellDelay = (i: number): number => stripStart + i * 0.08;

    return (
      <div className="flex flex-col gap-3" ref={gridRef}>
        {/* Hero protagonist — the single biggest number on the surface. PR count
            (mint) when earned, else total volume. */}
        {/* Hero sits on the neutral surface (not the navy --fs-primary fill) so
            HeroStat's --fs-muted label keeps AA in both modes — the mint number
            + accent glyph carry the personality. The accent border earns its
            weight on the protagonist, not as decoration on every card. */}
        <div
          className="js-hero-cell"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 20px',
            background: 'var(--fs-surface-2)',
            border: `2px solid ${heroIsPr ? 'var(--fs-accent)' : 'var(--fs-primary)'}`,
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <HeroStat
            value={
              <span ref={heroNumRef} dir="ltr">
                {heroFormat(heroValue)}
              </span>
            }
            label={heroIsPr ? 'שיאים חדשים' : 'נפח כולל'}
            unit={heroIsPr ? undefined : 'ק"ג'}
            zone={heroIsPr ? 'good' : undefined}
            size={56}
          />
          {heroIsPr ? (
            <Trophy
              size={40}
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            />
          ) : (
            <TrendingUp
              size={36}
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            />
          )}
        </div>

        {/* Demoted supporting strip — the other three metrics, ~24px + mono. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {heroIsPr ? (
            <StatCard
              label="נפח"
              value={totalVolume}
              suffix={' ק"ג'}
              delay={cellDelay(0)}
              format={formatThousandsDecimal}
            />
          ) : (
            <div
              className="js-stat-cell"
              style={{
                padding: '12px 10px',
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-steel)',
                borderRadius: '16px 12px 16px 12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: prCount > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span dir="ltr">{prCount}</span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  marginTop: 6,
                }}
              >
                שיאים
              </div>
            </div>
          )}
          <StatCard label="סטים" value={totalSets} delay={cellDelay(1)} />
          <StatCard label="משך" value={duration} suffix=" דק׳" delay={cellDelay(2)} />
        </div>

        {/* Comparison section */}
        {comparison && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
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
