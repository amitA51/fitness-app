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
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="glass-surface"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 360,
            width: '100%',
            padding: '28px 22px',
            textAlign: 'center',
            borderRadius: 'var(--radius-2xl)',
            border: 'none',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <m.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            style={{
              width: 64,
              height: 64,
              background: 'color-mix(in srgb, var(--fs-accent) 16%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              borderRadius: 9999,
              color: 'var(--fs-accent)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6.5 6.5h3v11h-3v-11zm8 0h3v11h-3v-11zM4 9h2.5v6H4V9zm13.5 0H20v6h-2.5V9zM9.5 11h5v2h-5v-2z"
                fill="currentColor"
              />
            </svg>
          </m.div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 26,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.022em',
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            אין תרגילים עדיין
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--fs-muted)',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
              marginBottom: 18,
            }}
          >
            הוסיפו תרגיל ראשון כדי להתחיל לרשום סטים. אפשר גם לבחור תבנית מוכנה.
          </p>

          <ol
            style={{
              listStyle: 'none',
              margin: '0 0 18px',
              padding: 0,
              width: '100%',
              display: 'grid',
              gap: 12,
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
                    background: 'var(--fs-surface-2)',
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {step.n}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.text}
                </span>
              </li>
            ))}
          </ol>

          <m.button
            onClick={() => {
              triggerHaptic('medium');
              onAddExercise();
            }}
            whileTap={{ scale: 0.98 }}
            className="start-workout-btn"
            style={{ marginBottom: 10 }}
            aria-label="הוסיפו תרגיל ראשון"
          >
            <span style={{ fontSize: 22, lineHeight: 1, fontWeight: 500 }}>+</span>
            הוסיפו תרגיל ראשון
          </m.button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              navigate('/templates');
            }}
            className="cta-secondary"
            style={{ marginBottom: 8 }}
            aria-label="בחרו תבנית מוכנה"
          >
            בחרו תבנית מוכנה במקום
          </button>

          <div style={{ width: '100%', marginTop: 4, marginBottom: 8, textAlign: 'start' }}>
            <CoachMark hintKey="hintWorkout">
              אחרי כל סט — החליקו את הכפתור למטה. המנוחה תתחיל אוטומטית.
            </CoachMark>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="cta-ghost"
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
