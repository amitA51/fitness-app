import { motion } from 'framer-motion';
import { BarChart3, Minus, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { BodyWeightEntry, WeightTrend } from '../../../services/bodyStatsService';

export const WeightTab = memo(function WeightTab({
  latestWeight,
  weightTrend,
  bmi,
  bmiCategory,
  weightEntries,
  onAdd,
}: {
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  weightEntries: BodyWeightEntry[];
  onAdd: () => void;
}) {
  const last7 = useMemo(() => weightEntries.slice(-7), [weightEntries]);
  const maxW = useMemo(() => Math.max(...last7.map((w) => w.weight), 1), [last7]);
  const minW = useMemo(() => Math.min(...last7.map((w) => w.weight)), [last7]);
  const range = useMemo(() => maxW - minW || 1, [maxW, minW]);

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left" />
        <span
          className="right"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--fs-ink)',
          }}
        >
          משקל
        </span>
      </div>

      {/* Hero stat block */}
      {latestWeight ? (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'var(--fs-signal)',
              color: 'var(--fs-heading)',
              padding: '3px 8px',
            }}
          >
            BMI {bmi ?? '—'}
          </span>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              marginTop: 12,
              textTransform: 'uppercase',
            }}
          >
            משקל נוכחי · CURRENT
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 48,
              color: 'var(--fs-ink)',
              lineHeight: 0.9,
              marginTop: 4,
            }}
          >
            {latestWeight.weight}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            KG
          </div>
          {bmiCategory && (
            <div
              className="mt-3 inline-block"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: 'var(--fs-primary)',
                color: 'var(--fs-signal)',
                padding: '4px 10px',
              }}
            >
              {bmiCategory.label}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--fs-muted)' }} />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              עדיין לא תיעדת משקל
            </p>
            <button type="button" onClick={onAdd} className="btn-primary">
              הוסף משקל
            </button>
          </div>
        </div>
      )}

      {/* Trend data strip */}
      {weightTrend && (
        <div className="data-strip">
          <div>
            <div
              className="val"
              style={{
                color: weightTrend.direction === 'ירידה' ? 'var(--fs-primary)' : 'var(--fs-ink)',
              }}
            >
              {weightTrend.change > 0 ? '+' : ''}
              {weightTrend.change}
              <em>KG</em>
            </div>
            <div className="lbl flex items-center gap-1.5">
              {weightTrend.direction === 'עלייה' && <TrendingUp size={11} />}
              {weightTrend.direction === 'ירידה' && <TrendingDown size={11} />}
              {weightTrend.direction === 'יציב' && <Minus size={11} />}
              {weightTrend.direction}
            </div>
          </div>
          <div>
            <div className="val">
              30<em>D</em>
            </div>
            <div className="lbl">TRAILING WINDOW</div>
          </div>
        </div>
      )}

      {/* 7-bar chart */}
      {last7.length > 1 && (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="section-title flex items-center gap-2"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              <BarChart3 size={14} />
              מגמת 7 ימים
            </h3>
          </div>
          <div className="h-28 flex items-end gap-2">
            {last7.map((entry, i) => {
              const heightPct = ((entry.weight - minW) / range) * 65 + 20;
              const isLast = i === last7.length - 1;
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-1.5">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {entry.weight}
                  </span>
                  <motion.div
                    className="w-full"
                    style={{
                      backgroundColor: isLast ? 'var(--fs-signal)' : 'var(--fs-surface-2)',
                      border: isLast ? '2px solid var(--fs-primary)' : 'none',
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
                    {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add weight button */}
      {latestWeight && (
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          הוסף משקל
        </button>
      )}
    </div>
  );
});
