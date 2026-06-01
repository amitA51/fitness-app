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
                data-target-offset={dashOffset}
                data-goal-met={pct >= 100 ? '1' : '0'}
                // Disable the CSS stroke-dashoffset transition so GSAP owns the
                // draw and the two don't fight over the same property.
                style={{ transition: 'none' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
});
