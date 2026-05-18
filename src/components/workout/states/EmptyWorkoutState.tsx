// EmptyWorkoutState - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import React from 'react';
import { triggerHaptic } from '../../../utils/haptics';

interface EmptyWorkoutStateProps {
  /** Whether OLED mode is enabled */
  oledMode: boolean;
  /** Callback when user wants to add an exercise */
  onAddExercise: () => void;
  /** Callback when user wants to cancel the workout */
  onCancel: () => void;
}

const EmptyWorkoutState = React.memo<EmptyWorkoutStateProps>(
  ({ oledMode: _oledMode, onAddExercise, onCancel }) => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--fs-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 9999,
      }}
      role="main"
      aria-label="Empty workout state"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-surface scrim-noise"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 320,
          padding: '0 16px',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="section-spotlight"
          style={{
            width: 96,
            height: 96,
            background: 'var(--fs-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            border: '2px solid var(--fs-primary)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17"
              stroke="var(--fs-primary)"
              strokeWidth="2"
              strokeLinecap="square"
            />
          </svg>
        </motion.div>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 28,
            color: 'var(--fs-primary)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: 8,
          }}
        >
          להתחיל
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          בחר את התרגיל הראשון שלך כדי להתחיל את האימון
        </p>

        {/* Add exercise button */}
        <motion.button
          onClick={() => {
            triggerHaptic('medium');
            onAddExercise();
          }}
          whileTap={{ scale: 0.98 }}
          className="start-workout-btn accent-glow"
          style={{
            width: '100%',
            minHeight: 56,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            border: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#0D1A1C';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--fs-primary)';
          }}
          aria-label="בחר תרגיל להוספה"
        >
          <span style={{ fontSize: 20 }}>+</span> בחר תרגיל
        </motion.button>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          style={{
            minHeight: 44,
            padding: '0 16px',
            background: 'transparent',
            color: 'var(--fs-muted)',
            border: '2px solid var(--fs-surface-2)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--fs-primary)';
            (e.currentTarget as HTMLElement).style.color = 'var(--fs-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--fs-surface-2)';
            (e.currentTarget as HTMLElement).style.color = 'var(--fs-muted)';
          }}
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
