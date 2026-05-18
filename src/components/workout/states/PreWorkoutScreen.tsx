/**
 * PreWorkoutScreen - Welcome screen before starting workout
 * Sport Annual Editorial Design (VISION)
 * Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
 */

import { AnimatePresence, type Variants, motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  type LastWorkoutSummary,
  type MuscleGroupLastTrained,
  getLastWorkoutSummary,
  getMuscleGroupDaysSince,
} from '../../../services/analyticsService';
import { getWorkoutSessions } from '../../../services/dataService';
import { getWorkoutTemplates } from '../../../services/workoutDb';
import type { WorkoutTemplate } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { DumbbellIcon } from '../../icons';

const NOISE_TEXTURE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const getGreeting = (): { text: string } => {
  const hour = new Date().getHours();
  if (hour < 5) return { text: 'לילה טוב' };
  if (hour < 12) return { text: 'בוקר טוב' };
  if (hour < 17) return { text: 'צהריים טובים' };
  if (hour < 21) return { text: 'ערב טוב' };
  return { text: 'לילה טוב' };
};

const getTodayDate = (): { day: string; full: string } => {
  const now = new Date();
  return {
    day: now.toLocaleDateString('he-IL', { weekday: 'short' }).toUpperCase(),
    full: now.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
    }),
  };
};

const MUSCLE_SUGGESTIONS: Record<string, string> = {
  Chest: 'חזה',
  Back: 'גב',
  Shoulders: 'כתפיים',
  Biceps: 'זרועות קידמיות',
  Triceps: 'זרועות אחוריות',
  Quadriceps: 'ירכיים קידמיות',
  Hamstrings: 'ירכיים אחוריות',
  Glutes: 'ישבן',
  Calves: 'שוקיים',
  Abs: 'בטן',
  Core: 'ליבה',
};

interface PreWorkoutScreenProps {
  oledMode: boolean;
  onStartWorkout: () => void;
  onCancel: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

interface PreWorkoutScreenFC extends React.FC<PreWorkoutScreenProps> {
  displayName?: string;
}

const PreWorkoutScreen: PreWorkoutScreenFC = ({
  oledMode,
  onStartWorkout,
  onCancel,
  onSelectTemplate,
}) => {
  const [favoriteTemplates, setFavoriteTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentMuscles, setRecentMuscles] = useState<MuscleGroupLastTrained[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null);
  const [workoutStreak, setWorkoutStreak] = useState(0);
  const greeting = getGreeting();
  const { day, full: todayFull } = getTodayDate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sessions, templates] = await Promise.all([
          getWorkoutSessions(50),
          getWorkoutTemplates().catch(() => []),
        ]);

        const favorites = templates.filter((t) => t.isFavorite).slice(0, 4);
        setFavoriteTemplates(favorites);

        const muscleData = getMuscleGroupDaysSince(sessions);
        setRecentMuscles(muscleData.sort((a, b) => b.daysSince - a.daysSince));

        const lastSummary = getLastWorkoutSummary(sessions);
        setLastWorkout(lastSummary);

        // Calculate streak
        if (sessions.length > 0) {
          const sortedSessions = sessions
            .filter((s) => s.status === 'completed')
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          let streak = 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          for (let i = 0; i < sortedSessions.length; i++) {
            const sessionDate = new Date(sortedSessions[i]?.startTime ?? 0);
            sessionDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor(
              (today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (i === 0 && daysDiff <= 1) {
              streak = 1;
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() - 1);
              for (let j = 1; j < sortedSessions.length; j++) {
                const prevDate = new Date(sortedSessions[j]?.startTime ?? 0);
                prevDate.setHours(0, 0, 0, 0);
                const prevDiff = Math.floor(
                  (checkDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (prevDiff === 0) {
                  streak++;
                  checkDate.setDate(checkDate.getDate() - 1);
                } else break;
              }
            } else break;
          }
          setWorkoutStreak(streak);
        }
      } catch {
        // silently handle
      }
    };

    loadData();
  }, []);

  const suggestion = useMemo(() => {
    const neglectedMuscles = recentMuscles.filter((m) => m.daysSince >= 3);

    if (neglectedMuscles.length > 0) {
      const muscle = neglectedMuscles[0];
      if (!muscle) return null;
      const hebrewName = MUSCLE_SUGGESTIONS[muscle.muscle] || muscle.muscle;
      const daysText = muscle.daysSince === 1 ? 'יום' : `${muscle.daysSince} ימים`;
      return {
        text: `מזמן לא אימנת ${hebrewName}`,
        subtext: `בפעם האחרונה לפני ${daysText}`,
        type: 'neglected' as const,
      };
    }

    if (lastWorkout && lastWorkout.muscleGroups.length > 0) {
      const lastMuscle = lastWorkout.muscleGroups[0];
      if (!lastMuscle) return null;
      const hebrewName = MUSCLE_SUGGESTIONS[lastMuscle] || lastMuscle;
      const complements: Record<string, string> = {
        Chest: 'Back',
        Back: 'Chest',
        Quadriceps: 'Hamstrings',
        Hamstrings: 'Quadriceps',
        Biceps: 'Triceps',
        Triceps: 'Biceps',
        Shoulders: 'Back',
      };
      const complement = complements[lastMuscle];
      if (complement) {
        const complementHe = MUSCLE_SUGGESTIONS[complement] || complement;
        return {
          text: `מה עם ${complementHe} היום?`,
          subtext: `אימנת ${hebrewName} לאחרונה`,
          type: 'complement' as const,
        };
      }
    }

    return {
      text: 'מה נתאמן היום?',
      subtext: 'בחר את התרגילים שלך',
      type: 'default' as const,
    };
  }, [recentMuscles, lastWorkout]);

  const handleStartWorkout = () => {
    triggerHaptic('medium');
    onStartWorkout();
  };

  const handleTemplateSelect = (template: WorkoutTemplate) => {
    triggerHaptic('light');
    if (onSelectTemplate) {
      onSelectTemplate(template.id);
    } else {
      onStartWorkout();
    }
  };

  const handleCancel = () => {
    triggerHaptic('light');
    onCancel();
  };

  const lastWorkoutLabel = useMemo(() => {
    if (!lastWorkout) return null;
    const diffMs = Date.now() - new Date(lastWorkout.date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let timeLabel: string;
    if (diffDays === 0) timeLabel = 'היום';
    else if (diffDays === 1) timeLabel = 'אתמול';
    else if (diffDays < 7) timeLabel = `לפני ${diffDays} ימים`;
    else timeLabel = `לפני ${Math.floor(diffDays / 7)} שבועות`;
    return {
      volume: lastWorkout.totalVolume,
      exercises: lastWorkout.exerciseCount,
      timeLabel,
    };
  }, [lastWorkout]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto overscroll-contain ambient-mesh ambient-mesh-soft"
      style={{
        background: oledMode ? '#0B1A2B' : 'var(--fs-bg)',
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="main"
      aria-label="מסך פתיחה לפני אימון"
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url('${NOISE_TEXTURE_SVG}')`,
          mixBlendMode: 'multiply',
        }}
        aria-hidden="true"
      />

      {/* ── NAVY MASTHEAD ── */}
      <div
        className="relative z-10 flex-shrink-0 glass-surface-dark scrim-noise"
        style={{ background: 'var(--fs-primary)' }}
      >
        {/* Chapter strip */}
        <div className="chapter-break" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="left" style={{ color: 'var(--fs-accent)' }}>
            §01 · אימון
          </span>
          <span className="right">
            {day} · {todayFull}
          </span>
        </div>

        {/* Main greeting area */}
        <div className="px-5 pt-6 pb-8">
          {/* Greeting + date row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 48,
                  color: '#FFFFFF',
                  lineHeight: 0.88,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              >
                {greeting.text}
              </h1>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3" style={{ gap: 0 }}>
            {/* Sets */}
            <div
              className="text-center"
              style={{
                padding: '12px 8px',
                borderRight: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                className="kinetic-number"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 36,
                  color: 'var(--fs-accent)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'center',
                }}
              >
                {lastWorkoutLabel ? lastWorkoutLabel.exercises : '—'}
              </div>
              <div
                className="uppercase mt-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                סטים
              </div>
            </div>

            {/* Volume */}
            <div
              className="text-center"
              style={{
                padding: '12px 8px',
                borderRight: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                className="kinetic-number"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 36,
                  color: '#FFFFFF',
                  lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'center',
                }}
              >
                {lastWorkoutLabel && lastWorkoutLabel.volume > 0
                  ? lastWorkoutLabel.volume >= 1000
                    ? `${(lastWorkoutLabel.volume / 1000).toFixed(1)}k`
                    : lastWorkoutLabel.volume
                  : '—'}
              </div>
              <div
                className="uppercase mt-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                ק"ג
              </div>
            </div>

            {/* Streak */}
            <div className="text-center" style={{ padding: '12px 8px' }}>
              <div
                className="kinetic-number"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 36,
                  color: workoutStreak > 0 ? 'var(--fs-accent)' : '#FFFFFF',
                  lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'center',
                }}
              >
                {workoutStreak > 0 ? workoutStreak : '—'}
              </div>
              <div
                className="uppercase mt-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                ימים
              </div>
            </div>
          </div>

          {/* Last workout label */}
          {lastWorkoutLabel && (
            <div
              className="mt-3 text-center"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                direction: 'ltr',
              }}
            >
              אימון אחרון {lastWorkoutLabel.timeLabel} · {lastWorkoutLabel.exercises} תרגילים
            </div>
          )}
        </div>
      </div>

      {/* ── BONE BODY ── */}
      <div className="relative z-10 flex-1 flex flex-col px-5 pt-6 pb-8">
        <AnimatePresence mode="sync">
          {/* Suggestion card */}
          {suggestion && (
            <motion.div key="suggestion" variants={itemVariants} className="mb-5">
              <div
                className="relative"
                style={{
                  background: 'var(--fs-accent)',
                  padding: '20px 20px',
                }}
              >
                {/* Ribbon */}
                <div
                  className="absolute top-0 left-0 px-2 py-1"
                  style={{
                    background: 'var(--fs-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: 'var(--fs-accent)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {suggestion.type === 'neglected'
                    ? 'מומלץ'
                    : suggestion.type === 'complement'
                      ? 'משלים'
                      : 'התחל'}
                </div>

                <div className="pt-3">
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 22,
                      color: 'var(--fs-primary)',
                      lineHeight: 1,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {suggestion.text}
                  </p>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      color: 'rgba(20,41,61,0.6)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {suggestion.subtext}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Templates section */}
          {favoriteTemplates.length > 0 && (
            <motion.div key="templates" variants={itemVariants} className="mb-5">
              <div
                className="mb-3"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                }}
              >
                §02 · התבניות שלך
              </div>

              <div
                className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none"
                style={{
                  display: 'flex',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  gap: 8,
                  paddingBottom: 4,
                }}
              >
                {favoriteTemplates.map((template, index) => (
                  <motion.button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="template-card fs-accent-rail"
                    style={{
                      background: 'var(--fs-surface-2)',
                      border: '2px solid var(--fs-primary)',
                      borderRadius: '20px 14px 20px 14px',
                      padding: '14px',
                      cursor: 'pointer',
                      textAlign: 'right',
                      transition: 'all 150ms',
                      minHeight: 72,
                      minWidth: 160,
                      flexShrink: 0,
                      scrollSnapAlign: 'start',
                    }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.07 }}
                    onPointerDown={(e) => {
                      e.currentTarget.style.background = 'var(--fs-surface)';
                    }}
                    onPointerUp={(e) => {
                      e.currentTarget.style.background = 'var(--fs-surface-2)';
                    }}
                    onPointerLeave={(e) => {
                      e.currentTarget.style.background = 'var(--fs-surface-2)';
                    }}
                    aria-label={`התחל תבנית ${template.name}`}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 13,
                        color: 'var(--fs-primary)',
                        lineHeight: 1.1,
                        letterSpacing: '-0.01em',
                        marginBottom: 4,
                      }}
                      className="line-clamp-2"
                    >
                      {template.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.15em',
                        color: 'var(--fs-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {template.exercises?.length || 0} תרגילים
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* CTA Button */}
          <motion.div
            key="cta"
            variants={itemVariants}
            className="mt-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Start Workout Button */}
            <button
              type="button"
              onClick={handleStartWorkout}
              className="start-workout-btn accent-glow w-full focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '20px 24px',
                color: 'var(--fs-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                minHeight: 60,
              }}
              aria-label="התחל אימון"
            >
              <DumbbellIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
              התחל אימון
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancel}
              className="w-full mt-3 focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 24px',
                background: 'transparent',
                color: 'var(--fs-muted)',
                border: '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                minHeight: 48,
                transition: 'all 150ms',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.color = 'var(--fs-primary)';
                e.currentTarget.style.borderColor = 'var(--fs-primary)';
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.color = 'var(--fs-muted)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.color = 'var(--fs-muted)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              aria-label="ביטול וחזרה לדשבורד"
            >
              ביטול
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

PreWorkoutScreen.displayName = 'PreWorkoutScreen';

export default PreWorkoutScreen;
