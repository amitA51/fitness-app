// ============================================================================
// StrengthSection — the strength sub-area of the Workouts tab.
// ============================================================================
// Refactored from the former standalone StrengthTab. De-densified into three
// clearly delineated, individually-headed cards instead of one long scroll:
//   1. PR board (e1RM leaderboard)
//   2. Exercise analysis — selector chips + the converged GlowAreaChart curve
//   3. Weekly volume forecast for the selected exercise (ForecastChart)
//   4. Per-exercise top-weight history
// The hand-rolled SVG line chart is gone; trends use the shared GlowAreaChart
// (the single chart style across Progress). PR math is the e1RM definition from
// progressMetrics, shared with Overview — no duplicate sparkline logic.

import { Dumbbell, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import { GlowAreaChart, type GlowAreaPoint } from '../../../components/charts';
import ForecastChart from '../../../components/workout/ForecastChart';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { SectionCard } from '../components/SectionCard';
import { buildPRBoard, buildStrengthCurves } from '../progressMetrics';

const exerciseLabel = (raw: string): string => raw.split('|')[0]?.trim() || raw;

const cardHeader: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.15em',
  color: 'var(--fs-muted)',
  textTransform: 'uppercase',
};

export const StrengthSection = memo(function StrengthSection({
  sessions,
  prs,
}: {
  // Already status-filtered to completed by the parent (single data source).
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
}) {
  const curves = useMemo(() => buildStrengthCurves(sessions), [sessions]);
  const prBoard = useMemo(() => buildPRBoard(prs), [prs]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExercise((prev) => prev ?? (curves.length > 0 ? curves[0]!.exerciseName : null));
  }, [curves]);

  const activeCurve = curves.find((c) => c.exerciseName === selectedExercise);

  const curvePoints = useMemo<GlowAreaPoint[]>(
    () =>
      activeCurve
        ? activeCurve.data.map((point) => ({
            x: new Date(point.date).toLocaleDateString('he-IL', {
              day: 'numeric',
              month: 'numeric',
            }),
            y: point.value,
          }))
        : [],
    [activeCurve]
  );

  if (curves.length === 0 && prBoard.length === 0) {
    return (
      <SectionCard rail={false} style={{ padding: 20 }}>
        <div className="flex flex-col items-center py-12 text-center gap-3">
          <Dumbbell size={36} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            אין נתוני כוח עדיין
          </p>
          <p style={{ ...cardHeader, fontSize: 11 }}>השלם אימונים כדי לעקוב אחר התקדמות הכוח</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Section 1: PR leaderboard (e1RM) ─────────────────────────────── */}
      {prBoard.length > 0 && (
        <SectionCard rail={false} style={{ padding: '16px 20px' }}>
          <h3 style={{ ...cardHeader, marginBottom: 12 }}>לוח שיאים · PR BOARD (1RM)</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {prBoard.slice(0, 6).map((entry, i) => (
              <div
                key={entry.exerciseName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background:
                    i === 0
                      ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
                      : 'var(--fs-surface-2)',
                  borderRadius: 10,
                  borderInlineStart: i === 0 ? '3px solid var(--fs-accent)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 800,
                      color: i === 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                      width: 20,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    className="line-clamp-1"
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {exerciseLabel(entry.exerciseName)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 18,
                      color: 'var(--fs-ink)',
                      direction: 'ltr',
                    }}
                  >
                    {entry.e1RM}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fs-muted)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    1RM
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--fs-muted)',
                      letterSpacing: '0.04em',
                      marginInlineStart: 4,
                      direction: 'ltr',
                    }}
                  >
                    {entry.weight}×{entry.reps}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Section 2: Exercise analysis — selector + curve ──────────────── */}
      {curves.length > 0 && activeCurve && (
        <SectionCard rail={false} style={{ padding: '16px 20px' }}>
          <h3 style={{ ...cardHeader, marginBottom: 12 }}>ניתוח תרגיל · עקומת כוח</h3>

          {/* Exercise selector */}
          <div
            className="flex gap-2 flex-wrap"
            role="tablist"
            aria-label="בחירת תרגיל"
            style={{ marginBottom: 16 }}
          >
            {curves.slice(0, 8).map((curve) => {
              const active = selectedExercise === curve.exerciseName;
              return (
                <button
                  type="button"
                  key={curve.exerciseName}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedExercise(curve.exerciseName)}
                  className="chip"
                  style={{
                    minHeight: 44,
                    background: active ? 'var(--fs-signal)' : 'var(--fs-surface-2)',
                    color: active ? 'var(--fs-primary)' : 'var(--fs-ink)',
                    borderColor: active ? 'var(--fs-primary)' : 'transparent',
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-hebrew)', fontSize: 13, fontWeight: 600 }}>
                    {exerciseLabel(curve.exerciseName)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hero stat: latest top weight + change */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 44,
                color: 'var(--fs-ink)',
                lineHeight: 0.9,
                direction: 'ltr',
              }}
            >
              {activeCurve.latestWeight}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fs-muted)',
                  marginInlineStart: 6,
                  letterSpacing: '0.12em',
                }}
              >
                KG
              </span>
            </div>
            {activeCurve.change !== 0 && (
              <div
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  background: activeCurve.change > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                  color: activeCurve.change > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  direction: 'ltr',
                }}
              >
                {activeCurve.change > 0 ? (
                  <TrendingUp size={11} aria-hidden="true" />
                ) : (
                  <TrendingDown size={11} aria-hidden="true" />
                )}
                {activeCurve.change > 0 ? '+' : ''}
                {activeCurve.change}KG ({activeCurve.changePct > 0 ? '+' : ''}
                {activeCurve.changePct}%)
              </div>
            )}
          </div>

          {/* Converged trend chart */}
          {curvePoints.length >= 2 ? (
            <GlowAreaChart
              data={curvePoints}
              height={170}
              xAxis
              yAxis
              ariaLabel={`עקומת כוח ל${exerciseLabel(activeCurve.exerciseName)}`}
            />
          ) : (
            <p style={{ ...cardHeader, fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
              צריך לפחות שתי נקודות מידע לעקומה
            </p>
          )}
        </SectionCard>
      )}

      {/* ── Section 3: Weekly volume forecast for the selected exercise ───── */}
      {/* Follows the SAME chip selection as the analysis card — no second
          selector. Weekly actuals + a clearly-labeled next-week projection. */}
      {activeCurve && (
        <ForecastChart
          sessions={sessions}
          exerciseName={activeCurve.exerciseName}
          exerciseLabel={exerciseLabel(activeCurve.exerciseName)}
        />
      )}

      {/* ── Section 4: Per-exercise top-weight history ───────────────────── */}
      {activeCurve && activeCurve.data.length > 0 && (
        <SectionCard rail={false} style={{ padding: '16px 20px' }}>
          <h3 style={{ ...cardHeader, marginBottom: 12 }}>
            היסטוריית משקל · {exerciseLabel(activeCurve.exerciseName)}
          </h3>
          <div className="space-y-1">
            {activeCurve.data
              .slice()
              .reverse()
              .slice(0, 10)
              .map((point, i) => {
                const prevPoint = activeCurve.data[activeCurve.data.length - 1 - i - 1];
                const diff = prevPoint ? point.value - prevPoint.value : null;
                return (
                  <div
                    key={point.date}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
                  >
                    <span style={{ color: 'var(--fs-muted)', fontSize: 13 }}>
                      {new Date(point.date).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      {diff !== null && diff !== 0 && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: diff > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                            background: diff > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                            padding: '2px 8px',
                            direction: 'ltr',
                          }}
                        >
                          {diff > 0 ? '+' : ''}
                          {diff}
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 18,
                          color: 'var(--fs-ink)',
                          direction: 'ltr',
                        }}
                      >
                        {point.value}
                      </span>
                      <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
                        KG
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}
    </div>
  );
});

export default StrengthSection;
