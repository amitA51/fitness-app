// The running coach's door on /cardio: the next run as the headline and the
// goal underneath, one tap to the full coach screen.

import { ChevronLeft, Footprints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRunningCoach } from '../../../hooks/useRunningCoach';
import { daysLeftText } from './coachFormat';
import './coach.css';

export function CoachHubCard() {
  const navigate = useNavigate();
  const { next, goal, progress } = useRunningCoach();

  let goalLine = 'עוד אין מטרה · הגדירו אחת';
  if (goal && progress?.phase === 'past') goalLine = 'המרוץ עבר — הגדירו מטרה חדשה';
  else if (goal) {
    goalLine =
      progress?.daysLeft !== null && progress?.daysLeft !== undefined
        ? `לקראת ${goal.label} · ${daysLeftText(progress.daysLeft)}`
        : `לקראת ${goal.label}`;
  }

  return (
    <button
      type="button"
      className="choice-row rc-hub focus-ring"
      onClick={() => navigate('/cardio/coach')}
    >
      <span className="choice-row-icon" aria-hidden="true">
        <Footprints size={22} />
      </span>
      <span className="rc-hub-text">
        <span className="rc-hub-kicker">מאמן הריצה</span>
        <span className="rc-hub-title">{next.title}</span>
        <span className="rc-hub-sub">{goalLine}</span>
      </span>
      <ChevronLeft
        size={20}
        aria-hidden="true"
        style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
      />
    </button>
  );
}
