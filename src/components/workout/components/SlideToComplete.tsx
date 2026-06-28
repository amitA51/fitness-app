// SlideToComplete — Fresh Steel slide-to-confirm
// Pill shape (border-radius: 999px) · accent thumb · signal fill · check icon on complete
// Haptic tick on threshold cross, success pattern on complete.
// Keyboard: Enter / Space completes immediately (accessibility fallback).
//
// GSAP upgrade: on release past threshold the thumb FLINGS to the end with a
// back.out overshoot, the Check icon scale-stamps, the accent fill flashes, and
// a small radial spark burst fires from the thumb center. onComplete fires at
// the lock-in instant so the next set is never gated on the cosmetic tail.

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '../../../lib/gsap';
import { fireSparks } from '../../../lib/gsapSparks';
import { triggerHaptic, triggerHapticEffect } from '../../../utils/haptics';

interface SlideToCompleteProps {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
}

const THUMB_SIZE = 60;
const TRACK_HEIGHT = 68;
const TRACK_PAD = 4;
const THRESHOLD = 0.75;
// Tap-and-hold quick-complete: a stationary press fills the track over this many
// ms (with a haptic ramp) and then locks in via the same finish() path as a
// slide. Opt-in — a slide still completes instantly; this only triggers when the
// pointer stays put long enough to start the hold ramp.
const HOLD_FILL_MS = 450;
// Movement (px) past which a press is treated as a slide, not a hold — cancels
// the hold ramp so a real drag never double-fires.
const HOLD_MOVE_TOLERANCE = 8;
// Haptic ramp ticks during the hold fill (fraction of progress → light buzz).
const HOLD_HAPTIC_MARKS = [0.33, 0.66] as const;

const SlideToComplete = memo<SlideToCompleteProps>(({ label, onComplete, disabled }) => {
  const trackRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const maxOffsetRef = useRef(0);
  const flingFromRef = useRef(0);
  const finishTickRef = useRef(0);
  // Tap-and-hold quick-complete bookkeeping: the rAF id driving the fill, the
  // hold start timestamp, and which haptic ramp marks have already fired.
  const holdRafRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef(0);
  const holdHapticIdxRef = useRef(0);
  const isHoldingRef = useRef(false);
  // Re-entrancy guard for finish(): set synchronously the first time a commit
  // locks in, so a second trigger in the SAME gesture (e.g. the rAF hold ramp
  // auto-completes, then the still-pressed pointer lifts) can't fire onComplete
  // twice. Cleared when the slider resets to idle.
  const finishedRef = useRef(false);
  const instructionId = useId();

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isFlinging, setIsFlinging] = useState(false);
  const [finishTick, setFinishTick] = useState(0);
  // Screen-reader announcement fired once when the slider crosses the commit
  // threshold. Empty between crosses so re-entering re-announces.
  const [thresholdAnnounce, setThresholdAnnounce] = useState('');

  const prefersReducedMotion = useReducedMotion();

  const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
  const sign = isRTL ? -1 : 1;

  const recalcMax = useCallback(() => {
    if (!trackRef.current) return;
    const w = trackRef.current.getBoundingClientRect().width;
    maxOffsetRef.current = Math.max(0, w - THUMB_SIZE - TRACK_PAD * 2);
  }, []);

  useEffect(() => {
    recalcMax();
    window.addEventListener('resize', recalcMax);
    return () => window.removeEventListener('resize', recalcMax);
  }, [recalcMax]);

  const finish = useCallback(() => {
    // Re-entrancy guard: a single commit must call onComplete exactly once. The
    // hold ramp can auto-complete while the pointer is still down, and the later
    // pointerUp would otherwise re-enter finish() (offset is still ~max), firing
    // onComplete a second time and advancing two sets from one gesture.
    if (finishedRef.current) return;
    finishedRef.current = true;
    // The press is over once a commit locks in; clear the drag flag so a later
    // pointerUp from the same gesture bails on its `if (!isDragging) return`.
    setIsDragging(false);
    // No haptic here: the set-complete buzz is owned by the COMPLETE_SET reducer
    // (fired once in WorkoutProvider). The slider's own spark+check animation is
    // its visual confirmation, so self-buzzing would double/triple the vibration.
    if (prefersReducedMotion) {
      setIsComplete(true);
      setOffset(maxOffsetRef.current);
      onComplete();
      setOffset(0);
      setIsComplete(false);
      finishedRef.current = false;
      return;
    }
    // Hand the thumb transform off to GSAP: remember where the drag ended, flag
    // flinging (so React stops writing translateX), and trigger the timeline.
    flingFromRef.current = offset;
    setIsComplete(true);
    setIsFlinging(true);
    finishTickRef.current += 1;
    setFinishTick(finishTickRef.current);
  }, [onComplete, prefersReducedMotion, offset]);

  // Cancel an in-progress hold fill (early release or drag). Resets the thumb
  // back to the rail and clears the ramp bookkeeping (rAF for the animated fill,
  // or the timeout used under reduced motion).
  const cancelHold = useCallback(() => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    holdHapticIdxRef.current = 0;
    setOffset(0);
    setThresholdAnnounce('');
  }, []);

  // Begin the tap-and-hold quick-complete ramp. Drives `offset` from 0 → max
  // over HOLD_FILL_MS with a light haptic at each ramp mark, then locks in via
  // the SAME finish() path as a slide. Under reduced motion finish() completes
  // instantly anyway; we still gate the visual ramp here for a calm fill.
  const startHold = useCallback(() => {
    recalcMax();
    if (maxOffsetRef.current <= 0) return;
    isHoldingRef.current = true;
    holdStartRef.current = performance.now();
    holdHapticIdxRef.current = 0;
    setThresholdAnnounce('');

    // Reduced motion: keep the HOLD requirement (still NOT a single tap) but
    // skip the animated fill — wait out HOLD_FILL_MS then complete. Releasing
    // early still cancels via cancelHold().
    if (prefersReducedMotion) {
      holdTimeoutRef.current = setTimeout(() => {
        holdTimeoutRef.current = null;
        isHoldingRef.current = false;
        finish();
      }, HOLD_FILL_MS);
      return;
    }

    const step = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const ratio = Math.min(1, elapsed / HOLD_FILL_MS);
      setOffset(maxOffsetRef.current * ratio);

      // Light haptic ramp at the configured marks (once each).
      const nextMark = HOLD_HAPTIC_MARKS[holdHapticIdxRef.current];
      if (nextMark !== undefined && ratio >= nextMark) {
        holdHapticIdxRef.current += 1;
        triggerHaptic('light');
      }

      if (ratio >= 1) {
        holdRafRef.current = null;
        isHoldingRef.current = false;
        holdHapticIdxRef.current = 0;
        finish();
        return;
      }
      holdRafRef.current = requestAnimationFrame(step);
    };
    holdRafRef.current = requestAnimationFrame(step);
  }, [recalcMax, finish, prefersReducedMotion]);

  // Tear down any pending hold rAF on unmount.
  useEffect(() => () => cancelHold(), [cancelHold]);

  // GSAP fling + spark stamp, fired when finishTick advances (after the render
  // that sets isFlinging, so the React transform is already off the thumb).
  useGSAP(
    () => {
      if (finishTick === 0 || prefersReducedMotion) return;
      const thumb = thumbRef.current;
      const track = trackRef.current;
      if (!thumb || !track) return;

      const target = maxOffsetRef.current * sign;
      const overshoot = 6 * sign;
      const thumbCenter = TRACK_PAD + THUMB_SIZE / 2 + maxOffsetRef.current;

      gsap.set(thumb, { x: flingFromRef.current * sign });

      const tl = gsap.timeline();
      tl.to(thumb, {
        x: target + overshoot,
        duration: DUR.fast,
        ease: EASE.pop,
      })
        .to(thumb, { x: target, duration: DUR.micro, ease: EASE.out })
        // Lock-in: unblock the next set early, let the cosmetics play out after.
        .add(() => {
          fireSparks(track, {
            count: 12,
            originX: isRTL ? track.clientWidth - thumbCenter : thumbCenter,
            originY: TRACK_HEIGHT / 2,
            minVelocity: 160,
            maxVelocity: 340,
            gravity: 700,
            sizeMin: 4,
            sizeMax: 8,
            duration: 0.7,
          });
          onComplete();
        }, '>-0.04')
        .fromTo(
          checkRef.current,
          { scale: 0 },
          { scale: 1.15, duration: DUR.micro, ease: EASE.popHard },
          '<'
        )
        .to(checkRef.current, { scale: 1, duration: 0.1, ease: EASE.out })
        .to(
          fillRef.current,
          { filter: 'brightness(1.6)', duration: 0.06, yoyo: true, repeat: 1 },
          '<'
        )
        .add(() => {
          gsap.set(thumb, { clearProps: 'transform' });
          setOffset(0);
          setIsComplete(false);
          setIsFlinging(false);
          // Re-arm for the next set: the commit's cosmetic tail has played out.
          finishedRef.current = false;
        });
    },
    { dependencies: [finishTick], scope: trackRef }
  );

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || isComplete) return;
    e.preventDefault();
    // preventDefault suppresses the native focus-on-press, so a following Enter
    // would activate whatever was focused before. Focus the track explicitly so
    // keyboard activation lands on the slider, not the previous control.
    e.currentTarget.focus();
    recalcMax();
    startXRef.current = e.clientX;
    startOffsetRef.current = offset;
    setIsDragging(true);
    triggerHaptic('light');
    e.currentTarget.setPointerCapture(e.pointerId);
    // Start the tap-and-hold ramp in parallel: if the pointer stays put it fills
    // and completes; the first real movement past tolerance cancels it (slide).
    startHold();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Hold-cancel is checked off the synchronous ref BEFORE the isDragging
    // (state) guard: any meaningful movement means this is a slide, not a hold,
    // so abort the ramp so the two inputs never both complete the set.
    if (isHoldingRef.current && Math.abs(e.clientX - startXRef.current) > HOLD_MOVE_TOLERANCE) {
      cancelHold();
    }
    if (!isDragging) return;
    const delta = (e.clientX - startXRef.current) * sign;
    // While the hold ramp owns `offset`, don't let small in-tolerance jitter
    // from the same press fight it — the ramp drives the fill until cancelled.
    if (isHoldingRef.current) return;
    setOffset((prev) => {
      const next = Math.max(0, Math.min(maxOffsetRef.current, startOffsetRef.current + delta));
      const prevRatio = maxOffsetRef.current > 0 ? prev / maxOffsetRef.current : 0;
      const nextRatio = maxOffsetRef.current > 0 ? next / maxOffsetRef.current : 0;
      if (nextRatio >= THRESHOLD && prevRatio < THRESHOLD) {
        // One-shot at the cross into the committed zone: firmer impact haptic
        // + a polite SR announcement so non-visual users know they can release.
        triggerHapticEffect('impact', 'medium');
        setThresholdAnnounce('עברת את נקודת האישור');
      } else if (nextRatio < THRESHOLD && prevRatio >= THRESHOLD) {
        // Dropped back below the threshold — clear so the next cross re-announces.
        setThresholdAnnounce('');
      }
      return next;
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
    setIsDragging(false);
    // A hold released before the ramp completed is a cancel — never a partial
    // commit. cancelHold() resets the fill; if the ramp already locked in,
    // isHoldingRef is false and this no-ops.
    if (isHoldingRef.current) {
      cancelHold();
      return;
    }
    const ratio = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;
    if (ratio >= THRESHOLD) {
      finish();
    } else {
      setOffset(0);
      setThresholdAnnounce('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isComplete) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      recalcMax();
      finish();
    }
  };

  const progress = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;
  const snap =
    prefersReducedMotion || isDragging || isFlinging
      ? 'none'
      : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), width 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease';

  // Pattern fill for track background
  const patternFill =
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 14px)';

  return (
    <button
      ref={trackRef}
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-describedby={instructionId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="relative w-full select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
      style={{
        height: TRACK_HEIGHT,
        background: `${patternFill}, var(--fs-primary)`,
        borderRadius: 999,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        border: '1px solid color-mix(in srgb, var(--fs-accent) 22%, transparent)',
        boxShadow: isDragging
          ? '0 0 0 3px color-mix(in srgb, var(--fs-accent) 16%, transparent)'
          : 'var(--elevation-1, 0 2px 10px rgba(0,0,0,0.08))',
      }}
    >
      <span id={instructionId} className="sr-only">
        ניתן לגרור עד סוף המסילה, ללחוץ ולהחזיק לסימון מהיר, או ללחוץ Enter או רווח כדי לסמן את הסט
        כבוצע.
      </span>
      {/* Polite SR feedback at the commit-threshold cross (visual users get the
          haptic + fill cues instead). */}
      <span aria-live="polite" className="sr-only">
        {thresholdAnnounce}
      </span>
      {/* Accent fill — trails behind the thumb with opacity */}
      <div
        ref={fillRef}
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          [isRTL ? 'right' : 'left']: 0,
          width: offset + THUMB_SIZE + TRACK_PAD,
          background: 'var(--fs-accent)',
          opacity: 0.12 + progress * 0.2,
          borderRadius: 999,
          transition: snap,
        }}
      />

      {/* Center label — fades as progress grows */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--fs-accent)',
          opacity: 1 - progress * 0.85,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
          padding: `0 ${THUMB_SIZE + TRACK_PAD * 4}px`,
        }}
      >
        {label}
      </div>

      {/* Direction hint (opposite side from thumb start) */}
      <div
        className="absolute pointer-events-none flex items-center"
        style={{
          top: 0,
          bottom: 0,
          insetInlineEnd: 14,
          color: 'color-mix(in srgb, var(--fs-accent) 40%, transparent)',
          opacity: 1 - progress,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
        }}
        aria-hidden
      >
        {isRTL ? (
          <ChevronLeft size={16} strokeWidth={3} />
        ) : (
          <ChevronRight size={16} strokeWidth={3} />
        )}
      </div>

      {/* Thumb (pointer events handled on parent). While flinging, GSAP owns the
          transform — React must not write translateX or the two will fight. */}
      <div
        ref={thumbRef}
        className="absolute flex items-center justify-center"
        style={{
          top: TRACK_PAD,
          width: THUMB_SIZE,
          height: TRACK_HEIGHT - TRACK_PAD * 2,
          insetInlineStart: TRACK_PAD,
          ...(isFlinging ? {} : { transform: `translateX(${offset * sign}px)` }),
          background: 'var(--fs-accent)',
          color: 'var(--color-ink-on-accent)',
          borderRadius: 999,
          transition: snap,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
        aria-hidden
      >
        <div ref={checkRef} className="flex items-center justify-center">
          {isComplete ? (
            <Check size={20} strokeWidth={3} />
          ) : isRTL ? (
            <ChevronLeft size={20} strokeWidth={3} />
          ) : (
            <ChevronRight size={20} strokeWidth={3} />
          )}
        </div>
      </div>
    </button>
  );
});

SlideToComplete.displayName = 'SlideToComplete';

export default SlideToComplete;
