// One row from the running numbers to the running coach (next run, paces,
// goal). A link, not a card: it shows no numbers of its own.

import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActivityIcon } from '../../../../components/cardio/ActivityIcon';

export function RunningCoachLink() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="choice-row focus-ring"
      onClick={() => navigate('/cardio/coach')}
    >
      <span className="choice-row-icon" aria-hidden="true">
        <ActivityIcon activity="run" />
      </span>
      <span style={{ flex: 1, fontWeight: 600, fontSize: 16, color: 'var(--fs-ink)' }}>
        מאמן הריצה
      </span>
      <ChevronLeft size={20} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
    </button>
  );
}
