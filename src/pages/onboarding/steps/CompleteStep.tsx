import { m } from 'framer-motion';
import {
  Calendar,
  Check,
  ChevronLeft,
  ClipboardList,
  Clock,
  Dumbbell,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useHaptics } from '../../../hooks/useHaptics';
import type { OnboardingData } from '../types';

interface CompleteStepProps {
  data: OnboardingData;
  /**
   * Finish onboarding. `toFirstAction=true` deep-links into the user's highest-
   * intent next step (trainee → workout flow, coach → invite flow); the quiet
   * secondary path finishes onto the default home instead.
   */
  onFinish: (toFirstAction: boolean) => void;
}

const labelStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--fs-muted)',
  letterSpacing: '-0.01em',
} as const;

const valueStyle = {
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: 16,
  color: 'var(--fs-ink)',
  letterSpacing: '-0.01em',
} as const;

const cardStyle = {
  background: 'var(--fs-surface)',
  border: '1px solid color-mix(in srgb, var(--color-border) 90%, transparent)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--elevation-1)',
} as const;

const iconBoxStyle = {
  background: 'color-mix(in srgb, var(--fs-accent) 14%, transparent)',
  color: 'var(--fs-accent)',
  borderRadius: 9999,
} as const;

export function CompleteStep({ data, onFinish }: CompleteStepProps) {
  const isCoach = data.role === 'coach';

  const { hapticSuccess } = useHaptics();
  useEffect(() => {
    const t = setTimeout(hapticSuccess, 200);
    return () => clearTimeout(t);
  }, [hapticSuccess]);

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
      className="flex flex-col h-full items-center justify-center text-center px-6 py-8 overflow-y-auto"
      style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
    >
      <m.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="w-28 h-28 flex items-center justify-center mb-8"
        style={{
          background: 'var(--fs-accent)',
          borderRadius: 'var(--radius-2xl)',
          color: 'var(--color-ink-on-accent)',
        }}
      >
        <Check size={56} strokeWidth={3} />
      </m.div>

      <m.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        className="inline-flex items-center gap-2 mb-5"
        style={{
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          borderRadius: 9999,
          padding: '6px 14px',
        }}
      >
        {isCoach ? <Users size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />}
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {isCoach ? 'מאמן' : 'מתאמן'}
        </span>
      </m.div>

      <m.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 32,
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
        }}
      >
        {data.name ? `${data.name}, ` : ''}
        {isCoach ? 'מרכז המאמן מוכן!' : 'מוכנים לאימון!'}
      </m.h1>

      <m.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--fs-muted)',
          marginBottom: 32,
          letterSpacing: '-0.01em',
          lineHeight: 1.5,
        }}
      >
        {isCoach
          ? 'נהלו מתאמנים, שלחו תוכניות ויעדים ועקבו אחרי ההתקדמות שלהם — הכל ממקום אחד.'
          : 'הפרופיל הוגדר. בשלב הבא תבחרו תבנית אימון ותתחילו — זה לוקח דקה.'}
      </m.p>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full space-y-3"
      >
        {isCoach && (
          <>
            <CoachNextCard
              icon={<UserPlus size={22} />}
              kicker="צעד ראשון"
              label="הזמינו מתאמנים עם קוד הזמנה"
              onClick={() => onFinish(true)}
            />
            <CoachNextCard
              icon={<ClipboardList size={22} />}
              kicker="צעד שני"
              label="בנו תוכנית אימון בספרייה"
            />
            <CoachNextCard
              icon={<Users size={22} />}
              kicker="צעד שלישי"
              label="עקבו אחרי הביצועים בזמן אמת"
            />
          </>
        )}
        {!isCoach && data.primaryGoal && (
          <div className="p-4 flex items-center gap-4" style={cardStyle}>
            <div className="w-12 h-12 flex items-center justify-center shrink-0" style={iconBoxStyle}>
              <Target size={22} />
            </div>
            <div className="text-right flex-1">
              <p style={labelStyle}>המטרה שלך</p>
              <p style={valueStyle}>{getGoalLabel(data.primaryGoal)}</p>
            </div>
          </div>
        )}

        {!isCoach && (
          <div className="p-4 flex items-center gap-4" style={cardStyle}>
            <div className="w-12 h-12 flex items-center justify-center shrink-0" style={iconBoxStyle}>
              <Calendar size={22} />
            </div>
            <div className="text-right flex-1">
              <p style={labelStyle}>תדירות אימונים</p>
              <p style={{ ...valueStyle, fontVariantNumeric: 'tabular-nums' }}>
                {data.preferredWorkoutDays} ימים בשבוע
              </p>
            </div>
          </div>
        )}

        {!isCoach && (
          <div className="p-4 flex items-center gap-4" style={cardStyle}>
            <div className="w-12 h-12 flex items-center justify-center shrink-0" style={iconBoxStyle}>
              <Clock size={22} />
            </div>
            <div className="text-right flex-1">
              <p style={labelStyle}>משך כל אימון</p>
              <p style={{ ...valueStyle, fontVariantNumeric: 'tabular-nums' }}>
                {data.workoutDuration} דקות
              </p>
            </div>
          </div>
        )}
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full mt-8 space-y-3"
      >
        <button
          type="button"
          onClick={() => onFinish(true)}
          className="start-workout-btn focus-ring"
          style={{ minHeight: 56 }}
        >
          {isCoach ? (
            <>
              <UserPlus size={20} aria-hidden="true" />
              הזמינו מתאמן ראשון
            </>
          ) : (
            <>
              <Dumbbell size={20} aria-hidden="true" />
              בואו נתחיל — אימון ראשון
            </>
          )}
          <ChevronLeft size={22} aria-hidden="true" />
        </button>

        <button type="button" onClick={() => onFinish(false)} className="cta-ghost focus-ring w-full">
          כניסה למסך הבית
        </button>
      </m.div>
    </m.div>
  );
}

function CoachNextCard({
  icon,
  kicker,
  label,
  onClick,
}: {
  icon: ReactNode;
  kicker: string;
  label: string;
  onClick?: () => void;
}) {
  const isInteractive = typeof onClick === 'function';
  const inner = (
    <>
      <div className="w-12 h-12 flex items-center justify-center shrink-0" style={iconBoxStyle}>
        {icon}
      </div>
      <div className="text-right flex-1">
        <p style={labelStyle}>{kicker}</p>
        <p style={valueStyle}>{label}</p>
      </div>
      {isInteractive && (
        <ChevronLeft size={20} aria-hidden="true" style={{ color: 'var(--fs-accent)', flexShrink: 0 }} />
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full p-4 flex items-center gap-4 text-right active:scale-[0.98] transition-transform focus-ring"
        style={{ ...cardStyle, cursor: 'pointer' }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="p-4 flex items-center gap-4" style={cardStyle}>
      {inner}
    </div>
  );
}
