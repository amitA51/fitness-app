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

// Persisted across dashboard visits so the count-up only celebrates real
// growth. Reading a stale or missing value just animates from 0 — safe default.
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

  // Hooks MUST run before the early return below to preserve hook order.
  // Pure scalar count + scale pop -> direction-neutral, RTL-safe.
  const currentRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);

  // Only animate the streak when it actually GREW since the last dashboard
  // visit. Re-celebrating a static streak on every mount cheapens the moment,
  // so a non-increasing value snaps to its final number instead.
  // Captured once on mount (not reactive) so the very first render decides.
  const lastSeenRef = useRef<number>(readLastSeenStreak());
  const shouldAnimate = streak.current > lastSeenRef.current;

  // Persist the freshly shown value so the next visit measures growth against
  // it. Best-effort: a storage failure only means we may re-animate next time.
  useEffect(() => {
    if (streak.current <= 0) return;
    try {
      localStorage.setItem(LAST_SEEN_STREAK_KEY, String(streak.current));
    } catch (err) {
      logger.app.warn('Failed to persist last-seen streak', err);
    }
  }, [streak.current]);

  // Hero "current" digit: count up from 0 with a back.out scale settle — but
  // only when the streak grew; otherwise render the number statically.
  useCountUp(currentRef, streak.current, {
    duration: DUR.base,
    pop: true,
    enabled: shouldAnimate,
  });
  // "Best" digit: count up from 0, no pop. Mirrors the current-digit gating so
  // a static streak doesn't re-roll the best number either.
  useCountUp(bestRef, streak.best, { duration: DUR.base, enabled: shouldAnimate });

  // One-shot accent glow on the hero number the moment the streak grows. Fires
  // once after the count settles, then clears. Reduced-motion: never runs (the
  // number simply sits at its final value).
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
      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span
          ref={currentRef}
          className="kinetic-number"
          dir="ltr"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-display)',
            // Hero streak digit — dominant over the surrounding mono label.
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {streak.current}
        </span>{' '}
        {streak.current === 1 ? 'יום' : 'ימים'}
      </span>
      <span style={{ color: 'var(--fs-muted)', fontSize: 10 }}>רצף</span>
      {streak.activeToday && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--fs-accent)',
          }}
        />
      )}
      {streak.best > streak.current && (
        <span style={{ marginInlineStart: 'auto', color: 'var(--fs-muted)', fontSize: 10 }}>
          שיא:{' '}
          <span
            ref={bestRef}
            className="kinetic-number"
            dir="ltr"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {streak.best}
          </span>
        </span>
      )}
    </div>
  );
});
