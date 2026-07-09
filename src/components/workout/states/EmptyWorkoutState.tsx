// EmptyWorkoutState - Fresh Steel / Obsidian
// Shown when the user is inside an empty workout (no exercises yet).
// Priority: answer "what do I do now?" in under 3 seconds.

import { m } from 'framer-motion';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerHaptic } from '../../../utils/haptics';
import { CoachMark } from '../../guidance/CoachMark';

interface EmptyWorkoutStateProps {
  /** Whether OLED mode is enabled */
  oledMode: boolean;
  /** Callback when user wants to add an exercise */
  onAddExercise: () => void;
  /** Callback when user wants to cancel the workout */
  onCancel: () => void;
}

const STEPS = [
  { n: '1', text: 'הוסיפו תרגיל מהספרייה' },
  { n: '2', text: 'הזינו משקל וחזרות' },
  { n: '3', text: 'החליקו לסיום סט — מנוחה מתחילה' },
] as const;

const EmptyWorkoutState = React.memo<EmptyWorkoutStateProps>(
  ({ oledMode: _oledMode, onAddExercise, onCancel }) => {
    const navigate = useNavigate();

    return (
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
        aria-label="אימון ריק — בחרו תרגיל"
      >
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-surface scrim-noise"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 340,
            width: '100%',
            padding: '28px 20px',
            textAlign: 'center',
            borderRadius: '24px 16px 24px 16px',
            border: '1px solid var(--fs-surface-2)',
          }}
        >
          {/* Icon */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="section-spotlight"
            style={{
              width: 80,
              height: 80,
              background: 'var(--fs-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              borderRadius: 18,
              color: 'var(--color-ink-on-accent)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6.5 6.5h3v11h-3v-11zm8 0h3v11h-3v-11zM4 9h2.5v6H4V9zm13.5 0H20v6h-2.5V9zM9.5 11h5v2h-5v-2z"
                fill="currentColor"
              />
            </svg>
          </m.div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 24,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            אין תרגילים עדיין
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-muted)',
              lineHeight: 1.55,
              marginBottom: 18,
            }}
          >
            הוסיפו תרגיל ראשון כדי להתחיל לרשום סטים. אפשר גם לבחור תבנית מוכנה.
          </p>

          {/* Numbered mental model */}
          <ol
            style={{
              listStyle: 'none',
              margin: '0 0 20px',
              padding: 0,
              width: '100%',
              display: 'grid',
              gap: 10,
              textAlign: 'start',
            }}
          >
            {STEPS.map((step) => (
              <li
                key={step.n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fs-primary)',
                    color: 'var(--fs-accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {step.n}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {step.text}
                </span>
              </li>
            ))}
          </ol>

          <div style={{ width: '100%', marginBottom: 16, textAlign: 'start' }}>
            <CoachMark hintKey="hintWorkout">
              אחרי כל סט — החליקו את הכפתור למטה. המנוחה תתחיל אוטומטית.
            </CoachMark>
          </div>

          {/* Primary: add exercise */}
          <m.button
            onClick={() => {
              triggerHaptic('medium');
              onAddExercise();
            }}
            whileTap={{ scale: 0.98 }}
            className="start-workout-btn accent-glow"
            style={{
              width: '100%',
              minHeight: 56,
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              border: '2px solid var(--fs-accent)',
              borderRadius: 'var(--radius-asymmetric)',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
            }}
            aria-label="הוסיפו תרגיל ראשון"
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
            הוסיפו תרגיל ראשון
          </m.button>

          {/* Secondary: templates */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              navigate('/templates');
            }}
            style={{
              width: '100%',
              minHeight: 48,
              background: 'var(--fs-surface)',
              color: 'var(--fs-ink)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 'var(--radius-asymmetric)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 12,
            }}
            aria-label="בחרו תבנית מוכנה"
          >
            בחרו תבנית מוכנה במקום
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            style={{
              minHeight: 44,
              padding: '0 16px',
              background: 'transparent',
              color: 'var(--fs-muted)',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            aria-label="ביטול האימון וחזרה"
          >
            ביטול וחזרה
          </button>
        </m.div>
      </div>
    );
  }
);

EmptyWorkoutState.displayName = 'EmptyWorkoutState';

export default EmptyWorkoutState;
