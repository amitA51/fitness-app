import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { DailyNutritionSummary } from '../../../services/nutritionService';

interface NutritionTrendChartProps {
  summary: DailyNutritionSummary[];
  /** Calorie goal, used to scale bar heights and draw the target line. */
  calorieGoal: number;
}

/**
 * 7-day calories trend with a per-day macro readout. Surfaces
 * getWeeklyNutritionSummary (previously computed but unused) so the user can
 * see the week at a glance alongside the single-day hero.
 */
export const NutritionTrendChart = memo(function NutritionTrendChart({
  summary,
  calorieGoal,
}: NutritionTrendChartProps) {
  const maxCal = useMemo(() => {
    const peak = summary.reduce((m, d) => Math.max(m, d.macros.calories), 0);
    return Math.max(peak, calorieGoal, 1);
  }, [summary, calorieGoal]);

  const avgCal = useMemo(() => {
    const logged = summary.filter((d) => d.mealCount > 0);
    if (logged.length === 0) return 0;
    return Math.round(logged.reduce((s, d) => s + d.macros.calories, 0) / logged.length);
  }, [summary]);

  if (summary.length === 0) return null;

  return (
    <div className="px-5 mt-6">
      <div
        style={{
          border: '2px solid var(--fs-primary)',
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          padding: '18px 16px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2">
            <TrendingUp size={14} />
            מגמת קלוריות · 7 ימים
          </h3>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ממוצע {avgCal} KCAL
          </span>
        </div>
        <div
          className="h-28 flex items-end gap-2"
          role="img"
          aria-label="מגמת צריכת קלוריות - 7 ימים"
        >
          {summary.map((day, i) => {
            const heightPct = Math.max(4, (day.macros.calories / maxCal) * 100);
            const isLast = i === summary.length - 1;
            const overGoal = calorieGoal > 0 && day.macros.calories > calorieGoal;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {day.macros.calories > 0 ? Math.round(day.macros.calories) : ''}
                </span>
                <motion.div
                  className="w-full"
                  style={{
                    backgroundColor: overGoal
                      ? 'var(--fs-warn)'
                      : isLast
                        ? 'var(--fs-accent)'
                        : 'var(--fs-surface-2)',
                    border: isLast ? '2px solid var(--fs-primary)' : 'none',
                    minHeight: 4,
                    height: `${heightPct}%`,
                    transformOrigin: 'bottom center',
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {new Date(day.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="eyebrow" style={{ color: 'var(--fs-muted)', fontSize: '10px' }}>
            יעד {calorieGoal} KCAL · חריגה מסומנת
          </span>
        </div>
      </div>
    </div>
  );
});
