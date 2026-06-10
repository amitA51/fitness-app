import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { parseLocalDate } from '../../../services/analytics/shared';

interface DateNavigatorProps {
  isToday: boolean;
  selectedDate: string;
  goBack: () => void;
  goForward: () => void;
}

export const DateNavigator = memo(function DateNavigator({
  isToday,
  selectedDate,
  goBack,
  goForward,
}: DateNavigatorProps) {
  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goBack}
          className="chip"
          aria-label="יום קודם"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          {/* parseLocalDate: new Date('YYYY-MM-DD') is UTC midnight and shifts
              the displayed weekday/date for users ahead of UTC (Israel). */}
          {isToday
            ? 'היום'
            : parseLocalDate(selectedDate).toLocaleDateString('he-IL', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}
        </span>
        <button
          type="button"
          onClick={goForward}
          disabled={isToday}
          className="chip"
          style={{ minWidth: 44, minHeight: 44, opacity: isToday ? 0.4 : 1 }}
          aria-label="יום הבא"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});
