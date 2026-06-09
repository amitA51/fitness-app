import { memo } from 'react';

interface AnimatedBarProps {
  value: number;
  accent?: string;
  height?: number;
  label?: string;
  showValue?: boolean;
  pulseOnComplete?: boolean;
  ariaLabel?: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export const AnimatedBar = memo(function AnimatedBar({
  value,
  accent = 'var(--fs-accent)',
  height = 8,
  label,
  showValue = false,
  pulseOnComplete = false,
  ariaLabel,
}: AnimatedBarProps) {
  const safeValue = clamp01(value);
  const isComplete = safeValue >= 100;
  const trackClassName =
    pulseOnComplete && isComplete ? 'fs-progress-track accent-glow' : 'fs-progress-track';

  return (
    <div style={{ width: '100%' }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 4,
          }}
        >
          {label && (
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--fs-ink)',
              }}
            >
              {label}
            </span>
          )}
          {showValue && (
            <span
              className="kinetic-number"
              dir="ltr"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fs-muted)',
              }}
            >
              {Math.round(safeValue)}%
            </span>
          )}
        </div>
      )}
      <div
        className={trackClassName}
        style={{ height, position: 'relative', overflow: 'hidden' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        aria-label={ariaLabel ?? label ?? `${Math.round(safeValue)}%`}
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            // scaleX instead of width so the fill animates on the compositor
            // (no layout pass per frame). Origin = right, the RTL leading edge.
            transform: `scaleX(${safeValue / 100})`,
            transformOrigin: '100% 50%',
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 70%, transparent), ${accent})`,
            transition: 'transform var(--duration-premium) var(--ease-premium)',
            boxShadow: isComplete
              ? `0 0 12px color-mix(in srgb, ${accent} 55%, transparent)`
              : 'none',
          }}
        />
      </div>
    </div>
  );
});
