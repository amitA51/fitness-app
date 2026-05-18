/**
 * Onboarding Flow - Mobile-optimized multi-step wizard for new users
 * Collects user profile, fitness goals, and preferences
 *
 * Mobile-First Design Principles Applied:
 * - Minimum touch targets: 48px (iOS) / 48dp (Android)
 * - Thumb zone: Primary CTAs at bottom
 * - Safe area handling for notched devices
 * - No horizontal scrolling
 * - Optimized typography for readability
 * - Smooth animations with reduced-motion support
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type EquipmentAccess = 'gym' | 'home_full' | 'home_minimal' | 'bodyweight' | '';
export type UnitSystem = 'metric' | 'imperial';

export interface OnboardingData {
  name: string;
  gender: 'male' | 'female' | 'other' | '';
  age: number | '';
  height: number | '';
  weight: number | '';
  primaryGoal: 'strength' | 'muscle' | 'endurance' | 'weight_loss' | 'general' | '';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | '';
  preferredWorkoutDays: number;
  workoutDuration: number;
  preferredTime: 'morning' | 'afternoon' | 'evening' | '';
  restBetweenSets: number;
  preferCompound: boolean;
  includeCardio: boolean;
  trackNutrition: boolean;
  dailyCalorieGoal: number | '';
  // Added 2026-05-18: equipment access + unit system. Optional for back-compat
  // with any persisted onboarding_data; readers should default to metric/gym.
  equipment?: EquipmentAccess;
  unitSystem?: UnitSystem;
}

const DEFAULT_ONBOARDING: OnboardingData = {
  name: '',
  gender: '',
  age: '',
  height: '',
  weight: '',
  primaryGoal: '',
  experienceLevel: '',
  preferredWorkoutDays: 3,
  workoutDuration: 60,
  preferredTime: '',
  restBetweenSets: 90,
  preferCompound: true,
  includeCardio: false,
  trackNutrition: false,
  dailyCalorieGoal: '',
  equipment: '',
  unitSystem: 'metric',
};

export interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = [
  { id: 'welcome', title: 'ברוך הבא', subtitle: 'הכר את עצמך' },
  { id: 'profile', title: 'פרופיל אישי', subtitle: 'ספר לנו על עצמך' },
  { id: 'goals', title: 'מטרות כושר', subtitle: 'מה המטרות שלך?' },
  { id: 'experience', title: 'ניסיון', subtitle: 'רמת האימון שלך' },
  { id: 'preferences', title: 'העדפות', subtitle: 'התאם אישית' },
  { id: 'complete', title: 'מוכן!', subtitle: 'בוא נתחיל' },
];

// ============================================================================
// MOBILE-OPTIMIZED INPUT COMPONENTS
// ============================================================================

interface MobileInputProps {
  type: 'text' | 'number';
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  inputMode?: 'numeric' | 'decimal' | 'text';
  step?: number | string;
}

const MobileInput = memo(function MobileInput({
  type,
  value,
  onChange,
  placeholder,
  label,
  unit,
  min,
  max,
  inputMode,
  step,
}: MobileInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          className="block mb-2 px-1"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--fs-muted)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          inputMode={inputMode ?? (type === 'number' ? 'numeric' : 'text')}
          pattern={
            type === 'number' && (inputMode ?? 'numeric') === 'numeric' ? '[0-9]*' : undefined
          }
          step={step}
          value={value}
          onChange={(e) => {
            const val =
              type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value;
            onChange(val);
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full h-14 px-4 text-base placeholder:opacity-60 focus:outline-none transition-all appearance-none"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            fontFamily: 'var(--font-body)',
            color: 'var(--fs-ink)',
            paddingLeft: unit ? '3rem' : undefined,
            paddingRight: unit ? '3rem' : undefined,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--fs-accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67, 199, 165, 0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--fs-surface-2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {unit && (
          <span
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--fs-muted)',
              left: '1rem',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});

interface MobileToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

const MobileToggle = memo(function MobileToggle({
  checked,
  onChange,
  label,
  description,
}: MobileToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-4 transition-colors min-h-[72px]"
      style={{
        background: checked ? 'var(--fs-accent)' : 'var(--fs-surface)',
        border: checked ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
      }}
    >
      <div className="text-right flex-1 ml-4">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '16px',
            color: checked ? 'var(--fs-primary)' : 'var(--fs-ink)',
          }}
        >
          {label}
        </p>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: checked ? 'var(--fs-primary)' : 'var(--fs-muted)',
              marginTop: '2px',
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div
        className="w-14 h-8 relative flex-shrink-0"
        style={{
          background: checked ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          border: '2px solid var(--fs-primary)',
          borderRadius: '22px',
        }}
      >
        <div
          className="absolute top-1 w-6 h-6 shadow-lg transition-all"
          style={{
            left: checked ? 'auto' : '4px',
            right: checked ? '4px' : 'auto',
            borderRadius: '50%',
            background: 'var(--fs-surface)',
          }}
        />
      </div>
    </button>
  );
});

// ============================================================================
// PROGRESS DOTS
// ============================================================================

interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
}

function ProgressDots({ currentStep, totalSteps }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <motion.div
          key={i}
          layoutId={`progress-dot-${i}`}
          className="h-1.5 rounded-full"
          style={{
            width: i === currentStep ? '24px' : '8px',
            backgroundColor: i <= currentStep ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// STEP HEADER
// ============================================================================

interface StepHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}

function StepHeader({ title, subtitle, icon }: StepHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="text-center mb-6 px-2"
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          {icon}
        </motion.div>
      )}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '26px',
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          marginBottom: '8px',
        }}
      >
        {title}
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--fs-muted)' }}>
        {subtitle}
      </p>
    </motion.div>
  );
}

// ============================================================================
// STEP 0: WELCOME
// ============================================================================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full" style={{ color: 'var(--fs-ink)' }} dir="rtl">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-8">
        {/* App Icon - FS Brand Mark */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-28 h-28 flex items-center justify-center mb-6"
          style={{
            background: 'var(--fs-primary)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <span
            style={{
              fontFamily: '"Bricolage Grotesque", var(--font-display)',
              fontWeight: 800,
              fontSize: '56px',
              color: 'var(--fs-accent)',
              lineHeight: 1,
            }}
          >
            FS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '32px',
            color: 'var(--fs-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          SparkOS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--fs-muted)',
            marginTop: '8px',
          }}
        >
          אפליקציית הכושר שלך
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            maxWidth: '280px',
            marginTop: '4px',
          }}
        >
          בוא נתחיל לבנות את תוכנית האימונים המושלמת עבורך
        </motion.p>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex gap-8 mt-12"
        >
          {[
            { icon: <Target size={22} />, label: 'יעדים' },
            { icon: <TrendingUp size={22} />, label: 'מעקב' },
            { icon: <Award size={22} />, label: 'שיאים' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{
                  background: 'var(--fs-surface)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                  color: 'var(--fs-accent)',
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--fs-muted)',
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="px-6 pb-8 pt-4"
      >
        <button
          type="button"
          onClick={onNext}
          className="w-full flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          style={{
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            borderRadius: '22px 16px 22px 16px',
            minHeight: '56px',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          בוא נתחיל
          <ChevronRight size={24} />
        </button>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 1: PROFILE
// ============================================================================

interface ProfileStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

function ProfileStep({ data, onChange }: ProfileStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="קצת עליך"
        subtitle="נזדקק למידע הבסיסי כדי להתאים את המערכת אליך"
        icon={<User size={24} />}
      />

      <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
        <MobileInput
          type="text"
          value={data.name}
          onChange={(val) => onChange({ name: val as string })}
          placeholder="הכנס את שמך"
          label="שם"
        />

        {/* Gender */}
        <div>
          <label
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            מגדר
          </label>
          <div className="flex gap-3">
            {(
              [
                { value: 'male', label: 'זכר', icon: '' },
                { value: 'female', label: 'נקבה', icon: '' },
                { value: 'other', label: 'אחר', icon: '' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ gender: opt.value })}
                className="flex-1 min-h-[56px] transition-all flex flex-col items-center justify-center gap-1"
                style={{
                  background: data.gender === opt.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border:
                    data.gender === opt.value
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                  color: data.gender === opt.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.gender === opt.value ? 700 : 500,
                  fontSize: '16px',
                }}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Age & Height */}
        <div className="grid grid-cols-2 gap-4">
          <MobileInput
            type="number"
            value={data.age}
            onChange={(val) => onChange({ age: val as number })}
            placeholder="—"
            label="גיל"
            unit="שנה"
            min={10}
            max={100}
          />
          <MobileInput
            type="number"
            value={data.height}
            onChange={(val) => onChange({ height: val as number })}
            placeholder="—"
            label="גובה"
            unit="ס״מ"
            min={100}
            max={250}
          />
        </div>

        {/* Weight */}
        <MobileInput
          type="number"
          value={data.weight}
          onChange={(val) => onChange({ weight: val as number })}
          placeholder="—"
          label="משקל נוכחי"
          unit="ק״ג"
          min={30}
          max={300}
          inputMode="decimal"
          step="0.1"
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// STEP 2: GOALS
// ============================================================================

interface GoalsStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

function GoalsStep({ data, onChange }: GoalsStepProps) {
  const goals = [
    {
      value: 'strength' as const,
      title: 'בניית כוח',
      description: 'הגדלת הכוח והיכולות הפיזיות',
      icon: <Zap size={24} />,
    },
    {
      value: 'muscle' as const,
      title: 'בניית שריר',
      description: 'הגדלת מסת השריר והנפח',
      icon: <Dumbbell size={24} />,
    },
    {
      value: 'endurance' as const,
      title: 'סיבולת',
      description: 'שיפור הסיבולת והקאנדישן הגופני',
      icon: <TrendingUp size={24} />,
    },
    {
      value: 'weight_loss' as const,
      title: 'ירידה במשקל',
      description: 'הורדת אחוזי השומן בגוף',
      icon: <Flame size={24} />,
    },
    {
      value: 'general' as const,
      title: 'כושר כללי',
      description: 'שמירה על אורח חיים בריא',
      icon: <Target size={24} />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="מה המטרה שלך?"
        subtitle="בחר את המטרה העיקרית שלך"
        icon={<Target size={24} />}
      />

      <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-4">
        {goals.map((goal) => (
          <motion.button
            key={goal.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange({ primaryGoal: goal.value })}
            className="w-full p-4 transition-all flex items-center gap-4 text-right"
            style={{
              background:
                data.primaryGoal === goal.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
              border:
                data.primaryGoal === goal.value
                  ? '2px solid var(--fs-accent)'
                  : '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background:
                  data.primaryGoal === goal.value ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                borderRadius: 0,
              }}
            >
              <span
                style={{
                  color: data.primaryGoal === goal.value ? 'var(--fs-accent)' : 'var(--fs-muted)',
                }}
              >
                {goal.icon}
              </span>
            </div>
            <div className="flex-1">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: 'var(--fs-ink)',
                }}
              >
                {goal.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: data.primaryGoal === goal.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  marginTop: '2px',
                }}
              >
                {goal.description}
              </p>
            </div>
            {data.primaryGoal === goal.value && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{
                  background: 'var(--fs-primary)',
                  color: 'var(--fs-accent)',
                  borderRadius: 0,
                }}
              >
                <Check size={16} strokeWidth={3} />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// STEP 3: EXPERIENCE
// ============================================================================

interface ExperienceStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

function ExperienceStep({ data, onChange }: ExperienceStepProps) {
  const levels = [
    {
      value: 'beginner' as const,
      title: 'מתחיל',
      description: 'פחות משנה של אימונים סדירים',
      icon: <User size={24} />,
    },
    {
      value: 'intermediate' as const,
      title: 'בינוני',
      description: '1-3 שנות אימון סדיר',
      icon: <TrendingUp size={24} />,
    },
    {
      value: 'advanced' as const,
      title: 'מתקדם',
      description: 'מעל 3 שנות אימון',
      icon: <Award size={24} />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="רמת הניסיון"
        subtitle="זה יעזור לנו להתאים את התוכנית"
        icon={<Dumbbell size={24} />}
      />

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
        {levels.map((level) => (
          <motion.button
            key={level.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange({ experienceLevel: level.value })}
            className="w-full p-4 transition-all flex items-center gap-4 text-right"
            style={{
              background:
                data.experienceLevel === level.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
              border:
                data.experienceLevel === level.value
                  ? '2px solid var(--fs-accent)'
                  : '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background:
                  data.experienceLevel === level.value
                    ? 'var(--fs-primary)'
                    : 'var(--fs-surface-2)',
                borderRadius: 0,
              }}
            >
              <span
                style={{
                  color:
                    data.experienceLevel === level.value ? 'var(--fs-accent)' : 'var(--fs-muted)',
                }}
              >
                {level.icon}
              </span>
            </div>
            <div className="flex-1">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: 'var(--fs-ink)',
                }}
              >
                {level.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color:
                    data.experienceLevel === level.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  marginTop: '2px',
                }}
              >
                {level.description}
              </p>
            </div>
            {data.experienceLevel === level.value && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{
                  background: 'var(--fs-primary)',
                  color: 'var(--fs-accent)',
                  borderRadius: 0,
                }}
              >
                <Check size={16} strokeWidth={3} />
              </motion.div>
            )}
          </motion.button>
        ))}

        {/* Workout Days Selection */}
        <div className="mt-6">
          <label
            className="block mb-4 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            ימי אימון בשבוע
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onChange({ preferredWorkoutDays: day })}
                className="min-w-[52px] h-14 snap-center transition-all flex-shrink-0"
                style={{
                  fontFamily: '"Bricolage Grotesque", var(--font-display)',
                  fontWeight: 800,
                  fontSize: '20px',
                  background:
                    data.preferredWorkoutDays === day ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  color:
                    data.preferredWorkoutDays === day ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  border:
                    data.preferredWorkoutDays === day
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <p
            className="mt-3 px-1 text-center"
            style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--fs-muted)' }}
          >
            {data.preferredWorkoutDays === 1
              ? 'יום אימון אחד בשבוע'
              : data.preferredWorkoutDays === 7
                ? 'כל יום! (ללא מנוחה)'
                : `${data.preferredWorkoutDays} ימי אימון בשבוע`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STEP 4: PREFERENCES
// ============================================================================

interface PreferencesStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

function PreferencesStep({ data, onChange }: PreferencesStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="העדפות אימון"
        subtitle="התאם אישית את חווית האימון"
        icon={<Dumbbell size={24} />}
      />

      <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
        {/* Workout Duration Slider */}
        <div
          className="p-4"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <label
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              משך אימון
            </label>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 800,
                fontSize: '24px',
                color: 'var(--fs-accent)',
              }}
            >
              {data.workoutDuration} דק׳
            </span>
          </div>
          <input
            type="range"
            min={30}
            max={120}
            step={15}
            value={data.workoutDuration}
            onChange={(e) => onChange({ workoutDuration: Number(e.target.value) })}
            className="w-full h-2 appearance-none cursor-pointer rounded-full"
            style={{ accentColor: 'var(--fs-accent)', background: 'var(--fs-surface-2)' }}
          />
          <div className="flex justify-between mt-2">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
              }}
            >
              30 דק׳
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
              }}
            >
              120 דק׳
            </span>
          </div>
        </div>

        {/* Preferred Time */}
        <div>
          <label
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            שעת אימון מועדפת
          </label>
          <div className="flex gap-3">
            {(
              [
                { value: 'morning', label: 'בוקר', icon: '' },
                { value: 'afternoon', label: 'צהריים', icon: '' },
                { value: 'evening', label: 'ערב', icon: '' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ preferredTime: opt.value })}
                className="flex-1 min-h-[56px] transition-all flex flex-col items-center justify-center gap-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.preferredTime === opt.value ? 700 : 500,
                  fontSize: '14px',
                  background:
                    data.preferredTime === opt.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border:
                    data.preferredTime === opt.value
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                  color: data.preferredTime === opt.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                }}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rest Between Sets - FS Stepper Style */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <label
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              מנוחה בין סטים
            </label>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 800,
                fontSize: '24px',
                color: 'var(--fs-accent)',
              }}
            >
              {data.restBetweenSets} שנ׳
            </span>
          </div>
          <div className="flex gap-2">
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChange({ restBetweenSets: sec })}
                className="flex-1 min-h-[48px] transition-all"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.restBetweenSets === sec ? 700 : 500,
                  fontSize: '14px',
                  background:
                    data.restBetweenSets === sec ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  color: data.restBetweenSets === sec ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  border:
                    data.restBetweenSets === sec
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                }}
              >
                {sec}ש
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <MobileToggle
            checked={data.preferCompound}
            onChange={(val) => onChange({ preferCompound: val })}
            label="תרגילים מורכבים"
            description="סקוואט, דדליפט, לחיצת חזה"
          />
          <MobileToggle
            checked={data.includeCardio}
            onChange={(val) => onChange({ includeCardio: val })}
            label="כולל אירובי"
            description="ריצה, אופניים, קרוספיט"
          />
          <MobileToggle
            checked={data.trackNutrition}
            onChange={(val) => onChange({ trackNutrition: val })}
            label="מעקב תזונה"
            description="קלוריות ומאקרואים"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STEP 5: COMPLETE
// ============================================================================

interface CompleteStepProps {
  data: OnboardingData;
}

function CompleteStep({ data }: CompleteStepProps) {
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full items-center justify-center text-center px-6 py-8"
    >
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="w-28 h-28 flex items-center justify-center mb-8"
        style={{
          background: 'var(--fs-accent)',
          borderRadius: '22px 16px 22px 16px',
          color: 'var(--fs-primary)',
        }}
      >
        <Check size={56} strokeWidth={3} />
      </motion.div>

      <motion.h1
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
      </motion.h1>

      <motion.p
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
        הפרופיל שלך הוגדר. בוא נתחיל!
      </motion.p>

      {/* Summary Cards */}
      <motion.div
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
              }}
            >
              {data.workoutDuration} דקות
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN ONBOARDING COMPONENT
// ============================================================================

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_ONBOARDING);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete(data);
    }
  }, [currentStep, data, onComplete]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return data.name.trim().length > 0 && data.gender !== '' && data.age !== '';
      case 2:
        return data.primaryGoal !== '';
      case 3:
        return data.experienceLevel !== '';
      case 4:
        return data.preferredTime !== '';
      default:
        return true;
    }
  }, [currentStep, data]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep onNext={goNext} />;
      case 1:
        return <ProfileStep data={data} onChange={updateData} />;
      case 2:
        return <GoalsStep data={data} onChange={updateData} />;
      case 3:
        return <ExperienceStep data={data} onChange={updateData} />;
      case 4:
        return <PreferencesStep data={data} onChange={updateData} />;
      case 5:
        return <CompleteStep data={data} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'var(--fs-bg)',
        backgroundImage:
          'linear-gradient(rgba(19,35,39,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(19,35,39,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      dir="rtl"
    >
      {/* Progress bar at top */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <div className="w-full h-1" style={{ background: 'var(--fs-surface-2)' }}>
          <motion.div
            className="h-full"
            style={{ background: 'var(--fs-accent)' }}
            initial={{ width: 0 }}
            animate={{
              width: `${((currentStep - 1) / (STEPS.length - 2)) * 100}%`,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </div>
      )}

      {/* Skip Button - safe area aware */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <div className="absolute top-0 left-0 right-0 p-4 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onSkip}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            דלג
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden pt-8">
        <AnimatePresence mode="sync">{renderStep()}</AnimatePresence>
      </div>

      {/* Compact dots at bottom */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <ProgressDots currentStep={currentStep - 1} totalSteps={STEPS.length - 2} />
      )}

      {/* Navigation - thumb zone optimized */}
      {currentStep > 0 && (
        <div
          className="px-4 pb-4 pt-2"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            {currentStep < STEPS.length - 1 && (
              <button
                type="button"
                onClick={goBack}
                className="w-16 h-16 flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background: 'var(--fs-surface)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                }}
              >
                <ChevronLeft size={28} style={{ color: 'var(--fs-ink)' }} />
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: canProceed() ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                color: canProceed() ? 'var(--fs-accent)' : 'var(--fs-muted)',
                borderRadius: '22px 16px 22px 16px',
                minHeight: '56px',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                textTransform: 'uppercase',
                border: 'none',
              }}
            >
              {currentStep === STEPS.length - 2 ? 'סיום' : 'הבא'}
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export types
// OnboardingData already exported as interface above
