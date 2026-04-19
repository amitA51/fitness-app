/**
 * EmptyWorkoutState - Empty state display when no exercises are added
 * Extracted from ActiveWorkoutNew.tsx for better code organization
 */

import { type Variants, motion } from 'framer-motion';
import React from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { DumbbellIcon } from '../../icons';

// Constants
const NOISE_TEXTURE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;

// Animation Variants
const containerVariants: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
};

const iconVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      duration: 2,
      ease: 'easeInOut',
    },
  },
};

const buttonVariants: Variants = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(99,102,241,0.4)',
      '0 0 35px rgba(99,102,241,0.6)',
      '0 0 20px rgba(99,102,241,0.4)',
    ],
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      duration: 2,
      ease: 'easeInOut',
    },
  },
};

interface EmptyWorkoutStateProps {
  /** Whether OLED mode is enabled (true black background) */
  oledMode: boolean;
  /** Callback when user wants to add an exercise */
  onAddExercise: () => void;
  /** Callback when user wants to cancel the workout */
  onCancel: () => void;
}

const EmptyWorkoutState = React.memo<EmptyWorkoutStateProps>(
  ({ oledMode, onAddExercise, onCancel }) => (
    <div
      className="fixed inset-0 text-[var(--cosmos-text-primary)] font-sans overflow-y-auto overscroll-contain z-[9999] flex flex-col items-center justify-center p-6 text-center transition-colors duration-500"
      style={{ background: oledMode ? '#000000' : 'var(--cosmos-bg-primary)' }}
      role="main"
      aria-label="Empty workout state"
    >
      {/* Background noise texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none z-0 mix-blend-overlay"
        style={{ backgroundImage: `url('${NOISE_TEXTURE_SVG}')` }}
        aria-hidden="true"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center max-w-sm px-4"
      >
        {/* Pulsing dumbbell icon */}
        <motion.div
          className="w-24 h-24 rounded-full bg-[var(--cosmos-accent-primary)]/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.3)]"
          variants={iconVariants}
          animate="animate"
          aria-hidden="true"
        >
          <DumbbellIcon className="w-10 h-10 text-[var(--cosmos-accent-primary)]" />
        </motion.div>

        <h1 className="text-3xl font-bold mb-2">בוא נתחיל! 💪</h1>
        <p className="text-[var(--cosmos-text-muted)] mb-8 text-center leading-relaxed">
          בחר את התרגיל הראשון שלך כדי להתחיל את האימון
        </p>

        {/* Add exercise button - 56px height for touch target */}
        <motion.button
          onClick={() => {
            triggerHaptic('medium');
            onAddExercise();
          }}
          className="w-full h-14 min-h-[56px] rounded-2xl bg-[var(--cosmos-accent-primary)] text-white font-bold text-lg tracking-wide shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:brightness-110 transition-all active:scale-95 mb-4 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--cosmos-accent-primary)] focus:ring-offset-2"
          variants={buttonVariants}
          animate="animate"
          aria-label="בחר תרגיל להוספה"
        >
          <span className="text-xl" aria-hidden="true">
            +
          </span>{' '}
          בחר תרגיל
        </motion.button>

        {/* Cancel button - 44px min height for touch target */}
        <button
          onClick={onCancel}
          className="text-sm text-[var(--cosmos-text-muted)] hover:text-white transition-colors min-h-[44px] px-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 rounded-lg"
          aria-label="ביטול האימון"
        >
          ביטול
        </button>
      </motion.div>
    </div>
  )
);

EmptyWorkoutState.displayName = 'EmptyWorkoutState';

export default EmptyWorkoutState;
