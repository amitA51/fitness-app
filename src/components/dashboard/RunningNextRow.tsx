// RunningNextRow — one quiet line on the home screen for runners: the coach's
// next run, one tap from the running coach. Shown only to someone who runs
// (a running goal, or two runs in the last two weeks), so a lifter's home
// stays exactly as it was. The home keeps a single "what's next" block; this
// is a row under it, not a second hero.

import { ChevronLeft } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunningCoach } from '../../hooks/useRunningCoach';
import { daysLeftText } from '../../pages/cardio/coach/coachFormat';
import { ActivityIcon } from '../cardio/ActivityIcon';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RunningNextRow = memo(function RunningNextRow() {
  const navigate = useNavigate();
  const coach = useRunningCoach();
  const now = Date.now();
  const runsLast14 = coach.load.recentRuns.filter((r) => now - r.at <= 14 * DAY_MS).length;
  // A goal whose date has passed no longer earns a place on the home screen.
  const goal = coach.goal && coach.progress?.phase !== 'past' ? coach.goal : null;
  if (!goal && runsLast14 < 2) return null;

  const daysLeft = goal ? coach.progress?.daysLeft : null;
  const goalLine = goal
    ? daysLeft != null
      ? `${goal.label} · ${daysLeftText(daysLeft)}`
      : goal.label
    : 'מאמן הריצה';
  // "היום: מנוחה" already reads as the answer; the rest gets "הריצה הבאה:".
  const nextLine =
    coach.next.kind === 'rest' ? coach.next.title : `הריצה הבאה: ${coach.next.title}`;

  return (
    <button
      type="button"
      className="choice-row focus-ring"
      onClick={() => navigate('/cardio/coach')}
      style={{ marginTop: 12 }}
    >
      <span className="choice-row-icon" aria-hidden="true">
        <ActivityIcon activity="run" />
      </span>
      <span style={{ flex: 1, display: 'grid', gap: 2, textAlign: 'start' }}>
        <span style={{ fontSize: 13, color: 'var(--fs-muted)' }}>{goalLine}</span>
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--fs-ink)' }}>{nextLine}</span>
      </span>
      <ChevronLeft size={20} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
    </button>
  );
});
