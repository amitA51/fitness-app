/**
 * Workout Detail Page - Displays a completed workout session in detail
 * Shows all exercises, sets, reps, weights, and overall stats.
 *
 * Data loading lives in useWorkoutDetail; presentational pieces and the
 * previous-session/share helpers live under ./workout-detail. Set/volume/rep
 * math is delegated to the canonical workoutMath SSOT.
 */

import { m, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Dumbbell,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkoutComparison } from '../components/fitness/WorkoutComparison';
import {
  formatDuration,
  formatHebrewDate,
  formatHebrewTime,
  formatVolume,
} from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { computeSessionStats } from '../utils/workoutMath';
import { DetailSkeleton } from './workout-detail/DetailSkeleton';
import { ExerciseCard } from './workout-detail/ExerciseCard';
import { MuscleBreakdown } from './workout-detail/MuscleBreakdown';
import { StatItem } from './workout-detail/StatItem';
import { buildShareText } from './workout-detail/helpers';
import { useWorkoutDetail } from './workout-detail/useWorkoutDetail';

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() ?? false;

  const { session, previousSession, loading, error } = useWorkoutDetail(id);

  const handleShare = useCallback(async () => {
    if (!session) return;

    const text = buildShareText(session);

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
        className="min-h-screen min-h-[100dvh]"
        style={{
          background: 'var(--fs-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
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
            color: 'var(--color-ink-on-dark)',
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

  const { totalSets, totalReps } = computeSessionStats(session);

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
        <m.div
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
        </m.div>

        {/* Stats Grid */}
        <m.div
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
        </m.div>

        {/* Goal Badge */}
        {session.goalType && (
          <m.div
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
                marginInlineEnd: 'auto',
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
          </m.div>
        )}

        {/* Muscle Breakdown */}
        <MuscleBreakdown exercises={session.exercises} reduceMotion={reduceMotion} />

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
              <ExerciseCard
                key={exercise.id || index}
                exercise={exercise}
                index={index}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </div>

        {/* Next time recommendation */}
        <m.div
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
              : 'המשך לעקוב אחר ההתקדמות שלך לאורך זמן.'}
          </p>
        </m.div>

        {/* Notes Section */}
        {session.notes && (
          <m.div
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
          </m.div>
        )}

        {/* Action Buttons */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-accent)]"
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
            <ArrowLeft size={14} />
            חזרה לבית
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="שתף אימון"
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-accent)]"
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
              color: 'var(--color-ink-on-accent)',
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
        </m.div>
      </div>
    </div>
  );
}
