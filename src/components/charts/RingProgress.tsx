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

function clamp0to100(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function variantColor(variant: RingVariant): string {
  return variant === 'signal'
    ? 'var(--fs-signal)'
    : variant === 'warn'
      ? 'var(--fs-warn)'
      : 'var(--fs-accent)';
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
  const trueValue = Number.isNaN(value) ? 0 : Math.max(0, value);
  const basePct = clamp0to100(trueValue);
  // Over-achievement: anything past 100% renders as a second, inset arc rather
  // than silently capping — so a 140% week reads as earned overflow, not "done".
  const overPct = clamp0to100(trueValue - 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - basePct / 100);
  const cx = size / 2;
  const cy = size / 2;

  const insetRadius = radius - strokeWidth;
  const insetCircumference = 2 * Math.PI * insetRadius;
  const insetDashOffset = insetCircumference * (1 - overPct / 100);

  const progressClassName = variant === 'accent' ? 'ring-progress' : `ring-progress ${variant}`;
  const color = variantColor(variant);

  // Leading-edge tip dot: the signature "premium gauge" cue. Sits at the end of
  // the drawn arc (angle = -90° start + basePct of a full turn) and carries the
  // ring's color + glow. Hidden at 0%. Reduced-motion-safe (purely positional).
  const tipAngle = -90 + (basePct / 100) * 360;
  const showTip = basePct > 0;

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
    <div style={wrapperStyle} role="img" aria-label={ariaLabel ?? label ?? `${Math.round(trueValue)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeWidth} />
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
        {/* Over-achievement remainder, drawn inside the base ring with extra glow. */}
        {overPct > 0 && insetRadius > 0 && (
          <circle
            className={progressClassName}
            cx={cx}
            cy={cy}
            r={insetRadius}
            fill="none"
            strokeWidth={Math.max(3, strokeWidth - 3)}
            strokeDasharray={insetCircumference}
            strokeDashoffset={insetDashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        )}
        {showTip && (
          <g transform={`rotate(${tipAngle} ${cx} ${cy})`}>
            <circle
              cx={cx + radius}
              cy={cy}
              r={strokeWidth / 2}
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          </g>
        )}
      </svg>
      <div style={centerStyle}>
        {centerContent !== undefined ? (
          centerContent
        ) : (
          <span className="kinetic-number large" style={{ fontSize: defaultCenterFontSize, lineHeight: 1 }}>
            {Math.round(trueValue)}%
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
