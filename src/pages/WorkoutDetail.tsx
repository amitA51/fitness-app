/**
 * Workout Detail Page - Displays a completed workout session in detail
 * Shows all exercises, sets, reps, weights, and overall stats
 */

import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  Star,
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

function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toLocaleString();
}

function getMuscleGroupColor(muscle: string): string {
  const colors: Record<string, string> = {
    Chest: 'var(--mustard)',
    Back: 'var(--navy)',
    Shoulders: 'var(--stone)',
    Legs: 'var(--mustard-dark)',
    Triceps: 'var(--navy-light)',
    Biceps: 'var(--mustard)',
    Core: 'var(--stone)',
    Cardio: 'var(--navy)',
  };
  return colors[muscle] || 'var(--navy)';
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
    <div className="min-h-screen pb-28 animate-pulse" style={{ background: 'var(--bone)' }}>
      <div className="px-4 pt-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-[var(--bone-deep)]" />
          <div className="flex-1">
            <div className="h-6 w-40 bg-[var(--bone-deep)] mb-2" />
            <div className="h-4 w-24 bg-[var(--bone-deep)]" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bone-deep)] p-4 h-24" />
          ))}
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bone-deep)] p-4 h-32" />
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
      className="card-outlined"
    >
      {/* Exercise Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="line-clamp-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: 1,
              color: 'var(--ink)',
              textTransform: 'uppercase',
            }}
          >
            {exercise.exerciseName || exercise.name || 'תרגיל ללא שם'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="badge"
              style={{ background: muscleColor, color: 'var(--bone)' }}
            >
              {exercise.targetMuscle || exercise.muscleGroup || 'שריר'}
            </span>
            {exercise.tempo && (
              <span className="eyebrow" style={{ color: 'var(--stone)' }}>
                טמפו: {exercise.tempo}
              </span>
            )}
          </div>
        </div>

        {/* Volume */}
        <div className="shrink-0 ms-3">
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '20px',
              color: 'var(--ink)',
            }}
          >
            {formatVolume(totalVolume)}
          </span>
          <span className="eyebrow" style={{ color: 'var(--mustard)' }}> ק"ג</span>
        </div>
      </div>

      {/* Best Set Highlight */}
      {bestSet && (
        <div
          className="flex items-center gap-2 p-3 mb-3"
          style={{ background: 'var(--mustard)' }}
        >
          <Trophy size={14} style={{ color: 'var(--navy)' }} />
          <span className="eyebrow" style={{ color: 'var(--navy)' }}>הסט הטוב ביותר:</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--navy)',
              marginInlineStart: 'auto',
            }}
          >
            {bestSet.weight} ק"ג × {bestSet.reps} חזרות
          </span>
        </div>
      )}

      {/* Sets Grid */}
      <div className="space-y-0">
        <div
          className="flex items-center py-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--stone)',
            borderBottom: '1px solid var(--bone-deep)',
          }}
        >
          <span className="flex-1">סט</span>
          <span className="w-16 text-center">משקל</span>
          <span className="w-16 text-center">חזרות</span>
          <span className="w-16 text-center">נפח</span>
        </div>

        {completedSets.map((set, setIndex) => (
          <div
            key={set.id || setIndex}
            className="flex items-center py-2.5"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--ink)',
              borderBottom: setIndex < completedSets.length - 1 ? '1px solid var(--bone-deep)' : 'none',
            }}
          >
            <span className="flex-1" style={{ color: 'var(--stone)' }}>
              {set.setNumber || setIndex + 1}
            </span>
            <span className="w-16 text-center" style={{ fontWeight: 600 }}>{set.weight || 0} ק"ג</span>
            <span className="w-16 text-center" style={{ fontWeight: 600 }}>{set.reps || 0}</span>
            <span className="w-16 text-center" style={{ color: 'var(--stone)' }}>
              {((set.weight || 0) * (set.reps || 0)).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// STATS ROW
// StatItem and getColor removed — using data-strip classes instead

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="card-outlined mb-6"
    >
      <h3 className="section-title mb-4 flex items-center gap-2">
        <Activity size={14} />
        § MUSCLE BREAKDOWN · פילוח שרירים
      </h3>

      <div className="space-y-3">
        {sortedMuscles.slice(0, 6).map(([muscle, stats], index) => {
          const percentage = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
          return (
            <div key={muscle} className="skill-row">
              <div className="skill-top">
                <span className="skill-name">{muscle}</span>
                <span className="skill-pct">
                  {stats.sets} סטים · {formatVolume(stats.volume)} ק"ג
                </span>
              </div>
              <div className="skill-bar">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                  className="skill-fill"
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--bone)' }}>
        <div className="w-20 h-20 flex items-center justify-center mb-6" style={{ background: 'var(--navy)', color: 'var(--mustard)' }}>
          <Dumbbell size={36} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-hebrew)', fontWeight: 800, fontSize: '22px', color: 'var(--ink)', marginBottom: '8px' }}>
          {error || 'האימון לא נמצא'}
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--stone)', marginBottom: '24px', textAlign: 'center' }}>
          לא ניתן לטעון את פרטי האימון
        </p>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="btn-primary"
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
      className="min-h-screen pb-28"
      style={{ background: 'var(--bone)' }}
      dir="rtl"
    >
      {/* Header */}
      <div className="masthead safe-area-top sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="w-10 h-10 flex items-center justify-center"
            style={{ background: 'var(--mustard)', color: 'var(--navy)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="kicker">WORKOUT DETAIL</div>
            <h1
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 'clamp(32px, 8vw, 48px)',
                fontWeight: 800,
                lineHeight: 0.9,
                color: 'var(--bone)',
              }}
            >
              פרטי אימון
            </h1>
          </div>
          {session.rating && (
            <div className="flex items-center gap-1" style={{ color: 'var(--mustard)' }}>
              <Star size={16} fill="currentColor" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>{session.rating}</span>
            </div>
          )}
        </div>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            color: 'var(--mustard)',
            textTransform: 'uppercase',
          }}
        >
          {formatDate(session.date || session.startTime)}
        </p>
      </div>

      <div className="px-5 pt-5">
        {/* Time Info */}
        <div className="card-outlined mb-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: 'var(--navy)' }} />
              <span style={{ fontFamily: 'var(--font-hebrew)', fontSize: '14px', color: 'var(--stone)' }}>
                שעת התחלה
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
              {formatTime(session.startTime)}
            </span>
          </div>
          <div style={{ height: '1px', background: 'var(--bone-deep)' }} />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: 'var(--mustard)' }} />
              <span style={{ fontFamily: 'var(--font-hebrew)', fontSize: '14px', color: 'var(--stone)' }}>
                שעת סיום
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
              {session.endTime ? formatTime(session.endTime) : '—'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="data-strip mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} style={{ color: 'var(--navy)' }} />
              <span className="eyebrow">DURATION</span>
            </div>
            <div className="val">
              {Math.round(session.duration / 60)}
              <em>MIN</em>
            </div>
            <div className="lbl">משך האימון</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell size={12} style={{ color: 'var(--navy)' }} />
              <span className="eyebrow">VOLUME</span>
            </div>
            <div className="val">
              {formatVolume(session.totalVolume)}
              <em>KG</em>
            </div>
            <div className="lbl">נפח כולל</div>
          </div>
        </div>

        {/* Extra stats */}
        <div className="data-strip mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={12} style={{ color: 'var(--navy)' }} />
              <span className="eyebrow">SETS</span>
            </div>
            <div className="val">
              {totalSets}
            </div>
            <div className="lbl">{totalReps} חזרות</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame size={12} style={{ color: 'var(--navy)' }} />
              <span className="eyebrow">CALORIES</span>
            </div>
            <div className="val">
              {estimatedCalories}
              <em>KCAL</em>
            </div>
            <div className="lbl">משוער</div>
          </div>
        </div>

        {/* Muscle Breakdown */}
        <MuscleBreakdown exercises={session.exercises} />

        {/* Comparison with Previous */}
        <div className="mb-6">
          <WorkoutComparison current={session} previous={previousSession} />
        </div>

        {/* Exercises Section */}
        <div className="mb-6">
          <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
            <span className="left">§ EXERCISES · {session.exercises.length}</span>
            <span className="right">תרגילים</span>
          </div>

          <div className="space-y-3 mt-4">
            {session.exercises.map((exercise, index) => (
              <ExerciseCard key={exercise.id || index} exercise={exercise} index={index} />
            ))}
          </div>
        </div>

        {/* Notes Section */}
        {session.notes && (
          <div className="card-outlined mb-6">
            <h3 className="section-title mb-2">§ NOTES · הערות</h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6 }}>
              {session.notes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="btn-row mb-6">
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="btn-primary focus-ring flex items-center justify-center gap-2"
          >
            <ArrowRight size={16} />
            חזרה להיסטוריה
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary focus-ring"
          >
            דשבורד
          </button>
        </div>
      </div>
    </div>
  );
}
