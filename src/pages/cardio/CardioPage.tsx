// ============================================================================
// CardioPage (/cardio) — pick an activity, then start live or log it.
// ============================================================================
// One screen, two exits: "התחילו עכשיו" opens the live tracker (timer, and GPS
// for outdoor activities), "רשמו פעילות שכבר עשיתם" opens the log form. The
// activity picked last time is preselected, so a regular runner taps once.

import { ChevronLeft, Play } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityIcon } from '../../components/cardio/ActivityIcon';
import PageHeader from '../../components/ui/PageHeader';
import { useData } from '../../contexts/DataContext';
import type { CardioActivity } from '../../types';
import {
  CARDIO_ACTIVITIES,
  type CardioGroup,
  UNIT_KM,
  cardioActivityConfig,
  cardioEffortsOf,
  formatKm,
} from '../../utils/cardio';
import { sessionsInWeek, weekStartAt } from '../../utils/trainingWeek';
import { readLastActivity, rememberLastActivity } from './cardioPrefs';
import { pendingLiveActivity } from './live/useLiveTracker';
import './cardio.css';

const GROUPS: readonly { id: CardioGroup; title: string }[] = [
  { id: 'outdoor', title: 'בחוץ' },
  { id: 'gym', title: 'בחדר הכושר' },
  { id: 'other', title: 'עוד' },
];

/** Cardio done this week: distance + number of efforts. */
function useWeekCardio(): { distanceKm: number; count: number } {
  const { sessions } = useData();
  return useMemo(() => {
    let distanceKm = 0;
    let count = 0;
    for (const s of sessionsInWeek(sessions, weekStartAt(new Date()))) {
      for (const e of cardioEffortsOf(s)) {
        distanceKm += e.distanceKm;
        count += 1;
      }
    }
    return { distanceKm, count };
  }, [sessions]);
}

export default function CardioPage() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<CardioActivity>(readLastActivity);
  const week = useWeekCardio();
  const [pending] = useState(pendingLiveActivity);

  const choose = useCallback((id: CardioActivity) => {
    setActivity(id);
    rememberLastActivity(id);
  }, []);

  const goBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (idx && idx > 0) navigate(-1);
    else navigate('/');
  }, [navigate]);

  const eyebrow =
    week.count > 0 ? (
      <span>
        השבוע: <span className="kinetic-number">{formatKm(week.distanceKm)}</span> {UNIT_KM} ·{' '}
        <span className="kinetic-number">{week.count}</span>{' '}
        {week.count === 1 ? 'פעילות' : 'פעילויות'}
      </span>
    ) : (
      'בחרו פעילות'
    );

  return (
    <div style={{ background: 'var(--fs-bg)', minHeight: '100%' }} dir="rtl">
      <PageHeader title="ריצה ואירובי" eyebrow={eyebrow} onBack={goBack} />

      <div className="page-shell" style={{ paddingTop: 16, paddingBottom: 0 }}>
        <div className="page-stack">
          {pending && (
            <button
              type="button"
              className="choice-row focus-ring"
              data-accent="true"
              onClick={() => navigate(`/cardio/live?activity=${pending}`)}
            >
              <span className="choice-row-icon" aria-hidden="true">
                <ActivityIcon activity={pending} />
              </span>
              <span style={{ flex: 1, display: 'grid', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 17 }}>יש אימון פעיל</span>
                <span style={{ fontSize: 14, color: 'var(--fs-muted)' }}>
                  {cardioActivityConfig(pending).label} · לחצו כדי להמשיך או לסיים
                </span>
              </span>
              <ChevronLeft size={20} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
            </button>
          )}
          {GROUPS.map((group) => (
            <section
              key={group.id}
              className="cardio-group"
              aria-labelledby={`cardio-g-${group.id}`}
            >
              <h2 id={`cardio-g-${group.id}`} className="cardio-group-title">
                {group.title}
              </h2>
              <div className="cardio-grid">
                {CARDIO_ACTIVITIES.filter((a) => a.group === group.id).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="cardio-tile focus-ring"
                    aria-pressed={activity === a.id}
                    onClick={() => choose(a.id)}
                  >
                    <span className="cardio-tile-icon">
                      <ActivityIcon activity={a.id} />
                    </span>
                    {a.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="cardio-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="start-workout-btn focus-ring"
            onClick={() => navigate(`/cardio/live?activity=${activity}`)}
          >
            <Play size={20} aria-hidden="true" />
            התחילו עכשיו
          </button>
          <button
            type="button"
            className="cta-secondary focus-ring"
            onClick={() => navigate(`/cardio/log?activity=${activity}`)}
          >
            רשמו פעילות שכבר עשיתם
          </button>
          <button
            type="button"
            className="cta-ghost focus-ring"
            onClick={() => navigate('/progress', { state: { tab: 'workouts', subTab: 'cardio' } })}
          >
            גרפים, שיאים ואזורי דופק
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
