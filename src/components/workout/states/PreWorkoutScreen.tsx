/**
 * PreWorkoutScreen - Welcome screen before starting workout
 * Fresh Steel / Obsidian design language.
 * Primary masthead · surface body · Bricolage Grotesque display + IBM Plex Mono
 */

import { AnimatePresence, type Variants, m } from 'framer-motion';
import { Dumbbell as DumbbellIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateStreak } from '../../../services/achievementService';
import {
  type LastWorkoutSummary,
  type MuscleGroupLastTrained,
  getLastWorkoutSummary,
  getMuscleGroupDaysSince,
} from '../../../services/analyticsService';
import { getWorkoutSessions } from '../../../services/dataService';
import { getWorkoutTemplates } from '../../../services/workoutDb';
import type { WorkoutTemplate } from '../../../types';
import { greeting } from '../../../utils/dateUtils';
import { triggerHaptic } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';

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
  Biceps: 'יד קדמית',
  Triceps: 'יד אחורית',
  Quadriceps: 'ירך קדמית',
  Hamstrings: 'ירך אחורית',
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
  /** Inline coach injection: a coach-assigned program exists (kind === 'program'). */
  hasCoachProgram?: boolean;
  /** Title of the coach-assigned program (falls back to a generic label). */
  coachProgramTitle?: string | null;
  /** True while the coach program is being synced + started. */
  isStartingCoachProgram?: boolean;
  /** Start the coach-assigned program. */
  onStartCoachProgram?: () => void;
  /** Built-in 12-week program: the trainee has started it (kind === 'program'). */
  hasProgram?: boolean;
  /** Title of the built-in program's current day (week · day label). */
  programTitle?: string | null;
  /** One-line context for the program day (e.g. block · exercise count). */
  programSubtitle?: string | null;
  /** True while the program day is being materialized + started. */
  isStartingProgram?: boolean;
  /** Start the built-in program's current day. */
  onStartProgram?: () => void;
}

interface PreWorkoutScreenFC extends React.FC<PreWorkoutScreenProps> {
  displayName?: string;
}

const PreWorkoutScreen: PreWorkoutScreenFC = ({
  oledMode,
  onStartWorkout,
  onCancel,
  onSelectTemplate,
  hasCoachProgram = false,
  coachProgramTitle = null,
  isStartingCoachProgram = false,
  onStartCoachProgram,
  hasProgram = false,
  programTitle = null,
  programSubtitle = null,
  isStartingProgram = false,
  onStartProgram,
}) => {
  const navigate = useNavigate();
  const [favoriteTemplates, setFavoriteTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentMuscles, setRecentMuscles] = useState<MuscleGroupLastTrained[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null);
  const [workoutStreak, setWorkoutStreak] = useState(0);
  const greetingText = greeting();
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

        // Streak — use the canonical calculateStreak so the pre-workout
        // masthead agrees with the summary milestone shown one screen earlier.
        // (Previously a ~30-line hand-rolled loop here could disagree.)
        const completed = sessions.filter((s) => s.status === 'completed');
        setWorkoutStreak(calculateStreak(completed).currentStreak);
      } catch (err) {
        // These stats are decorative — the screen still renders the start CTA
        // and degrades to the "first workout" state. Log (don't swallow) so the
        // failure is diagnosable instead of disappearing.
        logger.workout?.warn?.('PreWorkoutScreen: failed to load history stats', err);
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

  // A genuinely fresh user has no completed history at all. For them the three
  // "—" stat cards are noise, so we swap the stat row for a guiding first-workout
  // empty state instead of showing dashes.
  const hasHistory = !!lastWorkout || workoutStreak > 0;

  return (
    <m.div
      className="fixed inset-0 z-overlay flex flex-col overflow-y-auto overscroll-contain ambient-mesh ambient-mesh-soft"
      style={{
        background: oledMode ? '#000000' : 'var(--fs-bg)',
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
            אימון
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
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 48,
                  color: 'var(--color-ink-on-dark)',
                  lineHeight: 0.88,
                  letterSpacing: '-0.02em',
                  // Hebrew greeting — keep it RTL/start-aligned, not forced LTR-left.
                  textAlign: 'start',
                }}
              >
                {greetingText}
              </h1>
              {/* Quiet guidance caption — demoted from a mint CTA-looking panel
                  to a single muted line so it reads as a hint under the greeting,
                  not a tappable button. The single mint fill is reserved for the
                  real "התחל אימון" primary action below. Static masthead content
                  (no per-child framer-motion variant), so no propagation trap. */}
              {suggestion && (
                <p
                  className="mt-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.35,
                    textAlign: 'start',
                  }}
                >
                  {suggestion.text}
                </p>
              )}
            </div>
          </div>

          {/* Stats row — real history. Brand-new users (no last workout, no
              streak) get a guiding first-workout message instead of three "—". */}
          {hasHistory ? (
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
                    fontWeight: 700,
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
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  תרגילים
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
                    fontWeight: 700,
                    fontSize: 36,
                    color: 'var(--color-ink-on-dark)',
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
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255,255,255,0.78)',
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
                    fontWeight: 700,
                    fontSize: 36,
                    color: workoutStreak > 0 ? 'var(--fs-accent)' : 'var(--color-ink-on-dark)',
                    lineHeight: 0.9,
                    letterSpacing: '-0.02em',
                    direction: 'ltr',
                    textAlign: 'center',
                  }}
                >
                  {workoutStreak > 0 ? workoutStreak : '—'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  ימים
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '4px 4px 8px',
                borderTop: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--color-ink-on-dark)',
                  textAlign: 'center',
                }}
              >
                האימון הראשון שלך
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  letterSpacing: '-0.01em',
                  color: 'rgba(255,255,255,0.78)',
                  textAlign: 'center',
                }}
              >
                3 צעדים: תבנית → סטים → סיום
              </div>
            </div>
          )}

          {/* Last workout label */}
          {lastWorkoutLabel && (
            <div
              className="mt-3 text-center"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.35)',
                direction: 'ltr',
              }}
            >
              אימון אחרון {lastWorkoutLabel.timeLabel}
            </div>
          )}
        </div>
      </div>

      {/* ── BONE BODY ── */}
      <div className="relative z-10 flex-1 flex flex-col px-5 pt-6 pb-8">
        <AnimatePresence mode="sync">
          {/* Coach-assigned program — inline coach injection for the workout
              surface. Tapping it syncs + starts that program's template. */}
          {hasCoachProgram && onStartCoachProgram && (
            // Explicit initial/animate (not parent propagation): blocks that
            // mount after the container finished its entrance otherwise stay
            // stuck at "hidden" and the section ships invisible.
            <m.div
              key="coach-program"
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="mb-5"
            >
              <button
                type="button"
                onClick={onStartCoachProgram}
                disabled={isStartingCoachProgram}
                className="w-full relative focus-ring"
                style={{
                  background: 'var(--fs-primary)',
                  border: '2px solid var(--fs-accent)',
                  padding: '18px 20px',
                  textAlign: 'right',
                  cursor: isStartingCoachProgram ? 'wait' : 'pointer',
                  opacity: isStartingCoachProgram ? 0.7 : 1,
                }}
                aria-label={`התחל את האימון שהמאמן הקצה: ${coachProgramTitle || 'תוכנית אימון'}`}
              >
                {/* Ribbon */}
                <div
                  className="absolute top-0 left-0 px-2 py-1"
                  style={{
                    background: 'var(--fs-accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-primary)',
                    fontWeight: 600,
                  }}
                >
                  מהמאמן
                </div>
                <div className="pt-3">
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-accent)',
                      marginBottom: 6,
                    }}
                  >
                    האימון שהמאמן הקצה לך
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 20,
                      color: 'var(--color-ink-on-dark)',
                      lineHeight: 1.05,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {isStartingCoachProgram ? 'טוען…' : coachProgramTitle || 'תוכנית אימון'}
                  </p>
                </div>
              </button>
            </m.div>
          )}

          {/* Built-in 12-week program — inline entry to the self-guided plan.
              Tapping it materializes the current program day and starts it.
              Same explicit initial/animate as the coach block: it mounts after
              the container's entrance settled, so without its own variants it
              would ship stuck at "hidden" (invisible). */}
          {hasProgram && onStartProgram && (
            <m.div
              key="program"
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="mb-5"
            >
              <button
                type="button"
                onClick={onStartProgram}
                disabled={isStartingProgram}
                className="w-full relative focus-ring fs-accent-rail"
                style={{
                  background: 'var(--fs-surface)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: '20px 14px 20px 14px',
                  padding: '18px 20px',
                  textAlign: 'right',
                  cursor: isStartingProgram ? 'wait' : 'pointer',
                  opacity: isStartingProgram ? 0.7 : 1,
                }}
                aria-label={`התחל את היום הנוכחי בתוכנית האימון: ${programTitle || 'תוכנית אימון'}`}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-accent-2)',
                    marginBottom: 6,
                  }}
                >
                  תוכנית האימון
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 18,
                    color: 'var(--fs-heading)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isStartingProgram ? 'טוען…' : programTitle || 'תוכנית אימון'}
                </p>
                {programSubtitle && !isStartingProgram && (
                  <p
                    className="mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {programSubtitle}
                  </p>
                )}
              </button>
            </m.div>
          )}

          {/* Templates section */}
          {favoriteTemplates.length > 0 && (
            <m.div
              key="templates"
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="mb-5"
            >
              <div
                className="mb-3"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                }}
              >
                התבניות שלך
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
                  <m.button
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
                      // Pointer feedback changes only the surface color; `all` would also
                      // subscribe this horizontally scrolling card to layout and paint work.
                      transition: 'background 150ms var(--ease-out)',
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
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--fs-heading)',
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
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      {pluralizeHe(template.exercises?.length || 0, HE_NOUNS.exercise)}
                    </div>
                  </m.button>
                ))}
              </div>
            </m.div>
          )}

          {/* CTA Block — clear primary + secondary paths */}
          <m.div
            key="cta"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="mt-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {favoriteTemplates.length === 0 && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: 'var(--fs-muted)',
                  margin: '0 0 12px',
                  textAlign: 'center',
                }}
              >
                מומלץ לבחור תבנית מוכנה. אפשר גם להתחיל אימון ריק ולבחור תרגילים.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                navigate('/templates');
              }}
              className="start-workout-btn focus-ring"
              style={{ marginBottom: 10 }}
              aria-label="בחרו תבנית מוכנה"
            >
              <DumbbellIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
              {favoriteTemplates.length > 0 ? 'עוד תבניות' : 'בחרו תבנית מוכנה'}
            </button>

            <button
              type="button"
              onClick={handleStartWorkout}
              className="cta-secondary focus-ring"
              aria-label="התחילו אימון ריק — בחירת תרגילים"
            >
              {hasHistory ? 'אימון ריק — בחרו תרגילים' : 'התחילו בלי תבנית'}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="cta-ghost w-full mt-2 focus-ring"
              aria-label="ביטול וחזרה לבית"
            >
              חזרה לבית
            </button>
          </m.div>
        </AnimatePresence>
      </div>
    </m.div>
  );
};

PreWorkoutScreen.displayName = 'PreWorkoutScreen';

export default PreWorkoutScreen;
