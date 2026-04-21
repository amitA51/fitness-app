// WorkoutCalendar - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import type { WorkoutSession } from '../../types';

interface WorkoutCalendarProps {
  sessions: WorkoutSession[];
}

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const HEBREW_NUMBERS: Record<number, string> = {
  0: 'א',
  1: 'ב',
  2: 'ג',
  3: 'ד',
  4: 'ה',
  5: 'ו',
  6: 'ז',
  7: 'ח',
  8: 'ט',
  9: 'י',
  10: 'י״א',
  11: 'י״ב',
  12: 'י״ג',
  13: 'י״ד',
  14: 'ט״ו',
  15: 'ט״ז',
  16: 'י״ז',
  17: 'י״ח',
  18: 'י״ט',
  19: 'כ',
  20: 'כ״א',
  21: 'כ״ב',
  22: 'כ״ג',
  23: 'כ״ד',
  24: 'כ״ה',
  25: 'כ״ו',
  26: 'כ״ז',
  27: 'כ״ח',
  28: 'כ״ט',
  29: 'ל',
  30: 'ל״א',
  31: 'ל״א',
};

/**
 * WorkoutCalendar - Sport Annual Editorial Calendar Heatmap
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

  // VISION-annual intensity colors - mustard/bone gradient
  const getIntensityStyle = (count: number): React.CSSProperties => {
    if (count === 0) {
      return { backgroundColor: 'var(--bone-deep)' };
    }

    const intensity = Math.min(count / maxWorkouts, 1);

    return {
      backgroundColor: intensity >= 0.5 ? 'var(--mustard)' : 'rgba(245, 176, 20, 0.3)',
    };
  };

  const today = new Date().toISOString().split('T')[0];
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Monthly workout count
  const monthlyWorkoutDays = Object.entries(workoutCountByDay).filter(([date]) =>
    date.startsWith(currentMonthStr)
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      style={{
        background: 'var(--bone)',
        border: '2px solid var(--navy)',
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
              background: 'var(--mustard)',
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
              color: 'var(--navy)',
            }}
          >
            לוח אימונים
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={goToPrevMonth}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: '2px solid var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bone-deep)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="var(--navy)" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>

          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              color: 'var(--navy)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              minWidth: 140,
              textAlign: 'center',
            }}
          >
            {HEBREW_MONTHS[month]} {year}
          </span>

          <button
            onClick={goToNextMonth}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: '2px solid var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bone-deep)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="var(--navy)" strokeWidth="2" strokeLinecap="square" />
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
        {HEBREW_DAYS.map((day, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--stone)',
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

          return (
            <motion.div
              key={index}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: isCurrentMonth ? 1 : 0.3 }}
              transition={{ delay: index * 0.01, type: 'spring', stiffness: 200 }}
              whileHover={isCurrentMonth ? { scale: 1.1 } : {}}
              style={{
                aspectRatio: '1',
                position: 'relative',
                cursor: isCurrentMonth ? 'pointer' : 'default',
                border: isToday ? '2px solid var(--mustard)' : '2px solid var(--bone-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease',
                ...getIntensityStyle(count),
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: count > 0 ? 700 : 400,
                  color: count > 0 ? 'var(--navy)' : 'var(--stone)',
                  letterSpacing: '0.02em',
                }}
              >
                {HEBREW_NUMBERS[dayData.day] || dayData.day}
              </span>

              {/* Workout indicator */}
              {count > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 6,
                    height: 6,
                    background: 'var(--navy)',
                  }}
                />
              )}
            </motion.div>
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
          color: 'var(--stone)',
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
              background: 'var(--bone-deep)',
              border: '1px solid var(--navy)',
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: 'rgba(245, 176, 20, 0.3)',
              border: '1px solid var(--navy)',
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: 'var(--mustard)',
              border: '1px solid var(--navy)',
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
          borderTop: '2px solid var(--navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--stone)',
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
            color: 'var(--navy)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {monthlyWorkoutDays} ימים
        </span>
      </div>
    </motion.div>
  );
};

export default memo(WorkoutCalendar);
