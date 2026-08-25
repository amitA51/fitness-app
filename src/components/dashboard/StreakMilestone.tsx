// StreakMilestone — Duolingo-style milestone celebration for the dashboard.
//
// Research (You.com, Oct 2026): Duolingo turns landmark day counts (7 / 30 /
// 100) into celebration moments; fitness apps (StepBet, StepsApp, Fitbit)
// mirror this with streak badges. The pattern that lands: when the streak
// CROSSES a milestone for the first time, show a one-shot celebratory card —
// ember particles + milestone label — instead of letting the number grow
// silently.
//
// One-shot semantics: the crossed milestone persists in localStorage
// (`streak_milestones_seen`), so the celebration fires exactly once per
// milestone per user. Reduced motion: static badge, no particles.
//
// RTL: the card is symmetric; no mirroring needed.

import { AnimatePresence, m } from 'framer-motion';
import { Flame } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWorkoutStreak } from '../../hooks/useWorkoutStreak';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

const SEEN_KEY = 'streak_milestones_seen';

/** Landmark day counts worth celebrating (Duolingo's 7/30/100 ladder). */
export const STREAK_MILESTONES = [7, 30, 100] as const;

export function milestoneFor(streakDays: number): number | null {
  const hit = STREAK_MILESTONES.filter((m) => streakDays >= m);
  return hit.length ? (hit[hit.length - 1] as number) : null;
}

function readSeen(): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function persistSeen(seen: number[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch (err) {
    logger.app.warn('Failed to persist streak milestones', err);
  }
}

interface StreakMilestoneProps {
  sessions: WorkoutSession[];
}

/**
 * Renders a one-shot celebration overlay-card when the current streak crosses
 * a milestone (7/30/100 days) that has never been celebrated before.
 * Self-dismisses after CELEBRATION_MS. Returns null in every other case, so
 * it can be dropped anywhere on the dashboard without layout cost.
 */
export const StreakMilestone = memo(function StreakMilestone({ sessions }: StreakMilestoneProps) {
  const { current, activeToday } = useWorkoutStreak(sessions);
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    // Only celebrate once the day is actually logged — crossing 7 yesterday
    // with today unlogged would celebrate a stale state.
    if (!activeToday || reduced) return;
    const milestone = milestoneFor(current);
    if (!milestone) return;

    const seen = readSeen();
    if (seen.includes(milestone)) return;

    persistSeen([...seen, milestone]);
    setShow(true);
    const timer = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(timer);
  }, [current, activeToday, reduced]);

  useEffect(() => {
    dismissedRef.current = true;
  }, []);

  if (!reduced && show) {
    return (
      <AnimatePresence>
        <m.div
          role="status"
          aria-label={`איזו יש! ${current} ימי אימון ברצף`}
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 18px',
            borderRadius: 'var(--radius-card)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--fs-accent) 16%, var(--fs-surface)), var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 38%, transparent)',
            boxShadow: '0 10px 34px color-mix(in srgb, var(--fs-accent) 20%, transparent)',
          }}
        >
          <m.span
            aria-hidden="true"
            animate={reduced ? undefined : { rotate: [-4, 4, -4], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: 9999,
              background: 'color-mix(in srgb, var(--fs-accent) 18%, transparent)',
              color: 'var(--fs-accent)',
            }}
          >
            <Flame size={26} strokeWidth={2.2} />
          </m.span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--fs-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              איזה רצף! {current} ימים
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                letterSpacing: '-0.01em',
              }}
            >
              {milestoneLabel(current)}
            </span>
          </div>
        </m.div>
      </AnimatePresence>
    );
  }

  return null;
});

function milestoneLabel(days: number): string {
  if (days >= 100) return 'מאה יום. זה כבר לא רצף — זה אורח חיים.';
  if (days >= 30) return 'חודש שלם של התמדה. הגוף כבר מרגיש את זה.';
  return 'שבוע שלם יום-יום. ההרגל נטוע.';
}

export default StreakMilestone;
