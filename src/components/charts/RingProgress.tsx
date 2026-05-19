import type { CSSProperties, ReactNode } from 'react';
import { memo } from 'react';

export type RingVariant = 'accent' | 'signal' | 'warn';

interface RingProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  variant?: RingVariant;
  label?: string;
  centerContent?: ReactNode;
  ariaLabel?: string;
}

function clampValue(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export const RingProgress = memo(function RingProgress({
  value,
  size = 120,
  strokeWidth = 10,
  variant = 'accent',
  label,
  centerContent,
  ariaLabel,
}: RingProgressProps) {
  const safeValue = clampValue(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue / 100);
  const cx = size / 2;
  const cy = size / 2;

  const progressClassName = variant === 'accent' ? 'ring-progress' : `ring-progress ${variant}`;

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const centerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    textAlign: 'center',
  };

  const defaultCenterFontSize = Math.max(14, Math.round(size * 0.22));

  return (
    <div style={wrapperStyle} role="img" aria-label={ariaLabel ?? label ?? `${safeValue}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="ring-track"
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className={progressClassName}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div style={centerStyle}>
        {centerContent !== undefined ? (
          centerContent
        ) : (
          <span
            className="kinetic-number large"
            style={{ fontSize: defaultCenterFontSize, lineHeight: 1 }}
          >
            {Math.round(safeValue)}%
          </span>
        )}
        {label && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
});
