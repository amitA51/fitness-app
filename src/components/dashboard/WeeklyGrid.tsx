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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevWeek}
          className="chip focus-ring"
          style={{ padding: '6px 10px' }}
          aria-label="שבוע קודם"
        >
          <ChevronRight size={14} />
        </button>

        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--navy)',
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
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                background: 'var(--mustard)',
                color: 'var(--navy)',
                padding: '2px 6px',
                fontWeight: 600,
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
          className="chip focus-ring"
          style={{
            padding: '6px 10px',
            opacity: weekOffset >= 0 ? 0.3 : 1,
            cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer',
          }}
          aria-label="שבוע הבא"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {days.map((day) => {
          const bg = day.active ? 'var(--navy)' : day.isToday ? 'var(--bone)' : 'var(--bone-deep)';
          const color = day.active
            ? 'var(--mustard)'
            : day.isToday
              ? 'var(--navy)'
              : 'var(--stone)';
          const border = day.isToday && !day.active ? '2px solid var(--navy)' : 'none';

          return (
            <div
              key={day.date.toISOString().split('T')[0]}
              className="flex items-center justify-center"
              style={{
                aspectRatio: '1 / 1',
                background: bg,
                color,
                border,
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                textTransform: 'uppercase',
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
