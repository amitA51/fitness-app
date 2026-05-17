import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../types';
import { DAYS, getWeekEnd, getWeekStart } from '../../utils/dateUtils';

interface WeeklyGridProps {
  sessions: WorkoutSession[];
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export const WeeklyGrid = memo(function WeeklyGrid({
  sessions,
  weekOffset,
  onPrevWeek,
  onNextWeek,
}: WeeklyGridProps) {
  const { days, weekLabel, isCurrentWeek } = useMemo(() => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const targetWeekStart = new Date(currentWeekStart);
    targetWeekStart.setDate(targetWeekStart.getDate() + weekOffset * 7);

    const weekEnd = getWeekEnd(targetWeekStart);
    const done = new Set(
      sessions
        .filter((s) => s.status === 'completed')
        .map((s) => s.date || s.startTime.split('T')[0])
    );

    const daysArray = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(targetWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      return {
        letter: DAYS[d.getDay()],
        active: done.has(dateStr),
        isToday: dateStr === today,
        date: d,
      };
    });

    let weekLabel: string;
    if (weekOffset === 0) {
      weekLabel = 'השבוע';
    } else if (weekOffset === -1) {
      weekLabel = 'שבוע שעבר';
    } else if (weekOffset === 1) {
      weekLabel = 'שבוע הבא';
    } else {
      const startDay = targetWeekStart.getDate();
      const endDay = weekEnd.getDate();
      const startMonth = targetWeekStart.toLocaleDateString('he-IL', { month: 'short' });
      const endMonth = weekEnd.toLocaleDateString('he-IL', { month: 'short' });
      weekLabel =
        startMonth === endMonth
          ? `${startDay} - ${endDay} ${startMonth}`
          : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }

    return { days: daysArray, weekLabel, isCurrentWeek: weekOffset === 0 };
  }, [sessions, weekOffset]);

  return (
    <div>
      {/* Week navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          onClick={onPrevWeek}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 14,
            border: '1px solid var(--fs-surface-2)',
            background: 'var(--fs-surface)',
            cursor: 'pointer',
            color: 'var(--fs-ink)',
          }}
          aria-label="שבוע קודם"
        >
          <ChevronRight size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {weekLabel}
          </span>
          {isCurrentWeek && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                background: 'var(--fs-accent)',
                color: 'var(--fs-primary)',
                padding: '2px 7px',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              היום
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          disabled={weekOffset >= 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 14,
            border: '1px solid var(--fs-surface-2)',
            background: 'var(--fs-surface)',
            cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer',
            color: 'var(--fs-ink)',
            opacity: weekOffset >= 0 ? 0.3 : 1,
          }}
          aria-label="שבוע הבא"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 3,
        }}
      >
        {days.map((day) => {
          let bg: string;
          let color: string;
          let border: string;

          if (day.active) {
            bg = 'var(--fs-accent)';
            color = 'var(--fs-primary)';
            border = 'none';
          } else if (day.isToday) {
            bg = 'var(--fs-surface)';
            color = 'var(--fs-ink)';
            border = '2px solid var(--fs-accent)';
          } else {
            bg = 'var(--fs-surface-2)';
            color = 'var(--fs-muted)';
            border = 'none';
          }

          return (
            <div
              key={day.date.toISOString().split('T')[0]}
              style={{
                aspectRatio: '1 / 1',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: bg,
                color,
                border,
                borderRadius: 14,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: day.isToday ? 16 : 14,
                letterSpacing: '0',
              }}
            >
              {day.letter}
            </div>
          );
        })}
      </div>
    </div>
  );
});
