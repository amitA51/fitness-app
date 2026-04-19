import { AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../types';
import { fmtDate, isToday } from '../../utils/dateUtils';

interface RecentWorkoutsProps {
  sessions: WorkoutSession[];
}

export const RecentWorkouts = memo(function RecentWorkouts({ sessions }: RecentWorkoutsProps) {
  const navigate = useNavigate();

  if (sessions.length === 0) {
    return (
      <div className="card-outlined text-center" style={{ padding: '40px 20px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          § no sessions yet
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 28,
            lineHeight: 0.95,
            color: 'var(--navy)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: 16,
          }}
        >
          התחל את האימון הראשון
        </p>
        <button type="button" onClick={() => navigate('/workout')} className="btn-primary w-full">
          התחל עכשיו
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {sessions.map((s) => {
          const vol =
            s.totalVolume >= 1000
              ? `${(s.totalVolume / 1000).toFixed(1)}K`
              : String(s.totalVolume || 0);
          const dateStr = s.date || s.startTime;
          const today = isToday(dateStr);
          const title = s.templateId ? 'אימון מתבנית' : 'אימון חופשי';
          const dur = s.duration ? Math.round(s.duration / 60) : 0;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/history/${s.id}`)}
              className="card-interactive w-full text-right"
              style={{ padding: '14px 16px' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: today ? 'var(--mustard)' : 'var(--stone)',
                  marginBottom: 6,
                }}
              >
                {fmtDate(dateStr)}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 20,
                  lineHeight: 1,
                  color: 'var(--navy)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  marginBottom: 6,
                }}
                className="line-clamp-1"
              >
                {title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink)',
                  letterSpacing: '0.04em',
                }}
              >
                {s.exercises?.length || 0} תרגילים · {vol} ק״ג · {dur}′
              </div>
            </button>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
