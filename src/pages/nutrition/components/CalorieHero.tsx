import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, formatThousands, gsap, useGSAP } from '@/lib/gsap';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';

interface CalorieHeroProps {
  calories: number;
  goal: number;
  calPct: number;
  coachTarget: boolean;
  onEditGoals: () => void;
}

// Ring geometry. Radial → RTL-neutral (no x-mirroring needed). The ring is
// rotated -90deg so progress sweeps from 12 o'clock; strokeDashoffset is
// hand-rolled (no DrawSVG) and locked to the count-up via identical timing.
const RING_SIZE = 184;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const CalorieHero = memo(function CalorieHero({
  calories,
  goal,
  calPct,
  coachTarget,
  onEditGoals,
}: CalorieHeroProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  // Count FROM the previously displayed value (re-tweens on each meal log),
  // else 0 on first mount. Plain useEffect runs AFTER useCountUp's layout
  // effect, so `from` is read at render time as the prior committed value.
  const prevCaloriesRef = useRef(0);
  const isOver = calPct > 100;
  const fraction = Math.min(Math.max(calPct, 0), 100) / 100;
  const targetOffset = RING_CIRCUMFERENCE * (1 - fraction);

  // Number count-up — same DUR.slow as the ring so they finish together.
  useCountUp(numberRef, calories, {
    duration: DUR.slow,
    ease: EASE.out,
    from: prevCaloriesRef.current,
    format: formatThousands,
  });

  // Ring draw — synchronized with the count-up (identical duration/ease/start).
  useGSAP(
    () => {
      const ring = ringRef.current;
      if (!ring) return;

      if (reduced) {
        // Reduced motion: snap to final, no draw.
        gsap.set(ring, { strokeDashoffset: targetOffset });
        return;
      }

      // Animate from current fill → target so re-tweens grow smoothly (first
      // mount starts from the empty attribute fallback = full circumference).
      gsap.to(ring, {
        strokeDashoffset: targetOffset,
        duration: DUR.slow,
        ease: EASE.out,
      });
    },
    { dependencies: [targetOffset, reduced], scope: rootRef }
  );

  // Remember this render's value for the next re-tween's `from`.
  useEffect(() => {
    prevCaloriesRef.current = calories;
  }, [calories]);

  const ariaValue = Math.round(Math.min(Math.max(calPct, 0), 100));

  return (
    <div
      ref={rootRef}
      className="block-hero section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in"
    >
      <span className="ribbon">{calPct}% מהיעד</span>
      <button
        type="button"
        onClick={onEditGoals}
        className="flex items-center gap-1.5"
        aria-label="ערוך יעדים"
        style={{
          position: 'absolute',
          insetInlineEnd: 16,
          top: 16,
          minHeight: 44,
          padding: '6px 12px',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--fs-surface-2)',
          color: 'var(--fs-ink)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <SlidersHorizontal size={13} aria-hidden="true" />
        ערוך יעדים
      </button>
      <div className="label">נצרך היום</div>

      {/* Circular progress ring wrapping the kcal count-up. role="img" (not
          progressbar) — it's a non-interactive visual; the percentage is voiced
          via aria-label, matching the ActivityRings chart pattern. */}
      <div
        className="relative mx-auto mt-2 flex items-center justify-center"
        style={{ width: RING_SIZE, height: RING_SIZE }}
        role="img"
        aria-label={`${ariaValue}% מהיעד הקלורי`}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--fs-surface-2)"
            strokeWidth={RING_STROKE}
          />
          {/* Progress arc — strokeDashoffset is GSAP-owned (inline style wins
              over these attributes, which serve as SSR/first-paint fallback). */}
          <circle
            ref={ringRef}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={isOver ? 'var(--fs-warn)' : 'var(--fs-accent)'}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE}
            style={{ transition: 'stroke 0.3s ease' }}
          />
        </svg>

        {/* Centered kcal count-up + sub. dir=ltr keeps "2,400" from bidi-flip. */}
        <div className="relative flex flex-col items-center justify-center">
          <div
            dir="ltr"
            className="number kinetic-number large"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span ref={numberRef}>{formatThousands(calories || 0)}</span>
          </div>
          <div className="sub">/ {goal} KCAL</div>
        </div>
      </div>

      {coachTarget && (
        <span className="chip mt-2" style={{ fontSize: '11px', color: 'var(--fs-accent)' }}>
          יעד מהמאמן
        </span>
      )}
    </div>
  );
});
