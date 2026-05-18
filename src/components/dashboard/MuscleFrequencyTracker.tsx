import { memo, useMemo } from 'react';
import { AnimatedBar, GradientSparkline } from '../charts';
import type { WorkoutSession } from '../../types';

interface MuscleFrequencyProps {
  sessions: WorkoutSession[];
}

interface MuscleDay {
  muscle: string;
  daysSince: number;
  sessions: number;
}

const MUSCLE_LABELS: Record<string, string> = {
  Chest: 'חזה',
  Back: 'גב',
  Shoulders: 'כתפיים',
  Legs: 'רגליים',
  Quads: 'ארבע-ראשי',
  Hamstrings: 'ירך אחורית',
  Glutes: 'עכוז',
  Calves: 'תאומים',
  Biceps: 'ביצפס',
  Triceps: 'טריצפס',
  Core: 'בטן',
  Cardio: 'אירובי',
};

const MUSCLE_ORDER = ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Core'];

export const MuscleFrequencyTracker = memo(function MuscleFrequencyTracker({
  sessions,
}: MuscleFrequencyProps) {
  const muscleData = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;

    const muscleDays = new Map<string, { lastDate: number; count: number }>();

    sessions
      .filter((s) => s.status === 'completed' && new Date(s.startTime).getTime() >= thirtyDaysAgo)
      .forEach((session) => {
        const musclesSeen = new Set<string>();
        session.exercises?.forEach((ex) => {
          const muscle = ex.muscleGroup;
          if (muscle && !musclesSeen.has(muscle)) {
            musclesSeen.add(muscle);
            const sessionDate = new Date(session.startTime).getTime();
            const entry = muscleDays.get(muscle);
            if (!entry) {
              muscleDays.set(muscle, { lastDate: sessionDate, count: 1 });
            } else {
              entry.count++;
              if (sessionDate > entry.lastDate) entry.lastDate = sessionDate;
            }
          }
        });
      });

    const results: MuscleDay[] = [];
    for (const [muscle, data] of muscleDays) {
      const daysSince = Math.floor((now - data.lastDate) / 86400000);
      results.push({ muscle, daysSince, sessions: data.count });
    }

    return results.sort((a, b) => {
      const aIdx = MUSCLE_ORDER.indexOf(a.muscle);
      const bIdx = MUSCLE_ORDER.indexOf(b.muscle);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
  }, [sessions]);

  // 7-day frequency overview for sparkline
  const last7DaysFrequency = useMemo<number[]>(() => {
    const now = new Date();
    const buckets: number[] = new Array(7).fill(0);
    const startTs = new Date(now);
    startTs.setHours(0, 0, 0, 0);
    startTs.setDate(startTs.getDate() - 6);
    const startMs = startTs.getTime();

    sessions
      .filter((s) => s.status === 'completed')
      .forEach((session) => {
        const dt = new Date(session.startTime).getTime();
        if (dt < startMs) return;
        const dayIdx = Math.floor((dt - startMs) / 86400000);
        if (dayIdx >= 0 && dayIdx < 7) {
          buckets[dayIdx] = (buckets[dayIdx] ?? 0) + (session.exercises?.length ?? 0);
        }
      });
    return buckets;
  }, [sessions]);

  if (muscleData.length === 0) return null;

  const hasSparklineData = last7DaysFrequency.some((v) => v > 0);

  return (
    <div
      className="fs-accent-rail magnetic-card"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          § MUSCLE BALANCE · 30D
        </span>
        {hasSparklineData && (
          <GradientSparkline
            data={last7DaysFrequency}
            width={120}
            height={28}
            ariaLabel="תדירות אימונים 7 ימים"
          />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {muscleData.slice(0, 7).map((m) => {
          const label = MUSCLE_LABELS[m.muscle] ?? m.muscle;
          const maxSessions = Math.max(...muscleData.map((x) => x.sessions), 1);
          const pct = Math.round((m.sessions / maxSessions) * 100);
          const isOverdue = m.daysSince >= 5;
          const freshnessColor =
            m.daysSince <= 2
              ? 'var(--fs-accent)'
              : m.daysSince <= 4
                ? 'var(--fs-accent)'
                : 'var(--fs-warn)';

          return (
            <div key={m.muscle} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: freshnessColor,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {m.daysSince === 0 ? 'היום' : `${m.daysSince}d`}
                  </span>
                  {isOverdue && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--fs-warn)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      !
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {m.sessions}×
                  </span>
                </div>
              </div>
              <AnimatedBar
                value={pct}
                accent={isOverdue ? 'var(--fs-warn)' : 'var(--fs-accent)'}
                pulseOnComplete={pct >= 100}
                ariaLabel={`${label} ${pct}%`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
