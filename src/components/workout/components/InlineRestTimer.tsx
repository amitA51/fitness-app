// InlineRestTimer - Fresh Steel compact rest timer
// Accent progress ring · surface-2 bg · compact layout

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

    // SVG progress ring parameters
    const size = 44;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(1, Math.max(0, progress / 100)));

    const handleAdd15 = () => {
      triggerHaptic('light');
      onAddTime(15);
    };

    const handleSkip = () => {
      triggerHaptic('light');
      onSkip();
    };

    const isFinalCountdown = timeLeft <= 5 && timeLeft > 0;
    const isCritical = timeLeft <= 3 && timeLeft > 0;

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="טיימר מנוחה"
        className="accent-glow"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 14px',
          background: 'var(--fs-surface)',
          borderBottom: '1px solid var(--fs-surface-2)',
          flexShrink: 0,
        }}
      >
        {/* Left: progress ring + countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* SVG progress ring */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              className="ring-track"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="var(--fs-rubber)"
              strokeWidth={stroke}
            />
            <circle
              className={`ring-progress${isCritical ? ' signal' : ''}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: prefersReduced ? 'none' : 'stroke-dashoffset 0.3s linear',
              }}
            />
          </svg>

          {/* Time display */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1,
                color: 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isFinalCountdown && (
                <span
                  className={`breathing-dot${isCritical ? ' signal' : ''}`}
                  aria-hidden="true"
                />
              )}
              {formatted}
            </div>
            {nextSetHint && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                {nextSetHint}
              </div>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              handleAdd15();
            }}
            aria-label="הוסף 15 שניות"
            style={{
              minWidth: 44,
              minHeight: 32,
              padding: '0 10px',
              background: 'var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              border: '1px solid var(--fs-steel)',
              borderRadius: '10px 7px 10px 7px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            +15s
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              handleSkip();
            }}
            aria-label="דלג על המנוחה"
            style={{
              minWidth: 52,
              minHeight: 32,
              padding: '0 10px',
              background: 'transparent',
              color: 'var(--fs-accent)',
              border: '1px solid var(--fs-accent)',
              borderRadius: '10px 7px 10px 7px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            דלג
          </button>
        </div>
      </div>
    );
  }
);

InlineRestTimer.displayName = 'InlineRestTimer';

export default InlineRestTimer;
