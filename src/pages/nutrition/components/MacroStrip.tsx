import { motion, useReducedMotion } from 'framer-motion';
import { Beef, Droplets, Wheat } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { MacroNutrients } from '../../../types';

interface MacroStripProps {
  todayMacros: MacroNutrients;
  macroGoals: MacroNutrients;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export const MacroStrip = memo(function MacroStrip({
  todayMacros,
  macroGoals,
  proteinPct,
  carbsPct,
  fatPct,
}: MacroStripProps) {
  const shouldReduceMotion = useReducedMotion();

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

  return (
    <div
      className="mx-0"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        border: '2px solid var(--fs-primary)',
        borderTop: 'none',
      }}
    >
      {macroStrip.map((m, i) => (
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
            <span>{m.label}</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '32px',
              lineHeight: 0.9,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {m.cur}
            <em
              style={{
                fontStyle: 'normal',
                fontSize: '16px',
                color: 'var(--fs-accent)',
                marginInlineStart: '2px',
              }}
            >
              G
            </em>
          </div>
          <div className="mt-2 fs-progress-track" style={{ height: '4px' }}>
            <motion.div
              className="fs-progress-fill"
              style={{ height: '100%', transformOrigin: 'left center' }}
              initial={shouldReduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: m.pct / 100 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeOut' }}
            />
          </div>
          <div
            className="mt-1"
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
            }}
          >
            {m.he} · {m.cur}/{m.goal}
          </div>
        </div>
      ))}
    </div>
  );
});
