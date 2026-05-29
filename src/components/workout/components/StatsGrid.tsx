// StatsGrid - Sport Annual Editorial Design
// Data strips, Big Shoulders typography, navy/bone/mustard

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import type React from 'react';
import { memo, useEffect, useState } from 'react';

export interface ComparisonData {
  prevVolume: number;
  prevDuration: number;
  prevSets: number;
  volumeChange: number;
  durationChange: number;
  setsChange: number;
}

// ============================================================
// ANIMATED COUNTER
// ============================================================

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  duration?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = memo(
  ({ value, suffix = '', duration = 1200 }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      const steps = 40;
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - (1 - progress) ** 3;
        if (step >= steps) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(value * eased));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }, [value, duration]);

    return (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {displayValue.toLocaleString()}
        {suffix}
      </span>
    );
  }
);
AnimatedCounter.displayName = 'AnimatedCounter';

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
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
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
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
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
      </motion.div>
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
}

const StatCard: React.FC<StatCardProps> = memo(({ label, value, suffix, delay = 0 }) => {
  return (
    <motion.div
      className="fs-accent-rail"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
        <AnimatedCounter value={value} suffix={suffix} />
      </div>
    </motion.div>
  );
});
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
}

export const StatsGrid: React.FC<StatsGridProps> = memo(
  ({ totalVolume, duration, totalSets, prsCount, comparison }) => {
    return (
      <div className="flex flex-col gap-3">
        {/* Main 2x2 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '2px solid var(--fs-primary)',
          }}
        >
          <StatCard label="נפח" value={totalVolume} suffix={' ק"ג'} delay={0.05} />
          <div
            style={{
              padding: '16px',
              background: 'var(--fs-primary)',
              borderLeft: '2px solid var(--fs-primary)',
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
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
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
            </motion.div>
          </div>
          <StatCard label="סטים" value={totalSets} delay={0.1} />
          <StatCard label="משך" value={duration} suffix=" דק׳" delay={0.15} />
        </div>

        {/* Comparison section */}
        {comparison && (
          <motion.div
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
          </motion.div>
        )}
      </div>
    );
  }
);

StatsGrid.displayName = 'StatsGrid';
