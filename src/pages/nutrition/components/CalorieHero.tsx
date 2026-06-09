import { RingProgress } from '@/components/charts/RingProgress';
import { VerdictLine, VerdictNumber } from '@/components/insights/VerdictLine';
import { useCountUp } from '@/hooks/useCountUp';
import { formatThousands } from '@/lib/gsap';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useRef } from 'react';

interface CalorieHeroProps {
  calories: number;
  goal: number;
  /** Clamped 0–100 percentage (display only — true over/under is derived here). */
  calPct: number;
  coachTarget: boolean;
  onEditGoals: () => void;
}

const RING_SIZE = 184;
const RING_STROKE = 10;

export const CalorieHero = memo(function CalorieHero({
  calories,
  goal,
  calPct,
  coachTarget,
  onEditGoals,
}: CalorieHeroProps) {
  const numberRef = useRef<HTMLSpanElement>(null);

  // calPct arrives pre-clamped to 100. RingProgress wants the TRUE percentage so
  // its over-achievement overlay can render past 100; derive it from raw values.
  const consumed = calories || 0;
  const truePct = goal > 0 ? Math.round((consumed / goal) * 100) : 0;
  const isOver = consumed > goal;
  const remaining = goal - consumed;

  // Zone semantics for calories: under-budget = good (accent), OVER = attention
  // (warn). "near" (≥90% but not over) reads as neutral. Never lime — hitting a
  // calorie target is not a PR. The ring variant maps good/neutral → accent
  // (RingProgress has no 'neutral'); only an overshoot escalates to warn.
  const ringVariant = isOver ? 'warn' : 'accent';

  // Count FROM the previously displayed value (re-tweens on each meal log).
  const prevCaloriesRef = useRef(0);
  useCountUp(numberRef, consumed, {
    from: prevCaloriesRef.current,
    format: formatThousands,
  });
  prevCaloriesRef.current = consumed;

  return (
    <div className="block-hero section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in">
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

      {/* Premium calorie gauge. Pass the TRUE percentage so an overshoot draws
          RingProgress's over-achievement overlay (in warn) instead of silently
          capping at a full accent ring. The kcal protagonist count-up lives in
          the ring center; aria voices the real % on the ring's role="img". */}
      <div className="mx-auto mt-2" style={{ width: RING_SIZE }}>
        <RingProgress
          value={truePct}
          size={RING_SIZE}
          strokeWidth={RING_STROKE}
          variant={ringVariant}
          ariaLabel={`${truePct}% מהיעד הקלורי`}
          centerContent={
            <div className="relative flex flex-col items-center justify-center">
              <span
                ref={numberRef}
                dir="ltr"
                className="number kinetic-number large"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatThousands(consumed)}
              </span>
              {/* dir=ltr: in the RTL page this line bidi-flipped to "KCAL 2500 /". */}
              <span className="sub" dir="ltr">
                / {formatThousands(goal)} KCAL
              </span>
            </div>
          }
        />
      </div>

      {/* Daily takeaway — the stated "so what". Tone is carried only by the
          number's zone: remaining = good (accent), overshoot = attention (warn).
          Gender-neutral phrasing ("נותרו" / "חריגה") so it reads correctly for
          every user. */}
      <VerdictLine
        kicker={isOver ? 'מעל היעד' : 'נותרו להיום'}
        className="mt-3 text-center"
      >
        {isOver ? (
          <>
            חריגה של <VerdictNumber value={Math.abs(remaining)} zone="attention" /> קק״ל מהיעד
          </>
        ) : (
          <>
            נותרו <VerdictNumber value={remaining} zone="good" /> קק״ל להיום
          </>
        )}
      </VerdictLine>

      {coachTarget && (
        <span className="chip mt-2" style={{ fontSize: '11px', color: 'var(--fs-accent)' }}>
          יעד מהמאמן
        </span>
      )}
    </div>
  );
});
