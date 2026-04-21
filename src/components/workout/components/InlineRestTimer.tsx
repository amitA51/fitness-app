// InlineRestTimer - thin editorial rest strip replacing the full-screen overlay.
// Navy strip, mustard shrinking progress fill, bone countdown. Sharp corners.

import { memo, useEffect, useRef, useState } from 'react';
import { triggerHaptic, vibratePattern } from '../../../utils/haptics';
import { useRestTimer } from '../hooks/useWorkoutTimer';

interface InlineRestTimerProps {
  active: boolean;
  endTime: number | null;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  nextSetHint?: string;
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
  ({ active, endTime, onSkip, onAddTime, nextSetHint }) => {
    const { formatted, progress, timeLeft } = useRestTimer(endTime, active);
    const prefersReduced = usePrefersReducedMotion();
    const zeroFiredRef = useRef(false);

    const secondsLeft = Math.ceil(timeLeft);
    const isFinalThree = secondsLeft <= 3 && secondsLeft > 0;

    // Fire an end-of-timer buzz once when the countdown hits zero.
    useEffect(() => {
      if (!active) {
        zeroFiredRef.current = false;
        return;
      }
      if (timeLeft <= 0 && !zeroFiredRef.current) {
        zeroFiredRef.current = true;
        vibratePattern([200, 100, 200]);
      }
    }, [active, timeLeft]);

    if (!active) return null;

    const remainingWidth = Math.max(0, 100 - progress);

    const handleAdd15 = () => {
      triggerHaptic('light');
      onAddTime(15);
    };

    const handleSkip = () => {
      triggerHaptic('light');
      onSkip();
    };

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="טיימר מנוחה"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 76,
          backgroundColor: 'var(--navy)',
          overflow: 'hidden',
          borderRadius: 0,
          flexShrink: 0,
        }}
      >
        {/* Mustard progress fill — shrinks from right/left edge as time elapses */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            insetInlineStart: 0,
            width: `${remainingWidth}%`,
            backgroundColor: 'var(--mustard)',
            opacity: 0.22,
            transition: 'width 0.3s linear',
            pointerEvents: 'none',
          }}
        />

        {/* Content overlay — three-column editorial */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 20px',
            minHeight: 76,
          }}
        >
          {/* Left — eyebrow + hint */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.28em',
                color: 'var(--mustard)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              REST
            </span>
            {nextSetHint && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  color: 'var(--bone)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {nextSetHint}
              </span>
            )}
          </div>

          {/* Center — countdown */}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 32,
              lineHeight: 1,
              color: 'var(--bone)',
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
              transform: isFinalThree && !prefersReduced ? undefined : 'scale(1)',
              animation:
                isFinalThree && !prefersReduced
                  ? 'inline-rest-pulse 1s ease-in-out infinite'
                  : undefined,
            }}
          >
            {formatted}
          </div>

          {/* Right — chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleAdd15();
              }}
              aria-label="הוסף 15 שניות"
              style={{
                minWidth: 52,
                minHeight: 44,
                padding: '0 12px',
                backgroundColor: 'var(--mustard)',
                color: 'var(--navy)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              +15
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleSkip();
              }}
              aria-label="דלג על המנוחה"
              style={{
                minWidth: 60,
                minHeight: 44,
                padding: '0 12px',
                backgroundColor: 'transparent',
                color: 'var(--mustard)',
                border: '2px solid var(--mustard)',
                borderRadius: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              SKIP
            </button>
          </div>
        </div>

        <style>{`
          @keyframes inline-rest-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-inline-rest-pulse] { animation: none !important; transform: none !important; }
          }
        `}</style>
      </div>
    );
  }
);

InlineRestTimer.displayName = 'InlineRestTimer';

export default InlineRestTimer;
