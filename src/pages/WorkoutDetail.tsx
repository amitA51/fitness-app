/**
 * Workout Detail Page - Displays a completed workout session in detail
 * Shows all exercises, sets, reps, weights, and overall stats
 */

import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkoutComparison } from '../components/fitness/WorkoutComparison';
import { getWorkoutSession, getWorkoutSessions } from '../services/workoutDb';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = HEBREW_DAYS[date.getDay()];
  const month = HEBREW_MONTHS[date.getMonth()];
  return `יום ${day}, ${date.getDate()} ${month}`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} דקות`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} שעה ו-${minutes} דקות` : `${hours} שעות`;
}

function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toLocaleString();
}

function getMuscleGroupColor(muscle: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Chest: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    Back: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    Shoulders: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    Legs: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    Triceps: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    Biceps: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
    Core: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    Cardio: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  };
  return colors[muscle] || { bg: 'bg-white/5', text: 'text-white/70', border: 'border-white/20' };
}

function calculateTotalSets(exercises: WorkoutExercise[]): number {
  return exercises.reduce((total, ex) => total + ex.sets.filter((s) => s.isCompleted).length, 0);
}

function calculateTotalReps(exercises: WorkoutExercise[]): number {
  return exercises.reduce(
    (total, ex) =>
      total +
      ex.sets.filter((s) => s.isCompleted).reduce((setTotal, s) => setTotal + (s.reps || 0), 0),
    0
  );
}

function getBestSet(sets: WorkoutSet[]): { weight: number; reps: number; volume: number } | null {
  const completed = sets.filter((s) => s.isCompleted);
  if (completed.length === 0) return null;

  const best = completed.reduce((prev, curr) => {
    const prevVol = (prev.weight || 0) * (prev.reps || 0);
    const currVol = (curr.weight || 0) * (curr.reps || 0);
    return currVol > prevVol ? curr : prev;
  });

  return {
    weight: best.weight || 0,
    reps: best.reps || 0,
    volume: (best.weight || 0) * (best.reps || 0),
  };
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function DetailSkeleton() {
  return (
    <div className="bg-black animate-pulse">
      <div className="px-4 pt-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-full bg-white/10" />
          <div className="flex-1">
            <div className="h-6 w-40 bg-white/10 rounded-lg mb-2" />
            <div className="h-4 w-24 bg-white/10 rounded" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--color-surface)] rounded-[20px] p-4 h-24" />
          ))}
        </div>

        {/* Exercise cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--color-surface)] rounded-[20px] p-4 h-32" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXERCISE CARD
// ============================================================================

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
}

function ExerciseCard({ exercise, index }: ExerciseCardProps) {
  const muscleColor = getMuscleGroupColor(exercise.targetMuscle || exercise.muscleGroup || 'Other');
  const completedSets = exercise.sets.filter((s) => s.isCompleted);
  const bestSet = getBestSet(exercise.sets);
  const totalVolume = completedSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={`bg-[var(--color-surface)] rounded-[20px] border ${muscleColor.border} overflow-hidden`}
    >
      {/* Exercise Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-barlow-condensed font-bold text-[18px] text-white leading-tight truncate">
              {exercise.exerciseName || exercise.name || 'תרגיל ללא שם'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[11px] font-barlow px-2 py-0.5 rounded-full ${muscleColor.bg} ${muscleColor.text}`}
              >
                {exercise.targetMuscle || exercise.muscleGroup || 'שריר'}
              </span>
              {exercise.tempo && (
                <span className="text-[11px] font-barlow text-[var(--color-text-secondary)]">
                  טמפו: {exercise.tempo}
                </span>
              )}
            </div>
          </div>

          {/* Volume badge */}
          <div className="bg-white/5 rounded-lg px-2.5 py-1">
            <span className="text-[13px] font-barlow font-bold text-white">
              {formatVolume(totalVolume)} ק"ג
            </span>
          </div>
        </div>

        {/* Best Set Highlight */}
        {bestSet && (
          <div className={`flex items-center gap-2 p-2.5 rounded-xl ${muscleColor.bg} mb-3`}>
            <Trophy size={14} className={muscleColor.text} />
            <span className={`text-[12px] font-barlow ${muscleColor.text}`}>הסט הטוב ביותר:</span>
            <span className="text-[13px] font-barlow font-bold text-white mr-auto">
              {bestSet.weight} ק"ג × {bestSet.reps} חזרות
            </span>
          </div>
        )}

        {/* Sets Grid */}
        <div className="space-y-2">
          <div className="flex items-center text-[11px] font-barlow text-[var(--color-text-secondary)] px-1">
            <span className="flex-1">סט</span>
            <span className="w-16 text-center">משקל</span>
            <span className="w-16 text-center">חזרות</span>
            <span className="w-16 text-center">נפח</span>
          </div>

          {completedSets.map((set, setIndex) => (
            <div key={set.id || setIndex} className="flex items-center text-[13px] font-barlow">
              <span className="flex-1 text-[var(--color-text-secondary)]">
                {set.setNumber || setIndex + 1}
              </span>
              <span className="w-16 text-center text-white font-medium">{set.weight || 0} ק"ג</span>
              <span className="w-16 text-center text-white font-medium">{set.reps || 0}</span>
              <span className="w-16 text-center text-[var(--color-text-secondary)]">
                {((set.weight || 0) * (set.reps || 0)).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STATS ROW
// ============================================================================

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatItem({ icon, label, value, subValue, trend }: StatItemProps) {
  return (
    <div className="flex-1 bg-[var(--color-surface)] rounded-[16px] p-3 flex flex-col items-center text-center min-w-0">
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-2">
        {icon}
      </div>
      <p className="text-[18px] font-bold text-white leading-none flex items-center gap-1">
        {value}
        {trend === 'up' && <TrendingUp size={12} className="text-green-400" />}
        {trend === 'down' && <TrendingDown size={12} className="text-red-400" />}
      </p>
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-none">{label}</p>
      {subValue && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// ============================================================================
// MUSCLE GROUP BREAKDOWN
// ============================================================================

interface MuscleBreakdownProps {
  exercises: WorkoutExercise[];
}

function MuscleBreakdown({ exercises }: MuscleBreakdownProps) {
  const muscleStats = exercises.reduce(
    (acc, ex) => {
      const muscle = ex.targetMuscle || ex.muscleGroup || 'Other';
      const sets = ex.sets.filter((s) => s.isCompleted).length;
      const volume = ex.sets
        .filter((s) => s.isCompleted)
        .reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

      if (!acc[muscle]) {
        acc[muscle] = { sets: 0, volume: 0 };
      }
      acc[muscle].sets += sets;
      acc[muscle].volume += volume;
      return acc;
    },
    {} as Record<string, { sets: number; volume: number }>
  );

  const totalVolume = Object.values(muscleStats).reduce((sum, m) => sum + m.volume, 0);
  const sortedMuscles = Object.entries(muscleStats).sort((a, b) => b[1].volume - a[1].volume);

  const getColor = (index: number): string => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-cyan-500',
    ];
    return colors[index % colors.length] ?? 'bg-gray-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[var(--color-surface)] rounded-[20px] p-4 border border-white/[0.06] mb-6"
    >
      <h3 className="font-barlow-condensed font-bold text-[16px] text-white mb-4 flex items-center gap-2">
        <Activity size={16} className="text-primary" />
        פילוח שרירים
      </h3>

      {/* Volume bar chart */}
      <div className="space-y-3">
        {sortedMuscles.slice(0, 6).map(([muscle, stats], index) => {
          const percentage = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
          return (
            <div key={muscle}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-barlow text-white">{muscle}</span>
                <span className="text-[11px] font-barlow text-[var(--color-text-secondary)]">
                  {stats.sets} סטים | {formatVolume(stats.volume)} ק"ג
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                  className={`h-full rounded-full ${getColor(index)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================================
// PREVIOUS SESSION LOADER (prefers same-template, falls back to nearest prior)
// ============================================================================

function usePreviousSession(current: WorkoutSession | null): WorkoutSession | null {
  const [previous, setPrevious] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    if (!current) {
      setPrevious(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const sessions = await getWorkoutSessions(30);
        if (!current) return;
        const currentStart = new Date(current.startTime).getTime();
        const priorSameTemplate = current.templateId
          ? sessions
              .filter(
                (s) =>
                  s.id !== current.id &&
                  s.templateId === current.templateId &&
                  s.status === 'completed' &&
                  new Date(s.startTime).getTime() < currentStart
              )
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]
          : undefined;
        const fallback = sessions
          .filter(
            (s) =>
              s.id !== current.id &&
              s.status === 'completed' &&
              new Date(s.startTime).getTime() < currentStart
          )
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
        if (!cancelled) setPrevious(priorSameTemplate ?? fallback ?? null);
      } catch (e) {
        logger.workout.error('Error loading previous session', e);
        if (!cancelled) setPrevious(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [current]);

  return previous;
}

// ============================================================================
// ESTIMATED CALORIES BURNED
// ============================================================================

function calculateEstimatedCalories(duration: number, exercises: WorkoutExercise[]): number {
  // Base MET (Metabolic Equivalent of Task) for weight training is ~3.5-6
  // Average ~4.5 MET for moderate intensity workout
  // Calories = MET × weight (kg) × duration (hours)
  // Assuming average body weight of 75kg

  const averageMET = 4.5;
  const averageWeight = 75; // kg
  const durationHours = duration / 3600;

  // Base calculation
  let calories = averageMET * averageWeight * durationHours;

  // Add intensity bonus based on total volume (more volume = higher intensity)
  const totalVolume = exercises.reduce((sum, ex) => {
    const exVolume = ex.sets
      .filter((s) => s.isCompleted)
      .reduce((setSum, set) => setSum + (set.weight || 0) * (set.reps || 0), 0);
    return sum + exVolume;
  }, 0);

  // Each 1000kg of volume adds ~10% to intensity
  const volumeBonus = Math.min((totalVolume / 1000) * 0.1, 0.5);
  calories *= 1 + volumeBonus;

  return Math.round(calories);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousSession = usePreviousSession(session);

  useEffect(() => {
    async function loadSession() {
      if (!id) {
        setError('מזהה אימון לא נמצא');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getWorkoutSession(id);
        if (!data) {
          setError('האימון לא נמצא');
        } else {
          setSession(data);
        }
      } catch (err) {
        setError('שגיאה בטעינת האימון');
        logger.workout.error('Error loading workout session', err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [id]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !session) {
    return (
      <div className="bg-black flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <Dumbbell size={36} className="text-[#48484A]" />
        </div>
        <h2 className="font-barlow-condensed font-bold text-[22px] text-white mb-2">
          {error || 'האימון לא נמצא'}
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 text-center">
          לא ניתן לטעון את פרטי האימון
        </p>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="min-h-[48px] px-6 py-3 bg-primary text-white rounded-[14px] font-barlow font-semibold text-[15px]"
        >
          חזרה להיסטוריה
        </button>
      </div>
    );
  }

  const totalSets = calculateTotalSets(session.exercises);
  const totalReps = calculateTotalReps(session.exercises);
  const estimatedCalories = calculateEstimatedCalories(session.duration, session.exercises);

  return (
    <div
      className="bg-black pb-[max(100px,calc(env(safe-area-inset-bottom, 0px) + 100px))]"
      dir="rtl"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-lg border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="font-barlow-condensed font-bold text-[20px] text-white">פרטי אימון</h1>
            <p className="text-[12px] text-[var(--color-text-secondary)]">
              {formatDate(session.date || session.startTime)}
            </p>
          </div>
          {session.rating && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Star size={16} fill="currentColor" />
              <span className="text-[14px] font-barlow font-bold">{session.rating}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Time Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--color-surface)] rounded-[20px] p-4 mb-4 border border-white/[0.06]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              <span className="text-[14px] font-barlow text-[var(--color-text-secondary)]">
                שעת התחלה
              </span>
            </div>
            <span className="text-[14px] font-barlow font-semibold text-white">
              {formatTime(session.startTime)}
            </span>
          </div>
          <div className="h-px bg-white/5 my-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-green-400" />
              <span className="text-[14px] font-barlow text-[var(--color-text-secondary)]">
                שעת סיום
              </span>
            </div>
            <span className="text-[14px] font-barlow font-semibold text-white">
              {session.endTime ? formatTime(session.endTime) : '—'}
            </span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <StatItem
            icon={<Clock size={16} className="text-blue-400" />}
            label="משך האימון"
            value={formatDuration(session.duration)}
          />
          <StatItem
            icon={<Dumbbell size={16} className="text-green-400" />}
            label="נפח כולל"
            value={`${formatVolume(session.totalVolume)} ק"ג`}
          />
          <StatItem
            icon={<TrendingUp size={16} className="text-purple-400" />}
            label="סטים"
            value={totalSets.toString()}
            subValue={`${totalReps} חזרות`}
          />
          <StatItem
            icon={<Flame size={16} className="text-orange-400" />}
            label="שריפת קלוריות"
            value={estimatedCalories.toString()}
            subValue="קלוריות (משוער)"
          />
        </motion.div>

        {/* Goal Badge */}
        {session.goalType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-[16px] mb-6"
          >
            <Target size={16} className="text-primary" />
            <span className="text-[13px] font-barlow text-primary">סוג אימון:</span>
            <span className="text-[13px] font-barlow font-semibold text-white mr-auto">
              {session.goalType === 'strength'
                ? 'כוח'
                : session.goalType === 'hypertrophy'
                  ? 'נפח/שריר'
                  : session.goalType === 'endurance'
                    ? 'סיבולת'
                    : 'תחזוקה'}
            </span>
          </motion.div>
        )}

        {/* Muscle Breakdown */}
        <MuscleBreakdown exercises={session.exercises} />

        {/* Comparison with Previous */}
        <div className="mb-6">
          <WorkoutComparison current={session} previous={previousSession} />
        </div>

        {/* Exercises Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-barlow-condensed font-bold text-[20px] text-white flex items-center gap-2">
              <BarChart2 size={18} className="text-primary" />
              תרגילים ({session.exercises.length})
            </h2>
            <span className="text-[12px] font-barlow text-[var(--color-text-secondary)]">
              {totalSets} סטים
            </span>
          </div>

          <div className="space-y-3">
            {session.exercises.map((exercise, index) => (
              <ExerciseCard key={exercise.id || index} exercise={exercise} index={index} />
            ))}
          </div>
        </div>

        {/* Notes Section */}
        {session.notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[var(--color-surface)] rounded-[20px] p-4 border border-white/[0.06] mb-6"
          >
            <h3 className="font-barlow font-semibold text-[14px] text-[var(--color-text-secondary)] mb-2">
              הערות
            </h3>
            <p className="text-[14px] font-barlow text-white leading-relaxed">{session.notes}</p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex gap-3"
        >
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="flex-1 min-h-[48px] py-3 bg-white/5 text-white rounded-[14px] font-barlow font-semibold text-[15px] flex items-center justify-center gap-2"
          >
            <ArrowRight size={16} />
            חזרה להיסטוריה
          </button>
        </motion.div>
      </div>
    </div>
  );
}
