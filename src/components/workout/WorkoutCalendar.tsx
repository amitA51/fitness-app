import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutSession } from '../../types';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface WorkoutCalendarProps {
  sessions: WorkoutSession[];
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const HEBREW_NUMBERS: Record<number, string> = {
  0: 'א', 1: 'ב', 2: 'ג', 3: 'ד', 4: 'ה', 5: 'ו', 6: 'ז', 7: 'ח', 8: 'ט', 9: 'י',
  10: 'י״א', 11: 'י״ב', 12: 'י״ג', 13: 'י״ד', 14: 'ט״ו', 15: 'ט״ז', 16: 'י״ז',
  17: 'י״ח', 18: 'י״ט', 19: 'כ', 20: 'כ״א', 21: 'כ״ב', 22: 'כ״ג', 23: 'כ״ד',
  24: 'כ״ה', 25: 'כ״ו', 26: 'כ״ז', 27: 'כ״ח', 28: 'כ״ט', 29: 'ל', 30: 'ל״א', 31: 'ל״א'
};

/**
 * WorkoutCalendar - Monthly calendar heatmap showing workout days
 */
const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ sessions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get year and month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate workout count per day
  const workoutCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(session => {
      const date = session.date;
      counts[date] = (counts[date] || 0) + 1;
    });
    return counts;
  }, [sessions]);

  // Calculate max workouts in a single day for intensity calculation
  const maxWorkouts = useMemo(() => {
    return Math.max(1, ...Object.values(workoutCountByDay));
  }, [workoutCountByDay]);

  // Get calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0 = Sunday
    
    const days: Array<{ day: number; date: string; isCurrentMonth: boolean }> = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        date: '',
        isCurrentMonth: false,
      });
    }
    
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        date: dateStr,
        isCurrentMonth: true,
      });
    }
    
    // Next month padding (fill to 6 rows = 42 cells)
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

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calculate intensity color
  const getIntensityStyle = (count: number): React.CSSProperties => {
    if (count === 0) {
      return { backgroundColor: 'rgba(255, 255, 255, 0.03)' };
    }
    
    const intensity = Math.min(count / maxWorkouts, 1);
    const baseColor = `rgba(34, 211, 238, ${0.2 + intensity * 0.8})`;
    
    return {
      backgroundColor: baseColor,
      boxShadow: intensity >= 0.7 ? `0 0 ${intensity * 10}px rgba(34, 211, 238, 0.4)` : 'none',
    };
  };

  // Check if date is today
  const today = new Date().toISOString().split('T')[0];
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="workout-glass-card rounded-2xl p-5"
    >
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          לוח אימונים
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronRight size={16} className="text-white/60" />
          </button>
          
          <span className="text-sm text-white font-medium min-w-[120px] text-center">
            {HEBREW_MONTHS[month]} {year}
          </span>
          
          <button
            onClick={goToNextMonth}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={16} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {HEBREW_DAYS.map((day, i) => (
          <div key={i} className="text-center text-[9px] text-white/40 font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          const count = dayData.date ? (workoutCountByDay[dayData.date] || 0) : 0;
          const isToday = dayData.date === today;
          const isCurrentMonth = dayData.isCurrentMonth;

          return (
            <motion.div
              key={index}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: isCurrentMonth ? 1 : 0.3 }}
              transition={{ delay: index * 0.01, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.1, zIndex: 10 }}
              className={`
                aspect-square rounded-lg relative cursor-pointer
                flex items-center justify-center
                transition-all duration-200
                ${isToday ? 'ring-2 ring-[var(--cosmos-accent-primary)]' : ''}
                ${!isCurrentMonth ? 'pointer-events-none' : ''}
              `}
              style={getIntensityStyle(count)}
            >
              <span className={`text-[10px] ${
                count > 0 ? 'text-white font-medium' : 'text-white/30'
              }`}>
                {HEBREW_NUMBERS[dayData.day] || dayData.day}
              </span>
              
              {/* Workout indicator dot */}
              {count > 0 && (
                <div 
                  className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white"
                  style={{ opacity: count >= 2 ? 1 : 0.7 }}
                />
              )}

              {/* Tooltip */}
              <AnimatePresence>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-black/95 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap shadow-lg border border-white/10">
                    {dayData.date && (
                      <>
                        {count > 0 ? (
                          <span>{count} אימון{count > 1 ? '' : ''}</span>
                        ) : (
                          <span>ללא אימון</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[9px] text-white/40">
        <span>פחות</span>
        <div className="flex gap-1">
          {[0, 0.33, 0.66, 1].map((intensity, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded"
              style={{
                backgroundColor: intensity === 0 
                  ? 'rgba(255, 255, 255, 0.03)' 
                  : `rgba(34, 211, 238, ${0.2 + intensity * 0.8})`
              }}
            />
          ))}
        </div>
        <span>יותר</span>
      </div>

      {/* Monthly stats */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
        <div className="text-white/40">
          אימונים החודש:
        </div>
        <div className="text-white font-medium">
          {Object.entries(workoutCountByDay)
            .filter(([date]) => date.startsWith(currentMonthStr))
            .length} ימים
        </div>
      </div>
    </motion.div>
  );
};

export default memo(WorkoutCalendar);