import { motion } from 'framer-motion';
// Extracted from WorkoutSummary.tsx
import type React from 'react';
import { memo, useMemo } from 'react';

const CONFETTI_COLORS = ['#a3e635', '#22d3ee', '#f43f5e', '#fbbf24', '#a855f7'];

// ============================================================
// CONFETTI CELEBRATION
// ============================================================

interface ConfettiProps {
  show: boolean;
}

export const Confetti: React.FC<ConfettiProps> = memo(({ show }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 2,
        size: 4 + Math.random() * 8,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      })),
    []
  );

  if (!show) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
          }}
          initial={{
            top: '-10%',
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            top: '110%',
            rotate: p.rotation * 3,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
});

Confetti.displayName = 'Confetti';

// ============================================================
// RPE COMPARISON
// ============================================================

export interface RPEDisplayProps {
  avgRpeActual: number | null;
  avgRpeTarget: number | null;
  delay?: number;
}

export const RPEDisplay: React.FC<RPEDisplayProps> = memo(
  ({ avgRpeActual, avgRpeTarget, delay = 0.45 }) => {
    if (avgRpeActual === null) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="premium-card p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
            מאמץ (RPE)
          </span>
          {avgRpeTarget !== null && (
            <span className="text-[10px] text-white/30">יעד: {avgRpeTarget}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-[800] text-white">{avgRpeActual}</span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  avgRpeActual <= 6
                    ? 'var(--color-success)'
                    : avgRpeActual <= 8
                      ? 'var(--fs-warn)'
                      : 'var(--color-error)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(avgRpeActual * 10, 100)}%` }}
              transition={{ duration: 1, delay: delay + 0.1 }}
            />
          </div>
          <span className="text-sm tabular-nums">{avgRpeActual.toFixed(1)}</span>
        </div>
        {avgRpeTarget !== null && (
          <p className="text-[10px] text-white/30 mt-2">
            {avgRpeActual < avgRpeTarget
              ? 'מתחת ליעד'
              : avgRpeActual > avgRpeTarget
                ? 'מעל היעד'
                : 'ביעד'}
          </p>
        )}
      </motion.div>
    );
  }
);

RPEDisplay.displayName = 'RPEDisplay';

// ============================================================
// PR HIGHLIGHTS SECTION
// ============================================================

interface PRHighlightsProps {
  prsCount?: number | null;
  avgRpeActual: number | null;
  avgRpeTarget: number | null;
  showConfetti: boolean;
}

export const PRHighlights: React.FC<PRHighlightsProps> = memo(
  ({ avgRpeActual, avgRpeTarget, showConfetti }) => {
    return (
      <>
        <Confetti show={showConfetti} />
        <RPEDisplay avgRpeActual={avgRpeActual} avgRpeTarget={avgRpeTarget} />
      </>
    );
  }
);

PRHighlights.displayName = 'PRHighlights';
