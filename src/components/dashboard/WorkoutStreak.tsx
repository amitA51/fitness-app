import { memo, useEffect, useRef } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWorkoutStreak } from '../../hooks/useWorkoutStreak';
import { DUR, EASE, gsap, useGSAP } from '../../lib/gsap';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

interface WorkoutStreakProps {
  sessions: WorkoutSession[];
}

const LAST_SEEN_STREAK_KEY = 'fitness_last_seen_streak';

const readLastSeenStreak = (): number => {
  try {
    const raw = localStorage.getItem(LAST_SEEN_STREAK_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (err) {
    logger.app.warn('Failed to read last-seen streak', err);
    return 0;
  }
};

export const WorkoutStreak = memo(function WorkoutStreak({ sessions }: WorkoutStreakProps) {
  const streak = useWorkoutStreak(sessions);

  const currentRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);

  const lastSeenRef = useRef<number>(readLastSeenStreak());
  const shouldAnimate = streak.current > lastSeenRef.current;

  useEffect(() => {
    if (streak.current <= 0) return;
    try {
      localStorage.setItem(LAST_SEEN_STREAK_KEY, String(streak.current));
    } catch (err) {
      logger.app.warn('Failed to persist last-seen streak', err);
    }
  }, [streak.current]);

  useCountUp(currentRef, streak.current, {
    duration: DUR.base,
    pop: true,
    enabled: shouldAnimate,
  });
  useCountUp(bestRef, streak.best, { duration: DUR.base, enabled: shouldAnimate });

  const reduced = useReducedMotion();
  useGSAP(
    () => {
      const el = currentRef.current;
      if (!el || reduced || !shouldAnimate) return;
      gsap.fromTo(
        el,
        { filter: 'drop-shadow(0 0 0 transparent)' },
        {
          filter: 'drop-shadow(0 0 10px color-mix(in srgb, var(--fs-accent) 70%, transparent))',
          duration: DUR.base,
          delay: DUR.base,
          ease: EASE.out,
          yoyo: true,
          repeat: 1,
          onComplete: () => gsap.set(el, { clearProps: 'filter' }),
        }
      );
    },
    { dependencies: [shouldAnimate, reduced], scope: currentRef }
  );

  if (streak.current === 0) return null;

  return (
    <div
      role="status"
      aria-label={`רצף אימונים: ${streak.current} ימים`}
      className="fs-surface-card-soft"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        color: 'var(--fs-ink)',
      }}
    >
      <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span
          ref={currentRef}
          className="kinetic-number"
          dir="ltr"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px, 5vw, 28px)',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--fs-accent)',
          }}
        >
          {streak.current}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {streak.current === 1 ? 'יום ברצף' : 'ימים ברצף'}
        </span>
      </span>
      {streak.activeToday && (
        <span
          aria-label="פעיל היום"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginInlineStart: 4,
            padding: '4px 10px',
            borderRadius: 9999,
            background: 'color-mix(in srgb, var(--fs-accent) 14%, transparent)',
            color: 'var(--fs-accent-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--fs-accent)',
            }}
          />
          היום
        </span>
      )}
      {streak.best > streak.current && (
        <span
          style={{
            marginInlineStart: 'auto',
            color: 'var(--fs-muted)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            letterSpacing: '-0.01em',
          }}
        >
          שיא{' '}
          <span
            ref={bestRef}
            className="kinetic-number"
            dir="ltr"
            style={{ fontWeight: 600, color: 'var(--fs-ink)' }}
          >
            {streak.best}
          </span>
        </span>
      )}
    </div>
  );
});

export default WorkoutStreak;
