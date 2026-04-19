import { AnimatePresence, motion } from 'framer-motion';
// WorkoutHistoryScreen - Premium workout history with cloud sync
import React, { useState, useMemo, memo } from 'react';
import type { WorkoutSession } from '../../types';
import { ChevronLeftIcon, ClockIcon, FlameIcon, TrophyIcon } from '../icons';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';

// ============================================================
// TYPES
// ============================================================

interface WorkoutHistoryScreenProps {
  onClose: () => void;
  onSelectSession?: (session: WorkoutSession) => void;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatDuration = (startTime: string, endTime?: string): string => {
  if (!endTime) return '--';
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'היום';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'אתמול';
  }

  return date.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const calculateSessionVolume = (session: WorkoutSession): number => {
  let volume = 0;
  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      if (set.completedAt && set.weight && set.reps) {
        volume += set.weight * set.reps;
      }
    });
  });
  return volume;
};

const getMainMuscleGroup = (session: WorkoutSession): string => {
  const muscleCount: Record<string, number> = {};
  session.exercises.forEach((ex) => {
    const group = ex.muscleGroup || 'אחר';
    muscleCount[group] = (muscleCount[group] || 0) + 1;
  });

  let maxGroup = 'אחר';
  let maxCount = 0;
  Object.entries(muscleCount).forEach(([group, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxGroup = group;
    }
  });
  return maxGroup;
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// Memoized StatCard for performance
const StatCard = memo<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}>(({ icon, label, value, color }) => (
  <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
    <div className={`flex items-center gap-2 mb-2 ${color}`}>
      {icon}
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
    </div>
    <div className="text-2xl font-black text-white">{value}</div>
  </div>
));

StatCard.displayName = 'StatCard';

// Memoized SessionCard for performance in long lists
const SessionCard = memo<{
  session: WorkoutSession;
  onClick: () => void;
  index: number;
}>(({ session, onClick, index }) => {
  const volume = useMemo(() => calculateSessionVolume(session), [session]);
  const mainMuscle = useMemo(() => getMainMuscleGroup(session), [session]);
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completedAt).length,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-white font-bold text-sm mb-1">{formatDate(session.startTime)}</div>
          <div className="text-white/50 text-xs">
            {new Date(session.startTime).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--cosmos-accent-primary)]/20 text-[var(--cosmos-accent-primary)] text-xs font-medium">
          {mainMuscle}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-xl bg-white/5">
          <div className="text-lg font-bold text-white">{session.exercises.length}</div>
          <div className="text-[10px] text-white/40">תרגילים</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/5">
          <div className="text-lg font-bold text-cyan-400">{completedSets}</div>
          <div className="text-[10px] text-white/40">סטים</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/5">
          <div className="text-lg font-bold text-orange-400">{volume.toLocaleString()}</div>
          <div className="text-[10px] text-white/40">נפח (ק"ג)</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1 text-xs text-white/40">
          <ClockIcon className="w-3 h-3" />
          {formatDuration(session.startTime, session.endTime ?? undefined)}
        </div>
        <ChevronLeftIcon className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
      </div>
    </motion.div>
  );
});

SessionCard.displayName = 'SessionCard';

// ============================================================
// MAIN COMPONENT
// ============================================================

const WorkoutHistoryScreen: React.FC<WorkoutHistoryScreenProps> = ({
  onClose,
  onSelectSession,
}) => {
  const { sessions, stats, loading, error, refresh } = useWorkoutHistory(100);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((session) =>
      session.exercises.some(
        (ex) =>
          (ex.name ?? '').toLowerCase().includes(query) ||
          ex.muscleGroup?.toLowerCase().includes(query)
      )
    );
  }, [sessions, searchQuery]);

  // Group sessions by month
  const groupedSessions = useMemo(() => {
    const groups: Record<string, WorkoutSession[]> = {};
    filteredSessions.forEach((session) => {
      const date = new Date(session.startTime);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(session);
    });
    return Object.entries(groups).map(([key, groupSessions]) => ({
      key,
      label: groupSessions[0]
        ? new Date(groupSessions[0].startTime).toLocaleDateString('he-IL', {
            month: 'long',
            year: 'numeric',
          })
        : '',
      sessions: groupSessions,
    }));
  }, [filteredSessions]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9000] bg-[var(--cosmos-bg-primary)] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-[env(safe-area-inset-top,16px)] border-b border-white/10">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeftIcon className="w-5 h-5 text-white rotate-180" />
        </motion.button>

        <h1 className="text-lg font-bold text-white">היסטוריית אימונים</h1>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={refresh}
          disabled={loading}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={{
              duration: 1,
              repeat: loading ? Number.POSITIVE_INFINITY : 0,
              ease: 'linear',
            }}
          >
            ↻
          </motion.div>
        </motion.button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-6">
          {/* Stats Row */}
          <div className="flex gap-3">
            <StatCard
              icon={<TrophyIcon className="w-4 h-4" />}
              label="סה״כ אימונים"
              value={stats.totalWorkouts}
              color="text-yellow-400"
            />
            <StatCard
              icon={<FlameIcon className="w-4 h-4" />}
              label="נפח ממוצע"
              value={`${stats.averageVolume.toLocaleString()}`}
              color="text-orange-400"
            />
            <StatCard
              icon={<ClockIcon className="w-4 h-4" />}
              label="זמן ממוצע"
              value={`${stats.averageDuration}'`}
              color="text-cyan-400"
            />
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-[var(--cosmos-accent-primary)]/10 to-[var(--cosmos-accent-cyan)]/10 border border-[var(--cosmos-accent-primary)]/20">
            <div className="flex-1 text-center">
              <div className="text-2xl font-black text-[var(--cosmos-accent-primary)]">
                {stats.workoutsThisWeek}
              </div>
              <div className="text-xs text-white/50">השבוע</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-black text-[var(--cosmos-accent-cyan)]">
                {stats.workoutsThisMonth}
              </div>
              <div className="text-xs text-white/50">החודש</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-black text-emerald-400">
                {stats.totalVolume.toLocaleString()}
              </div>
              <div className="text-xs text-white/50">נפח כולל (ק״ג)</div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי תרגיל או קבוצת שריר..."
              className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[var(--cosmos-accent-primary)]/50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && sessions.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                className="w-8 h-8 border-2 border-[var(--cosmos-accent-primary)] border-t-transparent rounded-full"
              />
            </div>
          )}

          {/* Empty State */}
          {!loading && sessions.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <TrophyIcon className="w-8 h-8 text-white/30" />
              </div>
              <div className="text-white/60 text-sm">ההיסטוריה ריקה</div>
              <div className="text-white/40 text-xs mt-1">סיים אימון כדי לראות אותו כאן</div>
            </div>
          )}

          {/* Sessions List */}
          <AnimatePresence>
            {groupedSessions.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="text-sm font-bold text-white/60 px-1">{group.label}</div>
                {group.sessions.map((session, index) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    index={index}
                    onClick={() => onSelectSession?.(session)}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Safe Area */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </motion.div>
  );
};

export default React.memo(WorkoutHistoryScreen);
