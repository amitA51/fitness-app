import { m } from 'framer-motion';
import { Calendar, Check, Clock, Target } from 'lucide-react';
import type { OnboardingData } from '../types';

interface CompleteStepProps {
  data: OnboardingData;
}

export function CompleteStep({ data }: CompleteStepProps) {
  const getGoalLabel = (goal: string) => {
    const labels: Record<string, string> = {
      strength: 'בניית כוח',
      muscle: 'בניית שריר',
      endurance: 'סיבולת',
      weight_loss: 'ירידה במשקל',
      general: 'כושר כללי',
    };
    return labels[goal] || goal;
  };

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full items-center justify-center text-center px-6 py-8"
    >
      {/* Success Animation */}
      <m.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="w-28 h-28 flex items-center justify-center mb-8"
        style={{
          background: 'var(--fs-accent)',
          borderRadius: '22px 16px 22px 16px',
          // ink-on-accent — fs-heading is near-white in dark mode and the
          // check would disappear on the bright mint block
          color: 'var(--color-ink-on-accent)',
        }}
      >
        <Check size={56} strokeWidth={3} />
      </m.div>

      <m.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '32px',
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
        }}
      >
        {data.name ? `${data.name}, ` : ''}מוכן לאימון!
      </m.h1>

      <m.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          color: 'var(--fs-muted)',
          marginBottom: '32px',
        }}
      >
        הפרופיל שלך הוגדר. בואו נתחיל!
      </m.p>

      {/* Summary Cards */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full space-y-3"
      >
        {data.primaryGoal && (
          <div
            className="p-4 flex items-center gap-4"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background: 'var(--fs-primary)',
                color: 'var(--fs-accent)',
                borderRadius: 0,
              }}
            >
              <Target size={22} />
            </div>
            <div className="text-right flex-1">
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                המטרה שלך
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: 'var(--fs-ink)',
                }}
              >
                {getGoalLabel(data.primaryGoal)}
              </p>
            </div>
          </div>
        )}

        <div
          className="p-4 flex items-center gap-4"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <div
            className="w-12 h-12 flex items-center justify-center shrink-0"
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)', borderRadius: 0 }}
          >
            <Calendar size={22} />
          </div>
          <div className="text-right flex-1">
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              תדירות אימונים
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.preferredWorkoutDays} ימים בשבוע
            </p>
          </div>
        </div>

        <div
          className="p-4 flex items-center gap-4"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <div
            className="w-12 h-12 flex items-center justify-center shrink-0"
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)', borderRadius: 0 }}
          >
            <Clock size={22} />
          </div>
          <div className="text-right flex-1">
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              משך כל אימון
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.workoutDuration} דקות
            </p>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
