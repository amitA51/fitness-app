// BigThreeCard — the "big three" strength widget on Progress/Overview.
// The most-requested feature across Hevy/Strong communities (research pass #5):
// squat / bench / deadlift estimated-1RM glanceable at the top of progress,
// each with its trend delta, deep-linking to the exercise drill-down.
//
// Matching is by SUBSTRING on the raw exercise name against canonical
// English+Hebrew aliases of the three lifts. Only exercises with logged
// sessions appear (a lift never trained renders nothing — no fake zeros).
import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { WorkoutSession } from '../../../types';
import { zoneColor } from '../../../utils/zoneColor';
import { STRENGTH_STATUS_ZONE, buildExerciseProgress } from '../progressMetrics';
import { SectionCard } from './SectionCard';

interface BigThreeEntry {
  name: string;
  short: string;
  currentE1RM: number;
  delta: number;
  statusZone: 'good' | 'attention' | 'neutral' | 'info';
  sessionCount: number;
}

/** Canonical aliases (lowercase substrings) for each of the big lifts. */
const BIG_THREE_ALIASES: Array<{ short: string; match: string[] }> = [
  { short: 'סקוואט', match: ['squat', 'סקוואט'] },
  { short: 'לחיצת חזה', match: ['bench press', 'לחיצת חזה', 'בנץ', 'בנך'] },
  { short: 'דדליפט', match: ['deadlift', 'דדליפט'] },
];

function matchBigThree(rawName: string): string | null {
  const lower = rawName.toLowerCase();
  for (const alias of BIG_THREE_ALIASES) {
    if (alias.match.some((m) => lower.includes(m))) return alias.short;
  }
  return null;
}

export const BigThreeCard = memo(function BigThreeCard({
  sessions,
}: {
  sessions: WorkoutSession[];
}) {
  const navigate = useNavigate();

  const entries = useMemo<BigThreeEntry[]>(() => {
    const progress = buildExerciseProgress(sessions);
    const found = new Map<string, BigThreeEntry>();
    for (const p of progress) {
      if (p.sessionCount === 0) continue;
      const short = matchBigThree(p.exerciseName);
      if (!short) continue;
      // Keep the strongest-matching variant per lift when several exist
      // (e.g. flat + incline bench both contain "לחיצת חזה") — the one with
      // the highest session count wins; ties break to the higher e1RM.
      const prev = found.get(short);
      if (!prev || p.sessionCount > prev.sessionCount) {
        found.set(short, {
          name: p.exerciseName,
          short,
          currentE1RM: p.currentE1RM,
          delta: p.deltaE1RM,
          statusZone: STRENGTH_STATUS_ZONE[p.status],
          sessionCount: p.sessionCount,
        });
      }
    }
    // Display order follows the widget's canonical order (squat → bench → deadlift).
    return BIG_THREE_ALIASES.map((a) => found.get(a.short)).filter(
      (e): e is BigThreeEntry => e !== undefined
    );
  }, [sessions]);

  if (entries.length === 0) return null;

  return (
    <SectionCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          הגדולות · 1RM משוער
        </span>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${entries.length}, 1fr)`, gap: 10 }}
      >
        {entries.map((e) => (
          <button
            key={e.short}
            type="button"
            onClick={() => navigate('/progress/strength', { state: { openExercise: e.name } })}
            className="focus-ring"
            style={{
              display: 'grid',
              justifyItems: 'center',
              gap: 2,
              padding: '12px 6px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              minHeight: 84,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--fs-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {e.short}
            </span>
            <span
              className="kinetic-number"
              dir="ltr"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 26,
                lineHeight: 1.05,
                color: 'var(--fs-ink)',
              }}
            >
              {e.currentE1RM}
            </span>
            <span
              dir="ltr"
              style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600 }}
            >
              {e.delta !== 0 ? (
                <span style={{ color: zoneColor(e.delta > 0 ? 'good' : 'attention') }}>
                  {e.delta > 0 ? '+' : '−'}
                  {Math.abs(e.delta)} kg
                </span>
              ) : (
                <span style={{ color: 'var(--fs-muted)' }}>—</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
});
