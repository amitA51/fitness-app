import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import type { WorkoutSession } from '../../types';

export interface StreakCalendarProps {
  sessions: WorkoutSession[];
  days?: number;
  onDayClick?: (isoDate: string) => void;
  className?: string;
}

const HEBREW_WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;
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
] as const;

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getSessionDateKey = (s: WorkoutSession): string => {
  if (s.date) return s.date.slice(0, 10);
  if (s.startTime) return toIsoDate(new Date(s.startTime));
  return '';
};

const intensityStyle = (count: number): { background: string; opacity: number } => {
  if (count <= 0) return { background: 'var(--color-background)', opacity: 1 };
  if (count === 1) return { background: 'var(--color-primary)', opacity: 0.35 };
  if (count === 2) return { background: 'var(--color-primary)', opacity: 0.65 };
  return { background: 'var(--color-primary)', opacity: 1 };
};

const chipCls =
  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';

interface DayCell {
  date: Date;
  iso: string;
  count: number;
  isFuture: boolean;
  isToday: boolean;
}

function StreakCalendarBase({
  sessions,
  days = 30,
  onDayClick,
  className = '',
}: StreakCalendarProps) {
  const { cells, currentStreak, maxStreak, activeDays } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== 'completed') continue;
      const key = getSessionDateKey(s);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toIsoDate(today);

    // Window of `days` dates ending today
    const windowDates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      windowDates.push(d);
    }

    // Pad start back to Sunday, pad end forward to Saturday (future slots)
    const firstDow = windowDates[0]?.getDay() ?? 0;
    const padded: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) padded.push(null);
    for (const d of windowDates) padded.push(d);
    while (padded.length % 7 !== 0) {
      const last = padded[padded.length - 1];
      if (last) {
        const next = new Date(last);
        next.setDate(last.getDate() + 1);
        padded.push(next);
      } else padded.push(null);
    }

    const builtCells: (DayCell | null)[] = padded.map((d) => {
      if (!d) return null;
      const iso = toIsoDate(d);
      return {
        date: d,
        iso,
        count: counts.get(iso) ?? 0,
        isFuture: d.getTime() > today.getTime(),
        isToday: iso === todayIso,
      };
    });

    // Streak computations within window
    let active = 0;
    let maxRun = 0;
    let run = 0;
    for (const d of windowDates) {
      const iso = toIsoDate(d);
      const c = counts.get(iso) ?? 0;
      if (c > 0) {
        active += 1;
        run += 1;
        if (run > maxRun) maxRun = run;
      } else {
        run = 0;
      }
    }

    // Current streak ending today (or yesterday if today is still empty)
    let current = 0;
    const cursor = new Date(today);
    if ((counts.get(todayIso) ?? 0) === 0) cursor.setDate(cursor.getDate() - 1);
    const cap = Math.max(sessions.length + 2, days + 2);
    for (let i = 0; i < cap; i++) {
      const key = toIsoDate(cursor);
      if ((counts.get(key) ?? 0) > 0) {
        current += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    return {
      cells: builtCells,
      currentStreak: current,
      maxStreak: maxRun,
      activeDays: active,
    };
  }, [sessions, days]);

  const handleDayClick = useCallback(
    (iso: string) => {
      onDayClick?.(iso);
    },
    [onDayClick]
  );

  const hasAnyWorkout = activeDays > 0;

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl p-4 bg-[var(--color-surface)] border border-[var(--color-separator)] ${className}`}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[var(--color-text)]">קלנדר רצף</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={chipCls}>
            <Flame size={11} /> {currentStreak} רצף נוכחי
          </span>
          <span className={chipCls}>
            <Trophy size={11} /> {maxStreak} רצף מקסימלי
          </span>
          <span className={chipCls}>
            {activeDays} מתוך {days}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {HEBREW_WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-[10px] text-center text-[var(--color-text-secondary)] font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} aria-hidden className="aspect-square" />;
          }
          const { background, opacity } = intensityStyle(cell.count);
          const dayLabel = `${cell.date.getDate()} ב${HEBREW_MONTHS[cell.date.getMonth()]}, ${cell.count} אימונים`;
          const isInteractive = !cell.isFuture;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={cell.isFuture}
              onClick={() => isInteractive && handleDayClick(cell.iso)}
              aria-label={dayLabel}
              title={dayLabel}
              className={`aspect-square rounded-[6px] transition-colors border border-[var(--color-separator)] ${
                cell.isToday
                  ? 'ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-surface)]'
                  : ''
              } ${cell.isFuture ? 'opacity-30 cursor-default' : 'hover:brightness-125'}`}
              style={{ background, opacity: cell.isFuture ? 0.3 : opacity }}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[10px] text-[var(--color-text-secondary)]">פחות</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3].map((lvl) => {
            const s = intensityStyle(lvl);
            return (
              <span
                key={lvl}
                aria-hidden
                className="w-3 h-3 rounded-[3px] border border-[var(--color-separator)]"
                style={{ background: s.background, opacity: s.opacity }}
              />
            );
          })}
        </div>
        <span className="text-[10px] text-[var(--color-text-secondary)]">יותר</span>
      </div>

      {!hasAnyWorkout && (
        <p className="text-[11px] text-[var(--color-text-secondary)] text-center mt-2">
          אין אימונים עדיין — התחילו את הרצף שלכם!
        </p>
      )}
    </motion.div>
  );
}

export const StreakCalendar = memo(StreakCalendarBase);
StreakCalendar.displayName = 'StreakCalendar';

export default StreakCalendar;
