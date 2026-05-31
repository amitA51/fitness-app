import { motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';

interface CalorieHeroProps {
  calories: number;
  goal: number;
  calPct: number;
  coachTarget: boolean;
}

export const CalorieHero = memo(function CalorieHero({
  calories,
  goal,
  calPct,
  coachTarget,
}: CalorieHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="block-hero section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in">
      <span className="ribbon">{calPct}% מהיעד</span>
      <div className="label">נצרך היום</div>
      <div className="number kinetic-number large" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {calories || 0}
      </div>
      <div className="sub">/ {goal} KCAL</div>
      {coachTarget && (
        <span className="chip mt-2" style={{ fontSize: '11px', color: 'var(--fs-accent)' }}>
          יעד מהמאמן
        </span>
      )}
      <div className="mt-4 fs-progress-track" style={{ height: '6px' }}>
        <motion.div
          className="fs-progress-fill"
          style={{ height: '100%', transformOrigin: 'left center' }}
          initial={shouldReduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: calPct / 100 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
});
