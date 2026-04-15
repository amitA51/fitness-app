/**
 * PreWorkoutScreen - Beautiful welcome screen before starting workout
 * Shown BEFORE the exercise selector with motivational greeting,
 * personalized suggestions based on workout history
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { DumbbellIcon, LightningIcon } from '../../icons';
import { triggerHaptic } from '../../../utils/haptics';
import type { WorkoutTemplate } from '../../../types';
import { getWorkoutTemplates } from '../../../services/workoutDb';
import {
  getMuscleGroupDaysSince,
  getLastWorkoutSummary,
  type MuscleGroupLastTrained,
  type LastWorkoutSummary,
} from '../../../services/analyticsService';
import { getWorkoutSessions } from '../../../services/dataService';

// Constants
const NOISE_TEXTURE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } }
};

const floatingVariants: Variants = {
  animate: {
    y: [0, -10, 0],
    transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
  }
};

const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    boxShadow: [
      '0 0 30px rgba(99,102,241,0.3)',
      '0 0 60px rgba(99,102,241,0.5)',
      '0 0 30px rgba(99,102,241,0.3)'
    ],
    transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' }
  }
};

const shimmerVariants: Variants = {
  animate: {
    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    transition: { repeat: Infinity, duration: 4, ease: 'linear' }
  }
};

// Time-based greeting
const getGreeting = (): { text: string; icon: string } => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'בוקר טוב!', icon: '🌅' };
  if (hour < 17) return { text: 'צהריים טובים!', icon: '☀️' };
  if (hour < 20) return { text: 'ערב טוב!', icon: '🌆' };
  return { text: 'לילה טוב!', icon: '🌙' };
};

// Format current date in Hebrew
const getTodayDate = (): string => {
  return new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

// Format date without weekday
const formatDateShort = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short'
  });
};

// Main muscle groups for suggestions
const MUSCLE_SUGGESTIONS: Record<string, string> = {
  'Chest': 'חזה',
  'Back': 'גב',
  'Shoulders': 'כתפיים',
  'Biceps': 'זרועות קידמיות',
  'Triceps': 'זרועות אחוריות',
  'Quadriceps': 'ירכיים קידמיות',
  'Hamstrings': 'ירכיים אחוריות',
  'Glutes': 'ישבן',
  'Calves': 'שוקיים',
  'Abs': 'בטן',
  'Core': 'ליבה',
};

// Inverse mapping for Hebrew
const HEBREW_TO_ENGLISH: Record<string, string> = Object.fromEntries(
  Object.entries(MUSCLE_SUGGESTIONS).map(([en, he]) => [he, en])
);

interface PreWorkoutScreenProps {
  /** Whether OLED mode is enabled */
  oledMode: boolean;
  /** Callback when user wants to start workout (opens exercise selector) */
  onStartWorkout: () => void;
  /** Callback when user wants to cancel */
  onCancel: () => void;
  /** Optional: callback when user selects a template (navigates to workout with template) */
  onSelectTemplate?: (templateId: string) => void;
}

interface PreWorkoutScreenFC extends React.FC<PreWorkoutScreenProps> {
  displayName?: string;
}

const PreWorkoutScreen: PreWorkoutScreenFC = ({ oledMode, onStartWorkout, onCancel }) => {
  const [favoriteTemplates, setFavoriteTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentMuscles, setRecentMuscles] = useState<MuscleGroupLastTrained[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const greeting = getGreeting();
  const todayDate = getTodayDate();

  // Load workout history data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [sessions, templates] = await Promise.all([
          getWorkoutSessions(50),
          getWorkoutTemplates().catch(() => []),
        ]);

        // Get favorite templates
        const favorites = templates.filter(t => t.isFavorite).slice(0, 3);
        setFavoriteTemplates(favorites);

        // Get muscle group training history
        const muscleData = getMuscleGroupDaysSince(sessions);
        setRecentMuscles(muscleData.sort((a, b) => b.daysSince - a.daysSince));

        // Get last workout summary
        const lastSummary = getLastWorkoutSummary(sessions);
        setLastWorkout(lastSummary);
      } catch {
        // Silently handle errors
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate personalized suggestion
  const suggestion = useMemo(() => {
    // Find muscles not trained in 3+ days
    const neglectedMuscles = recentMuscles.filter(m => m.daysSince >= 3);

    if (neglectedMuscles.length > 0) {
      const muscle = neglectedMuscles[0];
      const hebrewName = MUSCLE_SUGGESTIONS[muscle.muscle] || muscle.muscle;
      const daysText = muscle.daysSince === 1 ? 'יום' : `${muscle.daysSince} ימים`;
      return {
        text: `מזמן לא אימנת ${hebrewName}`,
        subtext: `בפעם האחרונה לפני ${daysText}`,
        type: 'neglected' as const,
      };
    }

    // If recently trained chest/back, suggest opposite
    if (lastWorkout && lastWorkout.muscleGroups.length > 0) {
      const lastMuscle = lastWorkout.muscleGroups[0];
      const hebrewName = MUSCLE_SUGGESTIONS[lastMuscle] || lastMuscle;

      // Suggest complementary muscle
      const complements: Record<string, string> = {
        'Chest': 'גב',
        'Back': 'חזה',
        'Quadriceps': 'ירכיים אחוריות',
        'Biceps': 'Triceps',
        'Shoulders': 'גב',
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

    // Default suggestion
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
      // Fallback: just open selector
      onStartWorkout();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 text-[var(--cosmos-text-primary)] font-sans overflow-y-auto overscroll-contain z-[9999] flex flex-col"
      style={{ background: oledMode ? '#000000' : 'var(--cosmos-bg-primary)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="main"
      aria-label="Pre-workout welcome screen"
    >
      {/* Background noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"
        style={{ backgroundImage: `url('${NOISE_TEXTURE_SVG}')` }}
        aria-hidden="true"
      />

      {/* Gradient orb background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <motion.div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/10 blur-[100px]"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-[#06b6d4]/15 to-[#3b82f6]/10 blur-[80px]"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.25, 0.4, 0.25],
          }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        <AnimatePresence mode="sync">

          {/* Hero icon with glow */}
          <motion.div
            key="hero-icon"
            className="mb-8"
            variants={itemVariants}
          >
            <motion.div
              className="relative"
              variants={floatingVariants}
              animate="animate"
            >
              {/* Outer glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] blur-xl opacity-30"
                variants={pulseVariants}
                animate="animate"
              />

              {/* Main icon container */}
              <motion.div
                className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/10 border border-[#6366f1]/30 flex items-center justify-center backdrop-blur-sm"
                variants={shimmerVariants}
                animate="animate"
                style={{
                  backgroundSize: '200% 200%',
                }}
              >
                <DumbbellIcon className="w-14 h-14 text-[#6366f1]" />
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Greeting */}
          <motion.div
            key="greeting"
            className="text-center mb-2"
            variants={itemVariants}
          >
            <h1 className="text-4xl font-black text-white tracking-tight mb-1">
              {greeting.text} {greeting.icon}
            </h1>
          </motion.div>

          {/* Date */}
          <motion.p
            key="date"
            className="text-[#8E8E93] text-base mb-8"
            variants={itemVariants}
          >
            {todayDate}
          </motion.p>

          {/* Suggestion card */}
          <motion.div
            key="suggestion"
            className="w-full mb-8"
            variants={itemVariants}
          >
            <div className="relative bg-[#111111]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5">
              {/* Subtle gradient border effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#6366f1]/10 to-transparent pointer-events-none" />

              <div className="relative flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/10 flex items-center justify-center flex-shrink-0">
                  <LightningIcon className="w-5 h-5 text-[#6366f1]" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-lg font-bold text-white leading-snug">
                    {suggestion.text}
                  </p>
                  <p className="text-sm text-[#8E8E93] mt-1">
                    {suggestion.subtext}
                  </p>
                </div>
              </div>

              {/* Neglected muscles chips */}
              {suggestion.type === 'neglected' && recentMuscles.length > 1 && (
                <div className="mt-4 flex gap-2 justify-end flex-wrap">
                  {recentMuscles.slice(0, 3).map((m) => {
                    const heName = MUSCLE_SUGGESTIONS[m.muscle] || m.muscle;
                    return (
                      <span
                        key={m.muscle}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/[0.05] text-[#8E8E93] border border-white/[0.05]"
                      >
                        {heName}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Main CTA button */}
          <motion.button
            key="cta-button"
            onClick={handleStartWorkout}
            className="w-full h-16 rounded-2xl bg-gradient-to-l from-[#6366f1] to-[#8b5cf6] text-white font-bold text-xl tracking-wide shadow-[0_8px_32px_rgba(99,102,241,0.4)] hover:brightness-110 transition-all active:scale-[0.98] mb-4 flex items-center justify-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-black"
            style={{
              minHeight: '56px',
            }}
            whileTap={{ scale: 0.98 }}
            variants={itemVariants}
            aria-label="התחל אימון"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
            </svg>
            התחל אימון
          </motion.button>

          {/* Quick templates section */}
          {favoriteTemplates.length > 0 && (
            <motion.div
              key="templates"
              className="w-full mt-2"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-xs text-[#8E8E93]">התבניות שלך</span>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 no-scrollbar">
                {favoriteTemplates.map((template, index) => (
                  <motion.button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="flex-shrink-0 min-w-[120px] bg-[#111111]/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 text-right hover:border-[#6366f1]/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50"
                    style={{ minHeight: '88px' }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#6366f1]/15 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-[#6366f1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                      {template.name}
                    </p>
                    <p className="text-xs text-[#8E8E93] mt-1">
                      {template.exercises?.length || 0} תרגילים
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Cancel button */}
          <motion.button
            key="cancel"
            onClick={onCancel}
            className="mt-8 text-sm text-[#8E8E93] hover:text-white transition-colors min-h-[44px] px-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
            style={{ minHeight: '48px' }}
            variants={itemVariants}
            aria-label="ביטול וחזרה"
          >
            ביטול
          </motion.button>

        </AnimatePresence>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10" aria-hidden="true" />
    </motion.div>
  );
};

PreWorkoutScreen.displayName = 'PreWorkoutScreen';

export default PreWorkoutScreen;
