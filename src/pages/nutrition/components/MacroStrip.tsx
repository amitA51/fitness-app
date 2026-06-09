import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '@/lib/gsap';
import { zoneColor } from '@/utils/zoneColor';
import { Beef, Droplets, Wheat } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import type { MacroNutrients } from '../../../types';

interface MacroStripProps {
  todayMacros: MacroNutrients;
  macroGoals: MacroNutrients;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/** Staggered offset (s) between the three bars / count-ups. */
const STAGGER = 0.08;

export const MacroStrip = memo(function MacroStrip({
  todayMacros,
  macroGoals,
  proteinPct,
  carbsPct,
  fatPct,
}: MacroStripProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);

  // One ref per macro (fixed order: protein, carbs, fat) so the hook count is
  // stable. The number counts up to its current gram value on mount/update.
  const proteinNumRef = useRef<HTMLSpanElement>(null);
  const carbsNumRef = useRef<HTMLSpanElement>(null);
  const fatNumRef = useRef<HTMLSpanElement>(null);
  const numRefs = [proteinNumRef, carbsNumRef, fatNumRef];

  useCountUp(proteinNumRef, todayMacros.protein, { delay: 0 });
  useCountUp(carbsNumRef, todayMacros.carbs, { delay: STAGGER });
  useCountUp(fatNumRef, todayMacros.fat, { delay: STAGGER * 2 });

  const macroStrip = useMemo(
    () => [
      {
        label: 'PROTEIN',
        he: 'חלבון',
        icon: <Beef size={12} />,
        cur: todayMacros.protein,
        goal: macroGoals.protein,
        pct: proteinPct,
      },
      {
        label: 'CARBS',
        he: 'פחמימות',
        icon: <Wheat size={12} />,
        cur: todayMacros.carbs,
        goal: macroGoals.carbs,
        pct: carbsPct,
      },
      {
        label: 'FAT',
        he: 'שומן',
        icon: <Droplets size={12} />,
        cur: todayMacros.fat,
        goal: macroGoals.fat,
        pct: fatPct,
      },
    ],
    [
      todayMacros.protein,
      todayMacros.carbs,
      todayMacros.fat,
      macroGoals.protein,
      macroGoals.carbs,
      macroGoals.fat,
      proteinPct,
      carbsPct,
      fatPct,
    ]
  );

  // Bars draw to their value with a staggered scaleX. RTL: transformOrigin is on
  // the logical start edge ('right center' for this dir:'rtl' app) so the fill
  // grows from the right. Reduced motion snaps to the final state.
  useGSAP(
    () => {
      const bars = barRefs.current.filter((b): b is HTMLDivElement => b !== null);
      if (bars.length === 0) return;

      const target = (i: number): number => (macroStrip[i]?.pct ?? 0) / 100;

      if (reduced) {
        bars.forEach((bar, i) => {
          gsap.set(bar, { scaleX: target(i), transformOrigin: 'right center' });
        });
        return;
      }

      gsap.fromTo(
        bars,
        { scaleX: 0, transformOrigin: 'right center' },
        {
          scaleX: (i: number) => target(i),
          duration: DUR.base,
          ease: EASE.reveal,
          stagger: STAGGER,
        }
      );
    },
    { scope: rootRef, dependencies: [proteinPct, carbsPct, fatPct, reduced] }
  );

  return (
    <div
      ref={rootRef}
      className="mx-0"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        border: '2px solid var(--fs-primary)',
        borderTop: 'none',
      }}
    >
      {macroStrip.map((m, i) => {
        // Zone semantics: on-track (at/under goal) = good (accent), OVER = attention
        // (warn) — never lime. The bar fill stays visually clamped (pct caps at
        // 100), but crossing the goal escalates the fill + number to warn so the
        // overshoot isn't invisible. zoneColor is the single status vocabulary.
        const isOver = m.cur > m.goal;
        const zone = isOver ? 'attention' : 'good';
        const tone = zoneColor(zone);
        return (
          <div
            key={m.label}
            className="glass-surface"
            style={{
              background: 'var(--fs-surface)',
              padding: '18px 14px',
              borderInlineStart: i > 0 ? '2px solid var(--fs-primary)' : 'none',
            }}
          >
            <div
              className="flex items-center gap-1 mb-2"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              {m.icon}
              <span>{m.he}</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '32px',
                lineHeight: 0.9,
                color: isOver ? 'var(--fs-warn)' : 'var(--fs-ink)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span ref={numRefs[i]}>{m.cur}</span>
              <em
                style={{
                  fontStyle: 'normal',
                  fontSize: '16px',
                  // accent-2, not accent: mint "G" on the white card is 2.1:1
                  color: 'var(--fs-accent-2)',
                  marginInlineStart: '2px',
                }}
              >
                ג׳
              </em>
            </div>
            <div className="mt-2 fs-progress-track" style={{ height: '4px' }}>
              <div
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className="fs-progress-fill"
                style={{
                  height: '100%',
                  transformOrigin: 'right center',
                  transform: 'scaleX(0)',
                  // Token-bar carries the zone grade: on-track = good (accent,
                  // the .fs-progress-fill default), over = attention (warn).
                  background: isOver ? tone : undefined,
                }}
              />
            </div>
            <div
              className="mt-1"
              dir="ltr"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '11px',
                textAlign: 'start',
                color: isOver ? tone : 'var(--fs-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {m.cur}/{m.goal}
            </div>
          </div>
        );
      })}
    </div>
  );
});
