// useSwipeNavigation - Horizontal pointer-swipe navigation between exercises.
// Extracted from ActiveWorkoutNew. RTL-aware and ignores gestures that start on
// interactive targets (buttons, inputs, sliders, [data-no-swipe]). Owns the
// gesture-start ref internally; the component spreads the returned pointer
// handlers onto the swipe surface and supplies the change-exercise callback.
//
// The surface FOLLOWS THE FINGER. The move handler used to be a deliberate no-op
// ("we decide on pointerup"), so a 70px drag moved nothing and the user got a
// binary yes/no only on release. Feedback has to be continuous DURING a gesture,
// so the handler now translates the surface it is attached to and the release
// commits from a PROJECTED resting point rather than the raw release position.
//
// Two details this hook owns, because it is attached from a component it does not
// own (ActiveWorkoutNew): the transform is written imperatively onto the element
// the handlers were spread on, and the swipe surface already carries
// `touch-action: pan-y` (ActiveWorkoutNew.tsx), so vertical scrolling still works
// and horizontal tracking never has to cancel it.
import { type AnimationPlaybackControls, animate } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { triggerHaptic } from '../../../utils/haptics';

// Gesture thresholds — a swipe must move far enough horizontally and stay
// roughly horizontal to count as an exercise change.
const MIN_DX = 70;
const MAX_DY = 40;
// Only the untracked path (reduced motion) still needs a time gate: without
// continuous feedback a slow drag is indistinguishable from an aborted one. On
// the tracked path distance plus projected momentum decides, so a deliberate
// long drag commits instead of silently snapping back.
const MAX_DURATION = 400;

// Travel before the gesture claims an axis. Below this the pointer could still
// be the start of a vertical scroll, so nothing moves horizontally yet.
const AXIS_LOCK_PX = 8;
// At the first / last exercise there is nothing to move to: the surface still
// answers the finger, but damped, so the boundary is felt rather than silent.
const EDGE_RESISTANCE = 0.3;
// 1:1 up to this fraction of the surface width, then heavy resistance — a dead
// stop under a moving finger is the failure this avoids.
const FOLLOW_CAP_RATIO = 0.45;
const FOLLOW_PAST_CAP = 0.2;

// Momentum projection (Apple's decelerating-scroll model): a flick is credited
// with where it WOULD come to rest, not where the finger happened to lift.
// d / (1 - d) for d = 0.998 → 499ms, expressed in seconds so it pairs with a
// velocity in px/s.
const PROJECTION_S = 0.499;
// Samples older than this do not describe the release any more.
const VELOCITY_WINDOW_MS = 100;
// A finger that came to rest before lifting carries no momentum — the gesture
// was abandoned, not thrown.
const STALE_RELEASE_MS = 80;

interface UseSwipeNavigationParams {
  currentExerciseIndex: number;
  exercisesLength: number;
  onChangeExercise: (idx: number) => void;
}

interface UseSwipeNavigationReturn {
  handleSwipePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleSwipePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleSwipePointerEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface SwipeStart {
  x: number;
  y: number;
  t: number;
  id: number;
  el: HTMLDivElement;
  /** null until the gesture commits to an axis. 'y' = hands off to scrolling. */
  axis: 'x' | 'y' | null;
  /** Live translate at grab time, so a re-grab mid-return does not jump. */
  from: number;
}

/**
 * Provides pointer handlers for swiping between exercises.
 *
 * The surface tracks the finger during the gesture; the release commits from a
 * projected resting point and springs the surface home.
 */
export function useSwipeNavigation({
  currentExerciseIndex,
  exercisesLength,
  onChangeExercise,
}: UseSwipeNavigationParams): UseSwipeNavigationReturn {
  const swipeStartRef = useRef<SwipeStart | null>(null);
  // Finger-space position samples (dx, timestamp) used to derive release velocity.
  const samplesRef = useRef<{ dx: number; t: number }[]>([]);
  // The translate currently ON SCREEN. Every animation starts from this
  // presentation value, never from the target.
  const followRef = useRef(0);
  const returnAnimRef = useRef<AnimationPlaybackControls | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const applyFollow = useCallback((el: HTMLDivElement, px: number) => {
    followRef.current = px;
    if (px === 0) {
      el.style.transform = '';
      el.style.willChange = '';
      return;
    }
    // Physical translate driven by a physical finger delta — correct in both
    // directions. RTL flips which exercise the gesture MEANS, not which way the
    // finger pushed; that mapping is handled at commit time.
    el.style.transform = `translateX(${px}px)`;
  }, []);

  const stopReturn = useCallback(() => {
    returnAnimRef.current?.stop();
    returnAnimRef.current = null;
  }, []);

  /** Spring the surface back to rest from wherever it is right now. */
  const settle = useCallback(
    (el: HTMLDivElement, velocity: number, earned: boolean) => {
      stopReturn();
      if (prefersReducedMotion || followRef.current === 0) {
        applyFollow(el, 0);
        return;
      }
      returnAnimRef.current = animate(followRef.current, 0, {
        type: 'spring',
        // Bounce is earned by momentum and never spent on a gesture that just
        // stopped. A committed swipe spends its momentum on the commit, so its
        // return is quiet too.
        ...(earned ? { bounce: 0.2, duration: 0.3, velocity } : { bounce: 0, duration: 0.35 }),
        onUpdate: (v) => applyFollow(el, v),
        onComplete: () => {
          applyFollow(el, 0);
          returnAnimRef.current = null;
        },
      });
    },
    [applyFollow, prefersReducedMotion, stopReturn]
  );

  /** Which exercise this horizontal delta would move to, and whether it exists. */
  const resolveTarget = useCallback(
    (dx: number) => {
      const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
      // In RTL: positive dx (swipe right) → previous exercise. LTR is inverse.
      const direction = dx > 0 ? (isRTL ? -1 : 1) : isRTL ? 1 : -1;
      const nextIndex = currentExerciseIndex + direction;
      const inRange = exercisesLength > 1 && nextIndex >= 0 && nextIndex < exercisesLength;
      return { nextIndex, inRange };
    },
    [currentExerciseIndex, exercisesLength]
  );

  const handleSwipePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'button, input, textarea, select, [role="button"], [role="slider"], [data-no-swipe]'
        )
      ) {
        swipeStartRef.current = null;
        return;
      }
      // A re-grab mid-return continues from the live position: stop the spring
      // first and seed the gesture from what is on screen.
      stopReturn();
      const now = performance.now();
      swipeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: now,
        id: e.pointerId,
        el: e.currentTarget,
        axis: null,
        from: followRef.current,
      };
      samplesRef.current = [{ dx: 0, t: now }];
    },
    [stopReturn]
  );

  const handleSwipePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      if (!start || start.id !== e.pointerId) return;
      // Motion suppressed: keep the release decision, drop the follow.
      if (prefersReducedMotion) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (start.axis === null) {
        if (Math.abs(dx) >= AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
          start.axis = 'x';
          start.el.style.willChange = 'transform';
        } else if (Math.abs(dy) >= AXIS_LOCK_PX) {
          start.axis = 'y';
        }
      }
      if (start.axis !== 'x') return;

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ dx, t: now });
      // Keep only what still describes the current motion (plus one sample of
      // history, so a single fast move can still yield a velocity).
      while (samples.length > 2) {
        const second = samples[1];
        if (!second || now - second.t <= VELOCITY_WINDOW_MS) break;
        samples.shift();
      }

      const { inRange } = resolveTarget(dx);
      const cap = Math.max(1, start.el.clientWidth * FOLLOW_CAP_RATIO);
      let follow = start.from + dx;
      if (!inRange) {
        follow = (start.from + dx) * EDGE_RESISTANCE;
      } else if (Math.abs(follow) > cap) {
        follow = Math.sign(follow) * (cap + (Math.abs(follow) - cap) * FOLLOW_PAST_CAP);
      }
      applyFollow(start.el, follow);
    },
    [applyFollow, prefersReducedMotion, resolveTarget]
  );

  const handleSwipePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || start.id !== e.pointerId) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const now = performance.now();
      const tracked = start.axis === 'x';

      // Release velocity in px/s across the sample window. A finger that stopped
      // before lifting is deliberately credited with nothing.
      let velocity = 0;
      const samples = samplesRef.current;
      const last = samples[samples.length - 1];
      const first = samples[0];
      if (tracked && last && first && now - last.t <= STALE_RELEASE_MS) {
        const dt = last.t - first.t;
        if (dt > 0) velocity = ((last.dx - first.dx) / dt) * 1000;
      }
      samplesRef.current = [];

      // Decide from where the gesture WOULD come to rest, not where it stopped.
      const projected = dx + velocity * PROJECTION_S;
      const { nextIndex, inRange } = resolveTarget(dx);
      const passed = tracked
        ? Math.abs(projected) >= MIN_DX && Math.abs(dy) <= MAX_DY
        : Math.abs(dx) >= MIN_DX && Math.abs(dy) <= MAX_DY && now - start.t <= MAX_DURATION;

      const commit = passed && inRange;
      if (commit) {
        triggerHaptic('light');
        onChangeExercise(nextIndex);
      } else if (tracked && !inRange && Math.abs(projected) >= MIN_DX) {
        // Felt the end of the list: the gesture was real, there was just nowhere
        // to go. Say so on release instead of failing silently.
        triggerHaptic('light');
      }
      // A commit spends its momentum on the exercise change, so the surface
      // returns quietly; an unresolved gesture keeps its earned bounce.
      settle(start.el, velocity, !commit && velocity !== 0);
    },
    [onChangeExercise, resolveTarget, settle]
  );

  useEffect(() => () => stopReturn(), [stopReturn]);

  return { handleSwipePointerDown, handleSwipePointerMove, handleSwipePointerEnd };
}
