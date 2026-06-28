// WorkoutCalendar - Fresh Steel / Obsidian
// Dark masthead · surface body · Bricolage display + IBM Plex Mono labels.

import { m } from 'framer-motion';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../types';
import { HEBREW_MONTHS, todayStr } from '../../utils/dateUtils';

interface WorkoutCalendarProps {
  sessions: WorkoutSession[];
}

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const HEBREW_NUMBERS: Record<number, string> = {
  1: 'א',
  2: 'ב',
  3: 'ג',
  4: 'ד',
  5: 'ה',
  6: 'ו',
  7: 'ז',
  8: 'ח',
  9: 'ט',
  10: 'י',
  11: 'י״א',
  12: 'י״ב',
  13: 'י״ג',
  14: 'י״ד',
  15: 'ט״ו',
  16: 'ט״ז',
  17: 'י״ז',
  18: 'י״ח',
  19: 'י״ט',
  20: 'כ',
  21: 'כ״א',
  22: 'כ״ב',
  23: 'כ״ג',
  24: 'כ״ד',
  25: 'כ״ה',
  26: 'כ״ו',
  27: 'כ״ז',
  28: 'כ״ח',
  29: 'כ״ט',
  30: 'ל',
  31: 'ל״א',
};

/**
 * WorkoutCalendar - Fresh Steel / Obsidian calendar heatmap
 */
const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ sessions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const workoutCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((session) => {
      const date = session.date;
      counts[date] = (counts[date] || 0) + 1;
    });
    return counts;
  }, [sessions]);

  // First-session-by-date lookup for click-through navigation
  const firstSessionIdByDay = useMemo(() => {
    const map: Record<string, string> = {};
    // Sort by startTime so "first" is the earliest one of the day
    const sorted = [...sessions].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || '')
    );
    for (const s of sorted) {
      if (s.date && !map[s.date]) map[s.date] = s.id;
    }
    return map;
  }, [sessions]);

  const navigate = useNavigate();

  const maxWorkouts = useMemo(() => {
    return Math.max(1, ...Object.values(workoutCountByDay));
  }, [workoutCountByDay]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days: Array<{ day: number; date: string; isCurrentMonth: boolean }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        date: '',
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        date: dateStr,
        isCurrentMonth: true,
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        date: '',
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Intensity colors — accent/surface gradient
  const getIntensityStyle = (count: number): React.CSSProperties => {
    if (count === 0) {
      return { backgroundColor: 'var(--fs-surface-2)' };
    }

    const intensity = Math.min(count / maxWorkouts, 1);

    return {
      backgroundColor: intensity >= 0.5 ? 'var(--fs-accent)' : 'var(--fs-signal)',
    };
  };

  // Local date (not a UTC ISO slice) so the "today" highlight matches how
  // sessions store their `date` (todayStr) — otherwise it is off-by-one for
  // users ahead of UTC (e.g. Israel) around midnight.
  const today = todayStr();
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Monthly workout count
  const monthlyWorkoutDays = Object.entries(workoutCountByDay).filter(([date]) =>
    date.startsWith(currentMonthStr)
  ).length;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="magnetic-card glass-surface scrim-noise fs-accent-rail"
      style={{
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        padding: 20,
      }}
    >
      {/* Header with navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: 'var(--fs-accent)',
              display: 'block',
            }}
          />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--fs-heading)',
            }}
          >
            לוח אימונים
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={goToPrevMonth}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: '2px solid var(--fs-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--fs-surface-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            aria-label="חודש קודם"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 4L10 8L6 12"
                stroke="var(--fs-primary)"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </button>

          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              color: 'var(--fs-heading)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              minWidth: 140,
              textAlign: 'center',
            }}
          >
            {HEBREW_MONTHS[month]} {year}
          </span>

          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="החודש הבא"
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: '2px solid var(--fs-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--fs-surface-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 4L10 8L6 12"
                stroke="var(--fs-primary)"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 8,
        }}
      >
        {HEBREW_DAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
              padding: '4px 0',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {calendarDays.map((dayData, index) => {
          const count = dayData.date ? workoutCountByDay[dayData.date] || 0 : 0;
          const isToday = dayData.date === today;
          const isCurrentMonth = dayData.isCurrentMonth;

          const sessionId =
            dayData.date && count > 0 ? firstSessionIdByDay[dayData.date] : undefined;
          const navigable = !!sessionId;

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 42-cell month grid, padding cells have no date, never reordered
              key={index}
              role="gridcell"
              tabIndex={navigable ? 0 : -1}
              aria-label={
                dayData.date
                  ? `${dayData.day} ${HEBREW_MONTHS[month]} ${year}${count > 0 ? `, ${count} אימונים` : ''}`
                  : undefined
              }
              aria-current={isToday ? 'date' : undefined}
              onClick={() => {
                if (sessionId) navigate(`/detail/${sessionId}`);
              }}
              onKeyDown={(e) => {
                if (sessionId && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  navigate(`/detail/${sessionId}`);
                }
              }}
              style={{
                aspectRatio: '1',
                minHeight: 32,
                position: 'relative',
                opacity: isCurrentMonth ? 1 : 0.3,
                cursor: navigable ? 'pointer' : isCurrentMonth ? 'default' : 'default',
                border: isToday ? '2px solid var(--fs-accent)' : '2px solid var(--fs-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 150ms ease',
                ...getIntensityStyle(count),
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: count > 0 ? 700 : 400,
                  color: count > 0 ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {HEBREW_NUMBERS[dayData.day] || dayData.day}
              </span>

              {/* Workout indicator */}
              {count > 0 && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 6,
                    height: 6,
                    background: 'var(--fs-primary)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fs-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span>פחות</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <div
            style={{
              width: 16,
              height: 16,
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-primary)',
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: 'var(--fs-signal)',
              border: '1px solid var(--fs-primary)',
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: 'var(--fs-accent)',
              border: '1px solid var(--fs-primary)',
            }}
          />
        </div>
        <span>יותר</span>
      </div>

      {/* Monthly stats */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '2px solid var(--fs-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          אימונים החודש
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            color: 'var(--fs-heading)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {monthlyWorkoutDays} ימים
        </span>
      </div>
    </m.div>
  );
};

export default memo(WorkoutCalendar);
