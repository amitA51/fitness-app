import { m } from 'framer-motion';
import { memo } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DUR, FRAMER_EASE } from '../../lib/motionTokens';
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
  /**
   * Change this value (e.g. a pull-to-refresh tick) to re-trigger the
   * cascade draw even when the ring values are unchanged. ActivityRings is
   * memo'd, so a stable parent must bump this to replay the animation.
   */
  trigger?: number | string;
}

// ── Shared cascade timing (single source of truth) ───────────────────────────
// Imported by the Dashboard legend count-ups so each ring + its matching number
// START and FINISH together. Outer ring leads; inner rings follow by RING_STAGGER.
// Total ≈ (n-1)*RING_STAGGER + RING_DRAW_DURATION → ~1.1s for 3 rings.
export const RING_STAGGER = 0.28;
export const RING_DRAW_DURATION = 0.55;
/** Start delay (seconds) for ring index `i`, outer (0) → inner. */
export const ringDelay = (index: number): number => index * RING_STAGGER;

const NO_GLOW = 'drop-shadow(0 0 0 transparent)';

/** True percent, unclamped — for aria + over-achievement overflow. */
function truePct(value: number, max: number): number {
  if (max <= 0) return 0;
  const pct = (value / max) * 100;
  if (Number.isNaN(pct) || pct < 0) return 0;
  return pct;
}

function progressClass(variant: RingVariant | undefined): string {
  if (!variant || variant === 'accent') return 'ring-progress';
  return `ring-progress ${variant}`;
}

function variantColor(variant: RingVariant | undefined): string {
  return variant === 'signal'
    ? 'var(--fs-signal)'
    : variant === 'warn'
      ? 'var(--fs-warn)'
      : 'var(--fs-accent)';
}

export const ActivityRings = memo(function ActivityRings({
  rings,
  size = 160,
  gap = 6,
  trigger,
}: ActivityRingsProps) {
  const reduced = useReducedMotion();

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
        .map((ring) => `${ring.label} ${Math.round(truePct(ring.value, ring.max))}%`)
        .join(', ')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {rings.map((ring, index) => {
          const radius = (size - strokeWidth) / 2 - index * ringStep;
          if (radius <= 0) return null;

          const circumference = 2 * Math.PI * radius;
          const percentage = truePct(ring.value, ring.max);
          const basePct = Math.min(100, percentage);
          const overPct = Math.min(100, Math.max(0, percentage - 100));
          const dashOffset = circumference * (1 - basePct / 100);
          const overflowOffset = circumference * (1 - overPct / 100);
          const tipAngle = -90 + (basePct / 100) * 360;
          const color = variantColor(ring.variant);
          const delay = ringDelay(index);
          const goalMet = basePct >= 100;
          const finish = delay + RING_DRAW_DURATION;
          // Remounting on value/trigger changes intentionally replays the former
          // GSAP timeline. The key also makes a reduced-motion preference change
          // snap cleanly to the final SVG state instead of finishing a prior run.
          const animationKey = `${ring.label}-${index}-${ring.value}-${ring.max}-${ring.variant ?? 'accent'}-${trigger ?? 'initial'}-${reduced ? 'reduced' : 'motion'}`;

          return (
            <m.g
              key={animationKey}
              initial={reduced || !goalMet ? false : { scale: 1 }}
              animate={reduced || !goalMet ? { scale: 1 } : { scale: [1, 1.07, 1] }}
              transition={
                reduced || !goalMet
                  ? { duration: 0 }
                  : {
                      duration: DUR.micro * 2,
                      delay: finish,
                      ease: FRAMER_EASE.pop,
                      times: [0, 0.5, 1],
                    }
              }
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <title>{`${ring.label}: ${Math.round(percentage)}%`}</title>
              <circle
                className="ring-track"
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
              />
              <m.circle
                className={progressClass(ring.variant)}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
                initial={reduced ? false : { strokeDashoffset: circumference, filter: NO_GLOW }}
                animate={{
                  strokeDashoffset: dashOffset,
                  filter:
                    reduced || !goalMet
                      ? NO_GLOW
                      : [NO_GLOW, `drop-shadow(0 0 16px ${color})`, NO_GLOW],
                }}
                transition={{
                  strokeDashoffset: reduced
                    ? { duration: 0 }
                    : { duration: RING_DRAW_DURATION, delay, ease: FRAMER_EASE.reveal },
                  filter:
                    reduced || !goalMet
                      ? { duration: 0 }
                      : {
                          duration: DUR.micro * 2,
                          delay: finish,
                          ease: FRAMER_EASE.pop,
                          times: [0, 0.5, 1],
                        },
                }}
                // The legacy CSS transition targets the same SVG property. Framer
                // owns this draw now, so leaving it disabled prevents competing
                // timelines and keeps the original 0.55s / 0.28s cascade exact.
                style={{ transition: 'none' }}
              />
              {/* Over-achievement: a brighter second-lap overlay on the same
                  radius (concentric rings leave no room to inset). */}
              {overPct > 0 && (
                <circle
                  className="ring-overflow"
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={Math.max(3, strokeWidth - 2)}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={overflowOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ filter: `drop-shadow(0 0 9px ${color})`, transition: 'none' }}
                />
              )}
              {/* Leading-edge tip dot — the premium-gauge cue. Static position at
                  the arc end; reduced-motion safe. */}
              {basePct > 0 && (
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
            </m.g>
          );
        })}
      </svg>
    </div>
  );
});
