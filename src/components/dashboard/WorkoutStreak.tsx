import { memo, useRef } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { useWorkoutStreak } from '../../hooks/useWorkoutStreak';
import { DUR } from '../../lib/gsap';
import type { WorkoutSession } from '../../types';

interface WorkoutStreakProps {
  sessions: WorkoutSession[];
}

export const WorkoutStreak = memo(function WorkoutStreak({ sessions }: WorkoutStreakProps) {
  const streak = useWorkoutStreak(sessions);

  // Hooks MUST run before the early return below to preserve hook order.
  // Pure scalar count + scale pop -> direction-neutral, RTL-safe.
  const currentRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);

  // Hero "current" digit: count up from 0 with a back.out scale settle.
  useCountUp(currentRef, streak.current, { duration: DUR.base, pop: true });
  // "Best" digit: count up from 0, no pop.
  useCountUp(bestRef, streak.best, { duration: DUR.base });

  if (streak.current === 0) return null;

  return (
    <div
      role="status"
      aria-label={`רצף אימונים: ${streak.current} ימים`}
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        color: 'var(--fs-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ fontWeight: 600 }}>
        <span
          ref={currentRef}
          className="kinetic-number"
          style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}
        >
          {streak.current}
        </span>{' '}
        {streak.current === 1 ? 'יום' : 'ימים'}
      </span>
      <span style={{ color: 'var(--fs-steel)', fontSize: 10 }}>STREAK</span>
      {streak.activeToday && <span className="breathing-dot" aria-hidden />}
      {streak.best > streak.current && (
        <span style={{ marginInlineStart: 'auto', color: 'var(--fs-muted)', fontSize: 10 }}>
          BEST:{' '}
          <span
            ref={bestRef}
            className="kinetic-number"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {streak.best}
          </span>
        </span>
      )}
    </div>
  );
});
