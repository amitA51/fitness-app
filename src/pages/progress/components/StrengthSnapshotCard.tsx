// ============================================================================
// StrengthSnapshotCard — "are my main lifts moving?" on the overview.
// ============================================================================
// Three rows: the exercises trained in the most sessions over the last 8 weeks,
// each with its best estimated 1RM of the last 4 weeks and the change against
// the 4 weeks before that. The number is the protagonist; the exercise name is
// demoted, exactly as in the recent-PR rows above it.
//
// The card claims nothing it cannot support: `strengthSnapshot` returns a null
// delta when there is no earlier window, and this renders NO arrow for it —
// a `0` or a `—` there would read as "no progress" instead of "no data yet".
// Below two training days an exercise never appears, and with no qualifying
// exercise the whole card is absent.
//
// A row is a 44px button that opens that exercise's drill-down — the same
// <ExerciseDetail> surface StrengthSection opens, reached through the existing
// /progress deep-link state (tab + subTab + exercise) the big-three tiles use.

import { TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../../types';
import { zoneColor } from '../../../utils/zoneColor';
import { type StrengthSnapshotEntry, strengthSnapshot } from '../progressMetrics';
import { exerciseLabel } from '../strengthFormat';
import { SectionCard } from './SectionCard';

/** Rows shown — three is the brief: the lifts actually being trained. */
const ROWS = 3;

/** The signed e1RM change, or nothing at all when there is no earlier window. */
function DeltaKg({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  const color = zoneColor(up ? 'good' : 'attention');
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color,
      }}
    >
      <Icon size={11} aria-hidden="true" />
      <span dir="ltr">
        {up ? '+' : '−'}
        {Math.abs(delta)}
      </span>
    </span>
  );
}

/** Hebrew aria text for a row: the lift, its number, and the change. */
function rowLabel(entry: StrengthSnapshotEntry): string {
  const name = exerciseLabel(entry.exerciseName);
  const base = `${name}. אחד חזרה מרבי משוער ${entry.e1RM} קילוגרם`;
  if (entry.delta === null || entry.delta === 0) return `${base}. פתיחת פירוט`;
  const dir = entry.delta > 0 ? 'עלייה' : 'ירידה';
  return `${base}. ${dir} של ${Math.abs(entry.delta)} קילוגרם מול ארבעת השבועות שקדמו. פתיחת פירוט`;
}

export const StrengthSnapshotCard = memo(function StrengthSnapshotCard({
  sessions,
}: {
  /** Already filtered to completed sessions by the page. */
  sessions: WorkoutSession[];
}) {
  const navigate = useNavigate();
  const entries = useMemo(() => strengthSnapshot(sessions, ROWS), [sessions]);

  if (entries.length === 0) return null;

  return (
    <SectionCard>
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          הכי מאומנים · 1RM משוער
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {entries.map((entry) => (
          <button
            key={entry.exerciseName}
            type="button"
            className="focus-ring active:scale-[0.99] motion-reduce:active:scale-100"
            aria-label={rowLabel(entry)}
            onClick={() =>
              navigate('/progress', {
                state: { tab: 'workouts', subTab: 'strength', exercise: entry.exerciseName },
              })
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              minHeight: 44,
              padding: '8px 12px',
              background: 'var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'start',
              transition: 'transform 0.15s var(--ease-out, ease-out)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--fs-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {exerciseLabel(entry.exerciseName)}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
              <DeltaKg delta={entry.delta} />
              <span
                className="kinetic-number"
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 22,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'var(--fs-ink)',
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
                  letterSpacing: '-0.01em',
                }}
              >
                ק"ג
              </span>
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
});

export default StrengthSnapshotCard;
