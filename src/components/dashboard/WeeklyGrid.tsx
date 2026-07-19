import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useIsRTL } from '../../hooks/useIsRTL';
import type { WorkoutSession } from '../../types';
import { DAYS, HEBREW_DAYS, getWeekEnd, getWeekStart } from '../../utils/dateUtils';
import { RingProgress } from '../charts';

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
  const isRTL = useIsRTL();
  // Temporal direction → visual arrow. "Back/past" points toward the reading
  // origin (right in RTL, left in LTR); "next/future" points the other way.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const { days, weekLabel, isCurrentWeek, weekProgress } = useMemo(() => {
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
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return {
        letter: DAYS[d.getDay()],
        dayName: HEBREW_DAYS[d.getDay()],
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

    const activeCount = daysArray.filter((d) => d.active).length;
    const progress = Math.round((activeCount / 7) * 100);

    return {
      days: daysArray,
      weekLabel,
      isCurrentWeek: weekOffset === 0,
      weekProgress: progress,
    };
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
          className="active:scale-[0.96] transition-transform"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 14,
            border: '1px solid var(--fs-surface-2)',
            background: 'var(--fs-surface)',
            cursor: 'pointer',
            color: 'var(--fs-ink)',
          }}
          aria-label="שבוע קודם"
        >
          <PrevIcon size={18} aria-hidden="true" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--fs-ink)',
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
                letterSpacing: '-0.01em',
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                padding: '2px 7px',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              היום
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RingProgress
            value={weekProgress}
            size={48}
            strokeWidth={6}
            variant="accent"
            centerContent={
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fs-ink)',
                  fontWeight: 700,
                }}
              >
                {weekProgress}%
              </span>
            }
            ariaLabel={`התקדמות שבועית ${weekProgress}%`}
          />
          <button
            type="button"
            onClick={onNextWeek}
            disabled={weekOffset >= 0}
            className="active:scale-[0.96] transition-transform"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 14,
              border: '1px solid var(--fs-surface-2)',
              background: 'var(--fs-surface)',
              cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer',
              color: 'var(--fs-ink)',
              opacity: weekOffset >= 0 ? 0.3 : 1,
            }}
            aria-label="שבוע הבא"
          >
            <NextIcon size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          // minmax(0, 1fr): the .day-cell min-height (48px) + aspect-ratio gives
          // each column a 48px min-content width, which overflows narrow screens
          // and clips the last day. Allow columns to shrink below min-content.
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 3,
        }}
      >
        {days.map((day) => {
          const classes = ['day-cell'];
          if (day.active) classes.push('done');
          if (day.isToday) classes.push('today');

          // State is conveyed visually by color only — voice it for screen
          // readers: "יום ראשון — אימון הושלם" / "ללא אימון", plus "היום".
          const ariaLabel = [
            `יום ${day.dayName}`,
            ...(day.isToday ? ['היום'] : []),
            day.active ? 'אימון הושלם' : 'ללא אימון',
          ].join(' — ');

          return (
            <div
              key={day.date.toISOString().split('T')[0]}
              role="img"
              aria-label={ariaLabel}
              className={classes.join(' ')}
              style={{
                // width: 100% pins the cell to its track so aspect-ratio derives
                // height from width (not the 48px min-height transferred back as
                // width, which overflowed the row on narrow screens).
                width: '100%',
                aspectRatio: '1 / 1',
                fontSize: day.isToday ? 16 : 14,
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
