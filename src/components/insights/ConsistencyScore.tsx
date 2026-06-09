// ============================================================================
// ConsistencyScore — 4-week workout consistency view.
// ============================================================================
// Extracted verbatim (logic-preserving) from the inline Dashboard block so the
// computation + visual live in one reusable, prop-driven place. Shows the
// overall 4-week consistency percentage, a per-week bar visualization, and the
// total session count. Built on the canonical `Card`, token colors only,
// RTL-correct via logical properties.

import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../types';
import { pctToZone, zoneColor } from '../../utils/zoneColor';
import { Card } from '../ui/Card';

export interface ConsistencyScoreProps {
  /** Source sessions; filtered to completed internally. */
  sessions: WorkoutSession[];
}

const WEEK_MS = 7 * 86400000;

interface ConsistencyData {
  /** Number of the last 4 weeks with at least one session. */
  weeksActive: number;
  /** Total completed sessions across the last 4 weeks. */
  totalSessions: number;
  /** weeksActive / 4 as a rounded percentage. */
  consistencyPct: number;
  /** [3 weeks ago, 2 weeks ago, last week, this week]. */
  weekCounts: number[];
}

const computeConsistency = (sessions: WorkoutSession[]): ConsistencyData => {
  const completed = sessions.filter((s) => s.status === 'completed');
  const now = Date.now();
  const weekCounts: number[] = [0, 0, 0, 0];

  for (const s of completed) {
    const diffWeeks = Math.floor((now - new Date(s.startTime).getTime()) / WEEK_MS);
    const idx = 3 - diffWeeks;
    if (idx >= 0 && idx < 4) {
      weekCounts[idx] = (weekCounts[idx] ?? 0) + 1;
    }
  }

  const weeksActive = weekCounts.filter((c) => c > 0).length;
  const totalSessions = weekCounts.reduce((a, b) => a + b, 0);
  const consistencyPct = Math.round((weeksActive / 4) * 100);

  return { weeksActive, totalSessions, consistencyPct, weekCounts };
};

// Zone-graded color: >=75 good (accent) / >=50 neutral (muted) / else attention (warn).
// Mid-tier is muted, NOT lime — --fs-signal is reserved for PR celebration.
const pctColor = (pct: number): string => zoneColor(pctToZone(pct));

const weekLabel = (i: number): string =>
  i === 3 ? 'השבוע' : i === 2 ? 'שבוע שעבר' : `לפני ${3 - i} שבועות`;

export const ConsistencyScore = memo(function ConsistencyScore({
  sessions,
}: ConsistencyScoreProps) {
  const data = useMemo(() => computeConsistency(sessions), [sessions]);

  if (data.totalSessions === 0) return null;

  return (
    <Card
      variant="elevated"
      asymmetric
      noPadding
      className="magnetic-card glass-surface fs-accent-rail"
      style={{ padding: '16px 18px' }}
    >
      {/* Top row: consistency percentage + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--fs-ink)',
          }}
        >
          עקביות 4 שבועות
        </span>
        <span
          className="kinetic-number"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            fontWeight: 800,
            color: pctColor(data.consistencyPct),
          }}
        >
          {data.consistencyPct}%
        </span>
      </div>

      {/* 4-week bar visualization */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {data.weekCounts.map((count, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional 4-week bars, fixed-length array, never reordered
          <div key={i} style={{ textAlign: 'center' }}>
            <div
              style={{
                height: 40,
                background: count > 0 ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: count > 0 ? 1 : 0.3,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: count > 0 ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                }}
              >
                {count}
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fs-muted)',
                marginTop: 4,
                display: 'block',
              }}
            >
              {weekLabel(i)}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom row: total sessions label */}
      <div
        style={{
          marginTop: 12,
          borderTop: '1px solid var(--fs-surface-2)',
          paddingTop: 10,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fs-muted)',
            letterSpacing: '0.04em',
          }}
        >
          סה"כ אימונים (4 שבועות)
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--fs-ink)',
          }}
        >
          {data.totalSessions}
        </span>
      </div>
    </Card>
  );
});

export default ConsistencyScore;
