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
import { Button } from '../../../components/ui/Button';
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

export function CompleteStep({ data, onFinish }: CompleteStepProps) {
  const isCoach = data.role === 'coach';

  // One success haptic, timed to land with the checkmark's spring settle
  // (matches the 0.2s delay on the mark below). No-ops when the Settings
  // haptics toggle is off — the hook already gates on it.
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

      {/* Role pill — clear coach vs trainee separation. Uses primary + accent
          only (never --fs-signal: this is identity, not a PR celebration). */}
      <m.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        className="inline-flex items-center gap-2 mb-5"
        style={{
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          borderRadius: '999px',
          padding: '6px 14px',
        }}
      >
        {isCoach ? <Users size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
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
          fontWeight: 800,
          fontSize: '32px',
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
          // No uppercase — a no-op on the Hebrew, and it would wrongly upper-case
          // the user's interpolated name. Leave the name as typed.
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
          fontSize: '15px',
          color: 'var(--fs-muted)',
          marginBottom: '32px',
        }}
      >
        {isCoach
          ? 'נהלו מתאמנים, שלחו תוכניות ויעדים ועקבו אחרי ההתקדמות שלהם — הכל ממקום אחד.'
          : 'הפרופיל הוגדר. בשלב הבא תבחרו תבנית אימון ותתחילו — זה לוקח דקה.'}
      </m.p>

      {/* Summary Cards — coach: what's next; trainee: profile recap */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full space-y-3"
      >
        {isCoach && (
          <>
            {/* First step is a real action — taps deep-link into the invite flow. */}
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

        {!isCoach && (
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
        )}

        {!isCoach && (
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
        )}
      </m.div>

      {/* First-action CTA — onboarding ends in a real next step, not a dead-end
          recap. Trainee → start their first workout; coach → invite trainees.
          The quiet secondary just enters the home screen. */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full mt-8 space-y-3"
      >
        <Button
          variant="editorial"
          onClick={() => onFinish(true)}
          fullWidth
          style={{ minHeight: '56px' }}
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
        </Button>

        <button
          type="button"
          onClick={() => onFinish(false)}
          className="w-full active:scale-[0.98] transition-transform"
          style={{
            minHeight: '44px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          כניסה למסך הבית
        </button>
      </m.div>
    </m.div>
  );
}

/**
 * "What's next" card for the coach completion screen. When `onClick` is given
 * it renders as a real button (the first step deep-links into the invite flow);
 * otherwise it's a static guidance card.
 */
function CoachNextCard({
  icon,
  kicker,
  label,
  onClick,
}: { icon: ReactNode; kicker: string; label: string; onClick?: () => void }) {
  const isInteractive = typeof onClick === 'function';
  const inner = (
    <>
      <div
        className="w-12 h-12 flex items-center justify-center shrink-0"
        style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)', borderRadius: 0 }}
      >
        {icon}
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
          {kicker}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--fs-ink)',
          }}
        >
          {label}
        </p>
      </div>
      {isInteractive && (
        <ChevronLeft
          size={20}
          aria-hidden="true"
          style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
        />
      )}
    </>
  );

  const sharedStyle = {
    background: 'var(--fs-surface)',
    border: '1px solid var(--fs-surface-2)',
    borderRadius: '22px 16px 22px 16px',
  } as const;

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full p-4 flex items-center gap-4 text-right active:scale-[0.98] transition-transform"
        style={{ ...sharedStyle, cursor: 'pointer' }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="p-4 flex items-center gap-4" style={sharedStyle}>
      {inner}
    </div>
  );
}
