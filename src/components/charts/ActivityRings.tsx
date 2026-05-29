import { memo } from 'react';
import type { RingVariant } from './RingProgress';

export interface ActivityRingData {
  value: number;
  max: number;
  label: string;
  variant?: RingVariant;
}

interface ActivityRingsProps {
  rings: ActivityRingData[];
  size?: number;
  gap?: number;
}

function clampPct(value: number, max: number): number {
  if (max <= 0) return 0;
  const pct = (value / max) * 100;
  if (Number.isNaN(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

function progressClass(variant: RingVariant | undefined): string {
  if (!variant || variant === 'accent') return 'ring-progress';
  return `ring-progress ${variant}`;
}

export const ActivityRings = memo(function ActivityRings({
  rings,
  size = 160,
  gap = 6,
}: ActivityRingsProps) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = Math.max(6, Math.round(size * 0.085));
  // Outer ring starts at outermost radius, inner rings progressively smaller.
  const ringStep = strokeWidth + gap;

  return (
    <div
      className="fade-rise-in"
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="img"
      aria-label={rings
        .map((r) => `${r.label} ${Math.round(clampPct(r.value, r.max))}%`)
        .join(', ')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {rings.map((ring, i) => {
          const radius = (size - strokeWidth) / 2 - i * ringStep;
          if (radius <= 0) return null;
          const circumference = 2 * Math.PI * radius;
          const pct = clampPct(ring.value, ring.max);
          const dashOffset = circumference * (1 - pct / 100);
          return (
            <g key={`${ring.label}-${i}`}>
              <title>{`${ring.label}: ${Math.round(pct)}%`}</title>
              <circle
                className="ring-track"
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
              />
              <circle
                className={progressClass(ring.variant)}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
});
