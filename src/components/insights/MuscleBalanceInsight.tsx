// ============================================================================
// MuscleBalanceInsight — surfaces the most under-trained muscle group.
// ============================================================================
// Wires the already-computed `calculateMuscleBalance` analytics (previously
// unused by any UI) into an actionable Progress card: it names the muscle group
// receiving the smallest share of recent training volume and nudges the user to
// balance it. Self-hides until there is enough data to be meaningful. Sibling of
// ConsistencyScore / MuscleDistribution — same Card, tokens, and RTL treatment.

import { Scale } from 'lucide-react';
import { memo, useMemo } from 'react';
import { translateMuscle } from '../../constants/muscleNames';
import { calculateMuscleBalance } from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';
import { Card } from '../ui/Card';

export interface MuscleBalanceInsightProps {
  /** Source sessions; filtered to completed internally. */
  sessions: WorkoutSession[];
}

// calculateMuscleBalance splits the window into two halves for trend math, so it
// needs a handful of completed sessions before its "weak" flag means anything.
const MIN_COMPLETED_SESSIONS = 6;
const ANALYSIS_WEEKS = 12;

export const MuscleBalanceInsight = memo(function MuscleBalanceInsight({
  sessions,
}: MuscleBalanceInsightProps) {
  const weakest = useMemo(() => {
    const completedCount = sessions.filter((s) => s.status === 'completed').length;
    if (completedCount < MIN_COMPLETED_SESSIONS) return null;

    const balance = calculateMuscleBalance(sessions, ANALYSIS_WEEKS);
    const weak = balance.filter((m) => m.isWeak && m.percentage > 0);
    if (weak.length === 0) return null;

    // The most under-represented group = smallest share of total volume.
    return weak.reduce((lowest, m) => (m.percentage < lowest.percentage ? m : lowest));
  }, [sessions]);

  if (!weakest) return null;

  const muscleHe = translateMuscle(weakest.muscle);

  return (
    <Card
      variant="elevated"
      asymmetric
      noPadding
      className="magnetic-card glass-surface fs-accent-rail"
      style={{ padding: '16px 18px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Scale size={16} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--fs-ink)',
            }}
          >
            איזון שרירים
          </span>
        </div>
        <span
          className="kinetic-number"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--fs-warn)',
          }}
        >
          {weakest.percentage}%
        </span>
      </div>

      {/* Dash/colon phrasing keeps the copy gender-safe across muscle names
          (e.g. חזה vs רגליים) — no verb to agree with the muscle noun. */}
      <p style={{ fontSize: 13, color: 'var(--fs-ink)', lineHeight: 1.5, margin: 0 }}>
        <strong style={{ fontWeight: 700 }}>{muscleHe}</strong> — הנתח הקטן ביותר מנפח האימון
        בשבועות האחרונים.
      </p>
      <p
        style={{
          fontSize: 12,
          color: 'var(--fs-muted)',
          lineHeight: 1.5,
          marginTop: 6,
          marginBottom: 0,
        }}
      >
        שווה להוסיף ל{muscleHe} עוד סט או תרגיל כדי לאזן את האימון.
      </p>
    </Card>
  );
});

export default MuscleBalanceInsight;
