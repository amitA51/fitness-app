import { m } from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWorkoutStreak } from '../../hooks/useWorkoutStreak';
import { DUR, FRAMER_EASE } from '../../lib/motionTokens';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

interface WorkoutStreakProps {
  sessions: WorkoutSession[];
}

const LAST_SEEN_STREAK_KEY = 'fitness_last_seen_streak';
const NO_GLOW = 'drop-shadow(0 0 0 transparent)';

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
  const reduced = useReducedMotion();
  const currentRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);

  const lastSeenRef = useRef<number>(readLastSeenStreak());
  const shouldAnimate = streak.current > lastSeenRef.current;
  const glowEnabled = shouldAnimate && !reduced;

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
        <m.span
          // The former GSAP tween started after the 0.6s count, glowed for one
          // DUR.base pass, then yoyoed out for another. This key intentionally
          // replays that same one-shot only when a new streak is earned.
          key={`${streak.current}-${glowEnabled ? 'glow' : 'still'}`}
          initial={glowEnabled ? { filter: NO_GLOW } : false}
          animate={
            glowEnabled
              ? {
                  filter: [
                    NO_GLOW,
                    'drop-shadow(0 0 10px color-mix(in srgb, var(--fs-accent) 70%, transparent))',
                    NO_GLOW,
                  ],
                }
              : { filter: NO_GLOW }
          }
          transition={
            glowEnabled
              ? {
                  duration: DUR.base * 2,
                  delay: DUR.base,
                  ease: FRAMER_EASE.out,
                  times: [0, 0.5, 1],
                }
              : { duration: 0 }
          }
          style={{ display: 'inline-block' }}
        >
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
        </m.span>
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
