/**
 * Workout Detail Page - Displays a completed workout session in detail
 * Shows all exercises, sets, reps, weights, and overall stats
 */

import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Clock,
  Dumbbell,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkoutComparison } from '../components/fitness/WorkoutComparison';
import { getWorkoutSession, getWorkoutSessions } from '../services/workoutDb';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import {
  formatDuration,
  formatHebrewDate,
  formatHebrewTime,
  formatVolume,
} from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { setVolume } from '../utils/workoutMath';

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

const MUSCLE_COLOR = {
  bg: 'var(--fs-surface-2)',
  text: 'var(--fs-ink)',
  border: 'var(--color-border)',
};

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
    const prevVol = setVolume(prev);
    const currVol = setVolume(curr);
    return currVol > prevVol ? curr : prev;
  });

  return {
    weight: best.weight || 0,
    reps: best.reps || 0,
    volume: setVolume(best),
  };
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function DetailSkeleton() {
  return (
    <div style={{ background: 'var(--fs-bg)', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="px-4 pt-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-full" style={{ background: 'var(--fs-surface-2)' }} />
          <div className="flex-1">
            <div
              className="h-6 w-40 rounded-lg mb-2"
              style={{ background: 'var(--fs-surface-2)' }}
            />
            <div className="h-4 w-24 rounded" style={{ background: 'var(--fs-surface-2)' }} />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--fs-surface)',
                borderRadius: '22px 16px 22px 16px',
                padding: 16,
                height: 96,
              }}
            />
          ))}
        </div>

        {/* Exercise cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--fs-surface)',
                borderRadius: '22px 16px 22px 16px',
                padding: 16,
                height: 128,
              }}
            />
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
  const completedSets = exercise.sets.filter((s) => s.isCompleted);
  const bestSet = getBestSet(exercise.sets);
  const totalVolume = completedSets.reduce((sum, s) => sum + setVolume(s), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Exercise Header */}
      <div style={{ padding: '14px 16px' }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 16,
                color: 'var(--fs-ink)',
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
            >
              {exercise.exerciseName || exercise.name || 'תרגיל ללא שם'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: MUSCLE_COLOR.bg,
                  color: MUSCLE_COLOR.text,
                }}
              >
                {exercise.targetMuscle || exercise.muscleGroup || 'שריר'}
              </span>
              {exercise.tempo && (
                <span
                  style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
                >
                  טמפו: {exercise.tempo}
                </span>
              )}
            </div>
          </div>

          {/* Volume badge */}
          <div style={{ background: 'var(--fs-bg)', borderRadius: 8, padding: '4px 10px' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fs-ink)',
              }}
            >
              {formatVolume(totalVolume)} ק"ג
            </span>
          </div>
        </div>

        {/* Best Set Highlight */}
        {bestSet && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 12,
              background: MUSCLE_COLOR.bg,
              marginBottom: 12,
            }}
          >
            <Trophy size={14} style={{ color: MUSCLE_COLOR.text }} />
            <span
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: MUSCLE_COLOR.text }}
            >
              הסט הטוב ביותר:
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fs-ink)',
                marginRight: 'auto',
              }}
            >
              {bestSet.weight} ק"ג × {bestSet.reps} חזרות
            </span>
          </div>
        )}

        {/* Sets Grid */}
        <div className="space-y-2">
          <div
            className="flex items-center"
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fs-muted)',
              padding: '0 4px',
            }}
          >
            <span className="flex-1">סט</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>משקל</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>חזרות</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>נפח</span>
          </div>

          {completedSets.map((set, setIndex) => (
            <div
              key={set.id || setIndex}
              className="flex items-center"
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
            >
              <span className="flex-1" style={{ color: 'var(--fs-muted)' }}>
                {set.setNumber || setIndex + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  color: 'var(--fs-ink)',
                  fontWeight: 500,
                }}
              >
                {set.weight || 0} ק"ג
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  color: 'var(--fs-ink)',
                  fontWeight: 500,
                }}
              >
                {set.reps || 0}
              </span>
              <span style={{ flex: 1, textAlign: 'center', minWidth: 0, color: 'var(--fs-muted)' }}>
                {setVolume(set).toLocaleString()}
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
    <div
      style={{
        flex: 1,
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'var(--fs-accent)',
          borderStartStartRadius: '22px',
          borderEndStartRadius: '16px',
        }}
      />
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--fs-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fs-ink)',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {value}
        {trend === 'up' && <TrendingUp size={12} style={{ color: 'var(--color-success-fg)' }} />}
        {trend === 'down' && <TrendingDown size={12} style={{ color: 'var(--color-error-fg)' }} />}
      </p>
      <p
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fs-muted)',
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {label}
      </p>
      {subValue && (
        <p
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fs-muted)',
            marginTop: 2,
          }}
        >
          {subValue}
        </p>
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
      const volume = ex.sets.filter((s) => s.isCompleted).reduce((sum, s) => sum + setVolume(s), 0);

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
      'var(--fs-accent)',
      'var(--fs-accent-2)',
      'var(--fs-signal)',
      'var(--fs-accent)',
      'var(--fs-accent-2)',
      'var(--fs-signal)',
      'var(--fs-primary)',
      'var(--fs-muted)',
    ];
    return colors[index % colors.length] ?? 'var(--fs-muted)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'var(--fs-accent)',
          borderStartStartRadius: '22px',
          borderEndStartRadius: '16px',
        }}
      />
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 14,
          color: 'var(--fs-ink)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Activity size={14} style={{ color: 'var(--fs-accent)' }} />
        פילוח שרירים
      </h3>

      {/* Volume bar chart */}
      <div className="space-y-3">
        {sortedMuscles.slice(0, 6).map(([muscle, stats], index) => {
          const percentage = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
          return (
            <div key={muscle}>
              <div className="flex items-center justify-between mb-1">
                <span
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fs-ink)' }}
                >
                  {muscle}
                </span>
                <span
                  style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
                >
                  {stats.sets} סטים | {formatVolume(stats.volume)} ק"ג
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--fs-surface-2)',
                  borderRadius: 9999,
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                  style={{ height: '100%', borderRadius: 9999, backgroundColor: getColor(index) }}
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

  const handleShare = useCallback(async () => {
    if (!session) return;

    const date = formatHebrewDate(session.date || session.startTime);
    const duration = formatDuration(session.duration);
    const volume = formatVolume(session.totalVolume);
    const totalSets = calculateTotalSets(session.exercises);
    const totalReps = calculateTotalReps(session.exercises);

    const exerciseLines = session.exercises
      .map((ex) => {
        const completedSets = ex.sets.filter((s) => s.isCompleted).length;
        return `• ${ex.name} - ${completedSets} סטים`;
      })
      .join('\n');

    const text = [
      `סיכום אימון - ${date}`,
      `משך: ${duration}`,
      `נפח כולל: ${volume} ק"ג`,
      `סטים: ${totalSets} | חזרות: ${totalReps}`,
      '',
      'תרגילים:',
      exerciseLines,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        logger.workout.error('Error sharing workout', err);
      }
    }
  }, [session]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !session) {
    return (
      <div
        style={{
          background: 'var(--fs-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--fs-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Dumbbell size={36} style={{ color: 'var(--fs-muted)' }} />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 22,
            color: 'var(--fs-ink)',
            marginBottom: 8,
          }}
        >
          {error || 'האימון לא נמצא'}
        </h2>
        <p
          style={{
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fs-muted)',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          לא ניתן לטעון את פרטי האימון
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            minHeight: 48,
            padding: '12px 24px',
            background: 'var(--fs-primary)',
            color: 'var(--fs-signal)',
            borderRadius: 14,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          חזרה לבית
        </button>
      </div>
    );
  }

  const totalSets = calculateTotalSets(session.exercises);
  const totalReps = calculateTotalReps(session.exercises);

  return (
    <div
      className="ambient-mesh ambient-mesh-soft pb-[max(100px,calc(env(safe-area-inset-bottom, 0px) + 100px))]"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="glass-surface sticky top-0 z-10"
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="חזרה לבית"
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              borderRadius: '50%',
              background: 'var(--fs-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={20} style={{ color: 'var(--fs-ink)' }} />
          </button>
          <div className="flex-1">
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--fs-ink)',
              }}
            >
              פרטי אימון
            </h1>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}>
              {formatHebrewDate(session.date || session.startTime)}
            </p>
          </div>
          {session.rating && (
            <div className="flex items-center gap-1" style={{ color: 'var(--fs-signal)' }}>
              <Star size={16} fill="currentColor" />
              <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {session.rating}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Time Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
            padding: 16,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: 'var(--fs-accent-2)' }} />
              <span
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
              >
                שעת התחלה
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--fs-ink)',
              }}
            >
              {formatHebrewTime(session.startTime)}
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--color-separator)', margin: '8px 0' }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: 'var(--fs-accent)' }} />
              <span
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
              >
                שעת סיום
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--fs-ink)',
              }}
            >
              {session.endTime ? formatHebrewTime(session.endTime) : '—'}
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
            icon={<Clock size={14} style={{ color: 'var(--fs-accent-2)' }} />}
            label="משך האימון"
            value={formatDuration(session.duration)}
          />
          <StatItem
            icon={<Dumbbell size={14} style={{ color: 'var(--fs-accent)' }} />}
            label="נפח כולל"
            value={`${formatVolume(session.totalVolume)} ק"ג`}
          />
          <StatItem
            icon={<TrendingUp size={14} style={{ color: 'var(--fs-signal)' }} />}
            label="סטים"
            value={totalSets.toString()}
            subValue={`${totalReps} חזרות`}
          />
        </motion.div>

        {/* Goal Badge */}
        {session.goalType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              background: 'var(--color-primary-subtle)',
              border: '1px solid var(--color-primary-subtle)',
              borderRadius: 16,
              marginBottom: 24,
            }}
          >
            <Target size={14} style={{ color: 'var(--fs-heading)' }} />
            <span
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fs-heading)' }}
            >
              סוג אימון:
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--fs-ink)',
                marginRight: 'auto',
              }}
            >
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
          <div
            className="flex items-center justify-between mb-4"
            style={{
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 8,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--fs-ink)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <BarChart2 size={16} style={{ color: 'var(--fs-accent)' }} />
              תרגילים ({session.exercises.length})
            </h2>
            <span
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
            >
              {totalSets} סטים
            </span>
          </div>

          <div className="space-y-3">
            {session.exercises.map((exercise, index) => (
              <ExerciseCard key={exercise.id || index} exercise={exercise} index={index} />
            ))}
          </div>
        </div>

        {/* Next time recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
            padding: 16,
            marginBottom: 24,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--fs-signal)',
              borderStartStartRadius: '22px',
              borderEndStartRadius: '16px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={12} style={{ color: 'var(--fs-signal)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              תובנה אוטומטית
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--fs-ink)',
            }}
          >
            {previousSession
              ? `האימון הקודם היה עם נפח של ${formatVolume(previousSession.totalVolume)} ק"ג. ${
                  session.totalVolume > previousSession.totalVolume
                    ? `שיפור של ${formatVolume(session.totalVolume - previousSession.totalVolume)} ק"ג!`
                    : 'נסה להוסיף סט או להעלות משקל בפעם הבאה.'
                }`
              : `המשך לעקוב אחר ההתקדמות שלך לאורך זמן.`}
          </p>
        </motion.div>

        {/* Notes Section */}
        {session.notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              padding: 16,
              marginBottom: 24,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <h3
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fs-muted)',
                marginBottom: 8,
              }}
            >
              הערות
            </h3>
            <p
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-hebrew)',
                color: 'var(--fs-ink)',
                lineHeight: 1.6,
              }}
            >
              {session.notes}
            </p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '12px 24px',
              background: 'var(--fs-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '22px 16px 22px 16px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--fs-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <ArrowRight size={14} />
            חזרה לבית
          </button>
          <button
            type="button"
            onClick={handleShare}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '12px 24px',
              background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
              border: 'none',
              borderRadius: '22px 16px 22px 16px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 13,
              color: '#071412',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <Share2 size={14} />
            שתף אימון
          </button>
        </motion.div>
      </div>
    </div>
  );
}
