import { memo, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '../../lib/gsap';
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
export const ringDelay = (i: number): number => i * RING_STAGGER;

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

function glowColor(el: Element): string {
  if (el.classList.contains('signal')) return 'var(--fs-signal)';
  if (el.classList.contains('warn')) return 'var(--fs-warn)';
  return 'var(--fs-accent)';
}

export const ActivityRings = memo(function ActivityRings({
  rings,
  size = 160,
  gap = 6,
  trigger,
}: ActivityRingsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = Math.max(6, Math.round(size * 0.085));
  // Outer ring starts at outermost radius, inner rings progressively smaller.
  const ringStep = strokeWidth + gap;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const progressEls = gsap.utils.toArray<SVGCircleElement>('.ring-progress', root);
      if (progressEls.length === 0) return;

      // Reduced motion: snap to final state, no draw / pulse / glow.
      if (reduced) {
        for (const el of progressEls) {
          const target = Number(el.dataset.targetOffset ?? '0');
          gsap.set(el, { strokeDashoffset: target });
        }
        return;
      }

      const tl = gsap.timeline();

      progressEls.forEach((el, i) => {
        const circumference = Number(el.getAttribute('stroke-dasharray') ?? '0');
        const target = Number(el.dataset.targetOffset ?? '0');
        const start = ringDelay(i);

        // Start empty, then draw to target — outer leads, inner trails.
        gsap.set(el, { strokeDashoffset: circumference });
        tl.to(
          el,
          {
            strokeDashoffset: target,
            duration: RING_DRAW_DURATION,
            ease: EASE.reveal,
          },
          start
        );

        // Goal met → single back.out scale + glow pulse the instant it closes.
        if (el.dataset.goalMet === '1') {
          const finish = start + RING_DRAW_DURATION;
          const group = el.parentElement;
          if (group) {
            // Pulse the whole group around the SVG centre so the rotated
            // progress arc keeps its own transform untouched.
            tl.fromTo(
              group,
              { scale: 1 },
              {
                scale: 1.07,
                duration: DUR.micro,
                ease: EASE.pop,
                yoyo: true,
                repeat: 1,
                svgOrigin: `${cx} ${cy}`,
              },
              finish
            );
          }
          tl.to(
            el,
            {
              filter: `drop-shadow(0 0 16px ${glowColor(el)})`,
              duration: DUR.micro,
              yoyo: true,
              repeat: 1,
              onComplete: () => {
                gsap.set(el, { clearProps: 'filter' });
              },
            },
            finish
          );
        }
      });
    },
    { scope: rootRef, dependencies: [rings, trigger, reduced] }
  );

  return (
    <div
      ref={rootRef}
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
      aria-label={rings.map((r) => `${r.label} ${Math.round(truePct(r.value, r.max))}%`).join(', ')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {rings.map((ring, i) => {
          const radius = (size - strokeWidth) / 2 - i * ringStep;
          if (radius <= 0) return null;
          const circumference = 2 * Math.PI * radius;
          const tPct = truePct(ring.value, ring.max);
          const basePct = Math.min(100, tPct);
          const overPct = Math.min(100, Math.max(0, tPct - 100));
          const dashOffset = circumference * (1 - basePct / 100);
          const overflowOffset = circumference * (1 - overPct / 100);
          // Tip sits at the arc's end (−90° start + basePct of a full turn).
          const tipAngle = -90 + (basePct / 100) * 360;
          const color = variantColor(ring.variant);
          return (
            <g key={`${ring.label}-${i}`}>
              <title>{`${ring.label}: ${Math.round(tPct)}%`}</title>
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
                data-target-offset={dashOffset}
                data-goal-met={basePct >= 100 ? '1' : '0'}
                // Disable the CSS stroke-dashoffset transition so GSAP owns the
                // draw and the two don't fight over the same property.
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
            </g>
          );
        })}
      </svg>
    </div>
  );
});
