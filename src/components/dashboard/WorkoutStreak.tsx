import { Flame } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../types';

interface WorkoutStreakProps {
  sessions: WorkoutSession[];
}

export const WorkoutStreak = memo(function WorkoutStreak({ sessions }: WorkoutStreakProps) {
  const streak = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === 'completed')
      .map((s) => {
        const d = new Date(s.startTime);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });

    const uniqueDays = [...new Set(completed)].sort().reverse();

    if (uniqueDays.length === 0) return { current: 0, best: 0 };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const hasToday = uniqueDays.includes(todayStr);
    const hasYesterday = uniqueDays.includes(yesterdayStr);

    if (!hasToday && !hasYesterday) return { current: 0, best: computeBest(uniqueDays) };

    let currentStreak = hasToday ? 1 : 0;
    const startFrom = hasToday ? yesterday : new Date(today);
    if (!hasToday && hasYesterday) {
      currentStreak = 1;
    }

    const checkDate = new Date(hasToday ? yesterday : startFrom);
    while (true) {
      const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (uniqueDays.includes(ds)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const best = computeBest(uniqueDays);
    return { current: currentStreak, best: Math.max(best, currentStreak) };
  }, [sessions]);

  if (streak.current === 0) return null;

  return (
    <div
      role="status"
      aria-label={`רצף אימונים: ${streak.current} ימים`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: 'var(--navy)',
        color: 'var(--mustard)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      <Flame size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontWeight: 600 }}>
        {streak.current} {streak.current === 1 ? 'יום' : 'ימים'}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>STREAK</span>
      {streak.best > streak.current && (
        <span style={{ marginRight: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
          BEST: {streak.best}
        </span>
      )}
    </div>
  );
});

function computeBest(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0;
  let best = 1;
  let current = 1;

  for (let i = 1; i < sortedDaysDesc.length; i++) {
    const prev = new Date(sortedDaysDesc[i - 1]!);
    const curr = new Date(sortedDaysDesc[i]!);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      current++;
      best = Math.max(best, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return best;
}
