import { BarChart3, Dumbbell, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { getWorkoutSessions } from '../../../services/dataService';
import { setVolume } from '../../../utils/workoutMath';
import type { ExerciseStrengthCurve, StrengthDataPoint } from '../types';

export const StrengthTab = memo(function StrengthTab() {
  const [curves, setCurves] = useState<ExerciseStrengthCurve[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    const loadStrengthData = async () => {
      try {
        setIsLoading(true);
        const sessions = await getWorkoutSessions(100);

        // Build a map of exercise name -> array of {date, maxWeight x reps (volume per set)}
        const exerciseMap = new Map<string, StrengthDataPoint[]>();

        for (const session of sessions) {
          if (session.status !== 'completed') continue;
          const date = session.date || session.startTime?.slice(0, 10);
          if (!date) continue;

          for (const exercise of session.exercises) {
            const name = exercise.exerciseName || exercise.name;
            if (!name) continue;

            // Find the best set (highest weight x reps) for this exercise in this session
            let bestWeight = 0;
            let bestVolume = 0;
            for (const set of exercise.sets || []) {
              if (!set.isCompleted) continue;
              const vol = setVolume(set);
              if (vol > bestVolume) {
                bestVolume = vol;
                bestWeight = set.weight || 0;
              }
            }

            if (bestVolume === 0) continue;

            const existing = exerciseMap.get(name) || [];
            existing.push({ date, value: bestWeight, volume: bestVolume });
            exerciseMap.set(name, existing);
          }
        }

        // Convert to curves and compute changes
        const result: ExerciseStrengthCurve[] = [];
        for (const [name, points] of exerciseMap.entries()) {
          // Sort by date ascending
          points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Deduplicate: keep best per date
          const deduped = new Map<string, StrengthDataPoint>();
          for (const p of points) {
            const existing = deduped.get(p.date);
            if (!existing || p.value > existing.value) {
              deduped.set(p.date, p);
            }
          }
          const uniquePoints = [...deduped.values()];

          if (uniquePoints.length < 2) continue;

          const latest = uniquePoints[uniquePoints.length - 1]!;
          const earliest = uniquePoints[0]!;
          const change = latest.value - earliest.value;
          const changePct = earliest.value > 0 ? Math.round((change / earliest.value) * 100) : 0;

          result.push({
            exerciseName: name,
            data: uniquePoints.slice(-15), // last 15 data points
            latestWeight: latest.value,
            change,
            changePct,
          });
        }

        // Sort by number of data points (most tracked first)
        result.sort((a, b) => b.data.length - a.data.length);
        setCurves(result);
        setSelectedExercise((prev) => prev ?? (result.length > 0 ? result[0]!.exerciseName : null));
      } finally {
        setIsLoading(false);
      }
    };
    loadStrengthData();
  }, []);

  const activeCurve = curves.find((c) => c.exerciseName === selectedExercise);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
          <span className="left">§04 · STRENGTH</span>
          <span className="right">כוח</span>
        </div>
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--fs-signal)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      </div>
    );
  }

  if (curves.length === 0) {
    return (
      <div className="space-y-4">
        <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
          <span className="left">§04 · STRENGTH</span>
          <span className="right">כוח</span>
        </div>
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex flex-col items-center py-12 text-center gap-3">
            <Dumbbell size={36} style={{ color: 'var(--fs-muted)' }} />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              אין נתוני כוח עדיין
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              COMPLETE WORKOUTS TO TRACK STRENGTH PROGRESS
            </p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = activeCurve ? Math.max(...activeCurve.data.map((d) => d.value), 1) : 1;
  const minValue = activeCurve ? Math.min(...activeCurve.data.map((d) => d.value)) : 0;
  const range = maxValue - minValue || 1;

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§04 · STRENGTH</span>
        <span className="right">כוח</span>
      </div>

      {/* PR Leaderboard */}
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '16px 20px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          לוח שיאים · PR BOARD
        </h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {curves.slice(0, 6).map((curve, i) => (
            <div
              key={curve.exerciseName}
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
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {curve.exerciseName.split('|')[0]?.trim() || curve.exerciseName}
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
                  {curve.latestWeight}
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
                  KG
                </span>
                {curve.change > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fs-accent)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    +{curve.changePct}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise selector */}
      <div className="flex gap-2 flex-wrap">
        {curves.slice(0, 8).map((curve) => (
          <button
            type="button"
            key={curve.exerciseName}
            onClick={() => setSelectedExercise(curve.exerciseName)}
            className="chip"
            style={{
              background:
                selectedExercise === curve.exerciseName
                  ? 'var(--fs-signal)'
                  : 'var(--fs-surface-2)',
              color:
                selectedExercise === curve.exerciseName ? 'var(--fs-primary)' : 'var(--fs-ink)',
              borderColor:
                selectedExercise === curve.exerciseName ? 'var(--fs-primary)' : 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <span style={{ fontFamily: 'var(--font-hebrew)', fontSize: '13px', fontWeight: 600 }}>
              {curve.exerciseName.split('|')[0]?.trim() || curve.exerciseName}
            </span>
          </button>
        ))}
      </div>

      {/* Active exercise curve */}
      {activeCurve && (
        <>
          {/* Hero stat */}
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
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              משקל מקסימלי · TOP WEIGHT
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
              {activeCurve.latestWeight}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                letterSpacing: '0.12em',
              }}
            >
              KG
            </div>
            {activeCurve.change !== 0 && (
              <div
                className="mt-3 inline-flex items-center gap-1.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  background: activeCurve.change > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                  color: activeCurve.change > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                  padding: '4px 10px',
                }}
              >
                {activeCurve.change > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {activeCurve.change > 0 ? '+' : ''}
                {activeCurve.change}KG ({activeCurve.changePct > 0 ? '+' : ''}
                {activeCurve.changePct}%)
              </div>
            )}
          </div>

          {/* Line chart */}
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
                <BarChart3 size={14} />§ STRENGTH CURVE
              </h3>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.12em',
                }}
              >
                {activeCurve.data.length} DATA POINTS
              </span>
            </div>

            {/* SVG Line Chart */}
            <div className="relative" style={{ height: '160px' }}>
              <svg
                viewBox="0 0 300 140"
                className="w-full h-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1="0"
                    y1={140 - pct * 120}
                    x2="300"
                    y2={140 - pct * 120}
                    stroke="var(--fs-surface-2)"
                    strokeWidth="1"
                  />
                ))}

                {/* Area fill */}
                <path
                  d={`${activeCurve.data
                    .map((point, i) => {
                      const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                      const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')} L 300 140 L 0 140 Z`}
                  fill="color-mix(in srgb, var(--fs-accent) 10%, transparent)"
                />

                {/* Line */}
                <path
                  d={activeCurve.data
                    .map((point, i) => {
                      const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                      const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="var(--fs-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots */}
                {activeCurve.data.map((point, i) => {
                  const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                  const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                  const isLast = i === activeCurve.data.length - 1;
                  return (
                    <g key={point.date}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isLast ? 5 : 3}
                        fill={isLast ? 'var(--fs-accent)' : 'var(--fs-primary)'}
                        stroke={isLast ? 'var(--fs-primary)' : 'var(--fs-accent)'}
                        strokeWidth={isLast ? 2 : 1}
                      />
                      {isLast && (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fill="var(--fs-accent)"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            fontWeight: 700,
                          }}
                        >
                          {point.value}kg
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Date labels */}
            <div className="flex justify-between mt-2">
              {activeCurve.data.length > 0 && (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {new Date(activeCurve.data[0]!.date).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {new Date(
                      activeCurve.data[activeCurve.data.length - 1]!.date
                    ).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Session-by-session detail */}
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
            <h3
              className="section-title mb-3"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              § HISTORY · היסטוריית משקל
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
                              fontSize: '11px',
                              color: diff > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                              background: diff > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                              padding: '2px 8px',
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
                            fontSize: '18px',
                            color: 'var(--fs-ink)',
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
          </div>
        </>
      )}
    </div>
  );
});
