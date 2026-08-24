// InlineRestTimer - Fresh Steel compact rest timer
// Accent progress ring · surface-2 bg · compact layout
//
// Final-5s urgency: the ring thickens (7→9px), recolors to --fs-warn, pulses
// faster and gains a --fs-warn radial glow; heavy impact haptics fire at the
// 3/2/1 marks and a success haptic at 0. ALL escalation (pulse, glow, haptics)
// is gated by prefers-reduced-motion — when reduced, only the color and the
// number change, with no pulse, glow, or haptic escalation.

import { memo, useEffect, useRef, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import { triggerHaptic } from '../../../utils/haptics';
import { useWorkoutSettings } from '../hooks/useWorkoutSettings';
import { useRestTimer } from '../hooks/useWorkoutTimer';

interface InlineRestTimerProps {
  active: boolean;
  endTime: number | null;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  nextSetHint?: string;
  /** Planned weight (kg) for the upcoming set — shown as a dir="ltr" chip. */
  nextSetWeight?: number;
  /** Planned reps for the upcoming set — shown as a dir="ltr" chip. */
  nextSetReps?: number;
  /** Freeze the countdown while the workout is paused. */
  isPaused?: boolean;
  /**
   * "התחל סט הבא": skip rest AND jump straight to entering the next set's
   * weight (removes the skip-then-find-input step). Falls back to onSkip when
   * not provided.
   */
  onStartNextSet?: () => void;
}

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
};

const InlineRestTimer = memo<InlineRestTimerProps>(
  ({
    active,
    endTime,
    onSkip,
    onAddTime,
    nextSetHint,
    nextSetWeight = 0,
    nextSetReps = 0,
    isPaused = false,
    onStartNextSet,
  }) => {
    // Tap the ring to expand into a large glanceable countdown + bigger target
    // readout. Collapsed by default to keep the header compact.
    const [expanded, setExpanded] = useState(false);
    // Body for the screen-off rest-end notification: the next-set hint plus the
    // planned target (e.g. "הסט הבא · 02 · 60ק״ג × 8"). Falls back to the hint
    // alone, then a generic body inside the hook.
    const notifyBody = (() => {
      const parts: string[] = [];
      if (nextSetHint) parts.push(nextSetHint);
      const target = [
        nextSetWeight > 0 ? `${nextSetWeight}ק״ג` : '',
        nextSetReps > 0 ? `${nextSetReps}` : '',
      ]
        .filter(Boolean)
        .join(' × ');
      if (target) parts.push(target);
      return parts.length > 0 ? parts.join(' · ') : undefined;
    })();

    const { formatted, progress, timeLeft, totalTime } = useRestTimer(
      endTime,
      active,
      isPaused,
      notifyBody
    );
    const prefersReduced = usePrefersReducedMotion();
    const haptics = useHapticFeedback();
    // Audio cues honor voiceCountdownEnabled / countdownBeepEnabled inside these
    // helpers, so we can call them unconditionally and let settings gate output.
    const { announceCountdown, announceReady } = useWorkoutSettings();

    const isFinalCountdown = active && timeLeft <= 5 && timeLeft > 0;

    // Per-second escalation: heavy impact at the 3/2/1 marks, a success pulse at
    // 0. `timeLeft` is already whole seconds, so each change here IS a tick.
    //
    // NOT gated on prefers-reduced-motion: that preference is about visual
    // motion (vestibular comfort), not about tactile feedback. Suppressing the
    // countdown buzz for reduced-motion users removed the one cue that works
    // when the phone is on the floor and out of sight. The user-facing haptics
    // switch (useHapticFeedback → hapticsEnabled) remains the way to silence it.
    const lastSecondRef = useRef<number | null>(null);
    useEffect(() => {
      if (!active || isPaused) {
        lastSecondRef.current = null;
        return;
      }
      const sec = timeLeft;
      if (sec === lastSecondRef.current) return;
      const prev = lastSecondRef.current;
      lastSecondRef.current = sec;
      // Only react to a genuine downward tick (skip the initial mount seed and
      // any upward jump from +15s, which would otherwise misfire the buzz).
      if (prev === null || sec >= prev) return;
      if (sec === 3 || sec === 2 || sec === 1) {
        haptics.impact('heavy');
      } else if (sec === 0) {
        haptics.success();
      }
    }, [timeLeft, active, isPaused, haptics]);

    // ── COUNTDOWN AUDIO ───────────────────────────────────────────────────
    // Per-second beeps/voice as rest winds down, then a "get ready" cue exactly
    // when the timer hits 0 — i.e. precise audio right before the next set
    // begins. Independent of prefers-reduced-motion (it's audio, not motion) and
    // independent of the haptics effect so silencing one never mutes the other.
    // `timeLeft` is whole seconds, so each change fires exactly one cue.
    const lastAudioSecondRef = useRef<number | null>(null);
    useEffect(() => {
      if (!active || isPaused) {
        lastAudioSecondRef.current = null;
        return;
      }
      const sec = timeLeft;
      if (sec === lastAudioSecondRef.current) return;
      const prev = lastAudioSecondRef.current;
      lastAudioSecondRef.current = sec;
      // Only react to a genuine downward tick (skip mount seed + +15s jumps).
      if (prev === null || sec >= prev) return;
      if (sec > 0 && sec <= 10) {
        announceCountdown(sec, totalTime || sec);
      } else if (sec === 0) {
        announceReady();
      }
    }, [timeLeft, active, isPaused, totalTime, announceCountdown, announceReady]);

    if (!active) return null;

    const size = 52;
    // Final-5s urgency thickens the ring (7→9px) so it reads at a glance.
    const stroke = isFinalCountdown ? 9 : 7;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(1, Math.max(0, progress / 100)));

    const handleAddTime = (seconds: number) => {
      triggerHaptic('light');
      onAddTime(seconds);
    };

    const handleSkip = () => {
      triggerHaptic('light');
      onSkip();
    };

    const handleToggleExpand = () => {
      triggerHaptic('light');
      setExpanded((prev) => !prev);
    };

    // "התחל סט הבא": skip rest and jump to entering the next set. Collapses the
    // panel first so the header is clean when the numpad/input takes focus.
    const handleStartNextSet = () => {
      triggerHaptic('medium');
      setExpanded(false);
      (onStartNextSet ?? onSkip)();
    };

    const hasTarget = nextSetWeight > 0 || nextSetReps > 0;

    return (
      <>
        <div
          role="status"
          aria-live="polite"
          aria-label="טיימר מנוחה"
          className="accent-glow"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 16px',
            // Final-5s: warn-tinted bg + warn bottom border. The radial GLOW only
            // appears when motion is allowed (it pulses); reduced-motion users get
            // the warn color shift but no glow/pulse.
            background: isFinalCountdown
              ? 'linear-gradient(180deg, var(--fs-surface) 0%, color-mix(in srgb, var(--fs-warn) 9%, var(--fs-surface)) 100%)'
              : 'linear-gradient(180deg, var(--fs-surface) 0%, color-mix(in srgb, var(--fs-accent) 5%, var(--fs-surface)) 100%)',
            borderBottom: isFinalCountdown
              ? '2px solid var(--fs-warn)'
              : '2px solid var(--fs-accent)',
            // Radial warn glow only when motion is allowed; the breathing dot
            // below carries the (faster) pulse, so no extra container keyframe.
            boxShadow:
              isFinalCountdown && !prefersReduced
                ? '0 0 18px color-mix(in srgb, var(--fs-warn) 45%, transparent)'
                : undefined,
            transition: prefersReduced ? 'none' : 'background 0.3s ease, box-shadow 0.3s ease',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? 'כווץ את טיימר המנוחה' : 'הרחב את טיימר המנוחה'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              textAlign: 'start',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ transform: 'rotate(-90deg)' }}
              aria-hidden="true"
            >
              <circle
                className="ring-track"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="var(--fs-rubber)"
                strokeWidth={stroke}
              />
              {/* Final-5s: ring recolors to --fs-warn (.warn) — NOT .signal, which
                is reserved for PR celebration. Stroke also thickens (7→9px). */}
              <circle
                className={`ring-progress${isFinalCountdown ? ' warn' : ''}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{
                  // The countdown state now ticks at 1Hz, so the ring interpolates
                  // across the FULL second, linearly. Net effect on screen is the
                  // same continuous sweep as the old 100ms polling, at a tenth of
                  // the React commits — the browser tweens it instead of us.
                  transition: prefersReduced
                    ? 'none'
                    : 'stroke-dashoffset 1s linear, stroke 0.3s ease, stroke-width 0.3s ease',
                }}
              />
            </svg>

            <div>
              <div
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 28,
                  lineHeight: 1,
                  // Final-5s recolors the number to --fs-warn (color/number change
                  // is the reduced-motion-safe part of the urgency cue).
                  color: isFinalCountdown ? 'var(--fs-warn)' : 'var(--fs-ink)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.2s ease',
                }}
              >
                {isFinalCountdown && (
                  // .warn (not .signal — lime is PR-only). Faster pulse in the
                  // final 5s; reduced-motion disables the pulse via the existing
                  // @media rule on .breathing-dot.
                  <span
                    className="breathing-dot warn"
                    aria-hidden="true"
                    style={{ animationDuration: prefersReduced ? undefined : '0.6s' }}
                  />
                )}
                {formatted}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-accent)',
                  marginTop: 2,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{nextSetHint || 'מנוחה'}</span>
                {/* Rich next-set target chip: "{weight}ק״ג · {reps}", numbers
                  dir="ltr". Shown only when the upcoming set is planned. */}
                {(nextSetWeight > 0 || nextSetReps > 0) && (
                  <span
                    dir="ltr"
                    style={{
                      color: 'var(--fs-ink)',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {nextSetWeight > 0 ? `${nextSetWeight}ק״ג` : ''}
                    {nextSetWeight > 0 && nextSetReps > 0 ? ' · ' : ''}
                    {nextSetReps > 0 ? `${nextSetReps}` : ''}
                  </span>
                )}
              </div>
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleAddTime(-15);
              }}
              // Keyboard/AT activation dispatches click with detail === 0 (no
              // pointer event fires), so this never double-fires for touch.
              onClick={(e) => {
                if (e.detail === 0) handleAddTime(-15);
              }}
              aria-label="הפחת 15 שניות"
              style={{
                minWidth: 48,
                minHeight: 48,
                padding: '0 10px',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-ink)',
                border: '1px solid var(--fs-steel)',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span dir="ltr">15-</span> שנ׳
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleAddTime(15);
              }}
              onClick={(e) => {
                if (e.detail === 0) handleAddTime(15);
              }}
              aria-label="הוסף 15 שניות"
              style={{
                minWidth: 48,
                minHeight: 48,
                padding: '0 10px',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-ink)',
                border: '1px solid var(--fs-steel)',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span dir="ltr">15+</span> שנ׳
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleSkip();
              }}
              onClick={(e) => {
                if (e.detail === 0) handleSkip();
              }}
              aria-label="דלג על המנוחה"
              style={{
                minWidth: 56,
                minHeight: 48,
                padding: '0 14px',
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                border: '1px solid var(--fs-accent)',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              דלג
            </button>
          </div>
        </div>

        {/* Expanded glanceable panel — large countdown + big next-set target +
          a primary "start next set" affordance that skips rest and jumps to the
          weight input. Urgency stays on --fs-warn (no lime). */}
        {expanded && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              padding: '18px 16px 20px',
              background: 'var(--fs-surface)',
              borderBottom: '2px solid var(--fs-accent)',
            }}
          >
            <div
              dir="ltr"
              className="kinetic-number"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 72,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: isFinalCountdown ? 'var(--fs-warn)' : 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatted}
            </div>

            {hasTarget && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {nextSetHint || 'הסט הבא'}
                </span>
                <span
                  dir="ltr"
                  className="kinetic-number"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 24,
                    color: 'var(--fs-ink)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {nextSetWeight > 0 ? `${nextSetWeight} ק״ג` : ''}
                  {nextSetWeight > 0 && nextSetReps > 0 ? ' × ' : ''}
                  {nextSetReps > 0 ? `${nextSetReps}` : ''}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartNextSet}
              className="active:scale-[0.98]"
              style={{
                width: '100%',
                maxWidth: 320,
                minHeight: 52,
                padding: '0 20px',
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                border: 'none',
                borderRadius: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                transition: prefersReduced ? 'none' : 'transform 120ms ease',
              }}
            >
              התחילו סט הבא
            </button>
          </div>
        )}
      </>
    );
  }
);

InlineRestTimer.displayName = 'InlineRestTimer';

export default InlineRestTimer;
