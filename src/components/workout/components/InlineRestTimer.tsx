// InlineRestTimer - Fresh Steel compact rest timer
// Accent progress ring · surface-2 bg · compact layout

import { memo, useEffect, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
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

    if (!active) return null;

    const size = 52;
    const stroke = 7;
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          background:
            'linear-gradient(180deg, var(--fs-surface) 0%, color-mix(in srgb, var(--fs-accent) 5%, var(--fs-surface)) 100%)',
          borderBottom: '2px solid var(--fs-accent)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 28,
                lineHeight: 1,
                color: isCritical ? 'var(--fs-warn)' : 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.01em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.2s ease',
              }}
            >
              {isFinalCountdown && (
                <span
                  className={`breathing-dot${isCritical ? ' signal' : ''}`}
                  aria-hidden="true"
                  style={{ animation: prefersReduced ? 'none' : undefined }}
                />
              )}
              {formatted}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
                marginTop: 2,
                fontWeight: 700,
              }}
            >
              {nextSetHint || 'מנוחה'}
            </div>
          </div>
        </div>

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
            -15s
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
            +15s
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
              color: 'var(--fs-heading)',
              border: '1px solid var(--fs-accent)',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 800,
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
