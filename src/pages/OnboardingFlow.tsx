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

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Check, Dumbbell, Target,
    User, Zap, Flame, Calendar, Clock, TrendingUp, Award
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

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
}: MobileInputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block font-barlow text-sm text-[#8E8E93] mb-2 px-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    type={type}
                    inputMode={type === 'number' ? 'numeric' : 'text'}
                    value={value}
                    onChange={(e) => {
                        const val = type === 'number' 
                            ? (e.target.value ? Number(e.target.value) : '')
                            : e.target.value;
                        onChange(val);
                    }}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    className="w-full h-14 bg-[#1a1a1a] rounded-2xl px-4 text-white font-barlow text-base 
                        placeholder:text-[#48484A] focus:outline-none focus:ring-2 focus:ring-primary/50 
                        transition-all appearance-none"
                    style={{
                        paddingLeft: unit ? '3rem' : undefined,
                        paddingRight: unit ? '3rem' : undefined,
                    }}
                />
                {unit && (
                    <span 
                        className="absolute top-1/2 -translate-y-1/2 text-[#8E8E93] font-barlow text-sm pointer-events-none"
                        style={{ right: '1rem' }}
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
            className="w-full flex items-center justify-between p-4 bg-[#1a1a1a] rounded-2xl 
                active:bg-[#222222] transition-colors min-h-[72px]"
        >
            <div className="text-right flex-1 ml-4">
                <p className="font-barlow font-semibold text-base text-white">{label}</p>
                {description && (
                    <p className="font-barlow text-sm text-[#8E8E93] mt-0.5">{description}</p>
                )}
            </div>
            <div 
                className={`w-14 h-8 rounded-full transition-all relative flex-shrink-0 ${
                    checked ? 'bg-primary' : 'bg-[#3a3a3a]'
                }`}
            >
                <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${
                        checked ? 'right-1' : 'left-1'
                    }`} 
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
                    className={`h-1.5 rounded-full ${
                        i === currentStep
                            ? 'w-8 bg-primary'
                            : i < currentStep
                            ? 'w-3 bg-primary/60'
                            : 'w-3 bg-white/10'
                    }`}
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
                    className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
                >
                    {icon}
                </motion.div>
            )}
            <h2 className="font-barlow-condensed font-bold text-3xl text-white mb-2 tracking-wide">
                {title}
            </h2>
            <p className="font-barlow text-base text-[#8E8E93]">
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
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
        >
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-8">
                {/* App Icon */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-primary to-purple-600 
                        flex items-center justify-center mb-8 shadow-2xl shadow-primary/40"
                >
                    <Dumbbell size={64} className="text-white" />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="font-barlow-condensed font-black text-5xl text-white mb-4 tracking-tight"
                >
                    SparkOS
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="font-barlow text-lg text-[#8E8E93] mb-2"
                >
                    אפליקציית הכושר שלך
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="font-barlow text-sm text-[#8E8E93] max-w-xs"
                >
                    בוא נתחיל לבנות את תוכנית האימונים המושלמת עבורך
                </motion.p>

                {/* Feature Highlights */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 }}
                    className="flex gap-6 mt-12"
                >
                    {[
                        { icon: <Target size={22} />, label: 'יעדים' },
                        { icon: <TrendingUp size={22} />, label: 'מעקב' },
                        { icon: <Award size={22} />, label: 'שיאים' },
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-primary">
                                {item.icon}
                            </div>
                            <span className="text-sm font-barlow text-white/70">{item.label}</span>
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
                    className="w-full h-16 bg-primary text-white rounded-2xl font-barlow font-bold text-lg
                        flex items-center justify-center gap-3 active:scale-[0.98] transition-transform
                        shadow-lg shadow-primary/30"
                >
                    בוא נתחיל
                    <ChevronRight size={24} />
                </button>
            </motion.div>
        </motion.div>
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
                icon={<User size={28} className="text-primary" />}
            />

            <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
                {/* Name */}
                <MobileInput
                    type="text"
                    value={data.name}
                    onChange={(val) => onChange({ name: val as string })}
                    placeholder="הכנס את שמך"
                    label="שם"
                />

                {/* Gender */}
                <div>
                    <label className="block font-barlow text-sm text-[#8E8E93] mb-3 px-1">מגדר</label>
                    <div className="flex gap-3">
                        {([
                            { value: 'male', label: 'זכר', icon: '♂' },
                            { value: 'female', label: 'נקבה', icon: '♀' },
                            { value: 'other', label: 'אחר', icon: '⚥' },
                        ] as const).map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onChange({ gender: opt.value })}
                                className={`flex-1 min-h-[56px] rounded-2xl font-barlow font-semibold text-base transition-all
                                    flex flex-col items-center justify-center gap-1 ${
                                    data.gender === opt.value
                                        ? 'bg-primary/20 border-2 border-primary text-white'
                                        : 'bg-[#1a1a1a] border-2 border-transparent text-white/70 active:bg-[#222222]'
                                }`}
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
            color: 'orange',
        },
        {
            value: 'muscle' as const,
            title: 'בניית שריר',
            description: 'הגדלת מסת השריר והנפח',
            icon: <Dumbbell size={24} />,
            color: 'primary',
        },
        {
            value: 'endurance' as const,
            title: 'סיבולת',
            description: 'שיפור הסיבולת והקאנדישן הגופני',
            icon: <TrendingUp size={24} />,
            color: 'green',
        },
        {
            value: 'weight_loss' as const,
            title: 'ירידה במשקל',
            description: 'הורדת אחוזי השומן בגוף',
            icon: <Flame size={24} />,
            color: 'purple',
        },
        {
            value: 'general' as const,
            title: 'כושר כללי',
            description: 'שמירה על אורח חיים בריא',
            icon: <Target size={24} />,
            color: 'blue',
        },
    ];

    const getColorClasses = (color: string, selected: boolean) => {
        const colors: Record<string, string> = {
            primary: selected ? 'bg-primary/20 border-primary' : 'bg-[#1a1a1a] border-transparent',
            green: selected ? 'bg-green-500/20 border-green-500' : 'bg-[#1a1a1a] border-transparent',
            orange: selected ? 'bg-orange-500/20 border-orange-500' : 'bg-[#1a1a1a] border-transparent',
            blue: selected ? 'bg-blue-500/20 border-blue-500' : 'bg-[#1a1a1a] border-transparent',
            purple: selected ? 'bg-purple-500/20 border-purple-500' : 'bg-[#1a1a1a] border-transparent',
        };
        return colors[color] || colors.primary;
    };

    const getIconColor = (color: string) => {
        const colors: Record<string, string> = {
            primary: 'text-primary',
            green: 'text-green-400',
            orange: 'text-orange-400',
            blue: 'text-blue-400',
            purple: 'text-purple-400',
        };
        return colors[color] || 'text-primary';
    };

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
                icon={<Target size={28} className="text-primary" />}
            />

            <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-4">
                {goals.map((goal) => (
                    <motion.button
                        key={goal.value}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onChange({ primaryGoal: goal.value })}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-right
                            ${getColorClasses(goal.color, data.primaryGoal === goal.value)}`}
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            data.primaryGoal === goal.value 
                                ? 'bg-white/10' 
                                : 'bg-[#252525]'
                        }`}>
                            <span className={getIconColor(goal.color)}>{goal.icon}</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-barlow font-semibold text-base text-white">
                                {goal.title}
                            </p>
                            <p className="font-barlow text-sm text-[#8E8E93] mt-0.5">{goal.description}</p>
                        </div>
                        {data.primaryGoal === goal.value && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"
                            >
                                <Check size={16} className="text-white" strokeWidth={3} />
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
            color: 'green',
        },
        {
            value: 'intermediate' as const,
            title: 'בינוני',
            description: '1-3 שנות אימון סדיר',
            icon: <TrendingUp size={24} />,
            color: 'blue',
        },
        {
            value: 'advanced' as const,
            title: 'מתקדם',
            description: 'מעל 3 שנות אימון',
            icon: <Award size={24} />,
            color: 'purple',
        },
    ];

    const getColorClasses = (color: string, selected: boolean) => {
        const colors: Record<string, string> = {
            green: selected ? 'bg-green-500/20 border-green-500' : 'bg-[#1a1a1a] border-transparent',
            blue: selected ? 'bg-blue-500/20 border-blue-500' : 'bg-[#1a1a1a] border-transparent',
            purple: selected ? 'bg-purple-500/20 border-purple-500' : 'bg-[#1a1a1a] border-transparent',
        };
        return colors[color] || colors.blue;
    };

    const getIconColor = (color: string) => {
        const colors: Record<string, string> = {
            green: 'text-green-400',
            blue: 'text-blue-400',
            purple: 'text-purple-400',
        };
        return colors[color] || 'text-blue-400';
    };

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
                icon={<Dumbbell size={28} className="text-primary" />}
            />

            <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
                {levels.map((level) => (
                    <motion.button
                        key={level.value}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onChange({ experienceLevel: level.value })}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-right
                            ${getColorClasses(level.color, data.experienceLevel === level.value)}`}
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            data.experienceLevel === level.value 
                                ? 'bg-white/10' 
                                : 'bg-[#252525]'
                        }`}>
                            <span className={getIconColor(level.color)}>{level.icon}</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-barlow font-semibold text-base text-white">
                                {level.title}
                            </p>
                            <p className="font-barlow text-sm text-[#8E8E93] mt-0.5">{level.description}</p>
                        </div>
                        {data.experienceLevel === level.value && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"
                            >
                                <Check size={16} className="text-white" strokeWidth={3} />
                            </motion.div>
                        )}
                    </motion.button>
                ))}

                {/* Workout Days Selection - Mobile optimized with scrollable row */}
                <div className="mt-6">
                    <label className="block font-barlow text-base text-white mb-4 px-1">
                        ימי אימון בשבוע
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => onChange({ preferredWorkoutDays: day })}
                                className={`min-w-[52px] h-14 rounded-xl font-barlow font-bold text-lg snap-center
                                    transition-all flex-shrink-0 ${
                                    data.preferredWorkoutDays === day
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-[#1a1a1a] text-white/70 active:bg-[#222222]'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                    <p className="font-barlow text-sm text-[#8E8E93] mt-3 px-1 text-center">
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
                icon={<Dumbbell size={28} className="text-primary" />}
            />

            <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
                {/* Workout Duration Slider */}
                <div className="bg-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="font-barlow text-base text-white">משך אימון</label>
                        <span className="font-barlow font-bold text-lg text-primary">{data.workoutDuration} דק׳</span>
                    </div>
                    <input
                        type="range"
                        min={30}
                        max={120}
                        step={15}
                        value={data.workoutDuration}
                        onChange={(e) => onChange({ workoutDuration: Number(e.target.value) })}
                        className="w-full h-3 bg-[#333] rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between mt-2">
                        <span className="font-barlow text-xs text-[#8E8E93]">30 דק׳</span>
                        <span className="font-barlow text-xs text-[#8E8E93]">120 דק׳</span>
                    </div>
                </div>

                {/* Preferred Time */}
                <div>
                    <label className="block font-barlow text-base text-white mb-3 px-1">שעת אימון מועדפת</label>
                    <div className="flex gap-3">
                        {([
                            { value: 'morning', label: 'בוקר', icon: '🌅' },
                            { value: 'afternoon', label: 'צהריים', icon: '☀️' },
                            { value: 'evening', label: 'ערב', icon: '🌙' },
                        ] as const).map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onChange({ preferredTime: opt.value })}
                                className={`flex-1 min-h-[56px] rounded-2xl font-barlow font-semibold text-sm transition-all
                                    flex flex-col items-center justify-center gap-1 ${
                                    data.preferredTime === opt.value
                                        ? 'bg-primary/20 border-2 border-primary text-white'
                                        : 'bg-[#1a1a1a] border-2 border-transparent text-white/70 active:bg-[#222222]'
                                }`}
                            >
                                <span className="text-2xl">{opt.icon}</span>
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rest Between Sets */}
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <label className="font-barlow text-base text-white">מנוחה בין סטים</label>
                        <span className="font-barlow font-bold text-primary">{data.restBetweenSets} שנ׳</span>
                    </div>
                    <div className="flex gap-2">
                        {[60, 90, 120, 180].map((sec) => (
                            <button
                                key={sec}
                                type="button"
                                onClick={() => onChange({ restBetweenSets: sec })}
                                className={`flex-1 min-h-[48px] rounded-xl font-barlow font-bold text-sm transition-all ${
                                    data.restBetweenSets === sec
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-[#1a1a1a] text-white/70 active:bg-[#222222]'
                                }`}
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
                className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 
                    flex items-center justify-center mb-8 shadow-2xl shadow-green-500/40"
            >
                <Check size={56} className="text-white" strokeWidth={3} />
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="font-barlow-condensed font-black text-4xl text-white mb-3"
            >
                {data.name ? `${data.name}, ` : ''}מוכן לאימון!
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="font-barlow text-base text-[#8E8E93] mb-8"
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
                    <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Target size={22} className="text-primary" />
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-barlow text-sm text-[#8E8E93]">המטרה שלך</p>
                            <p className="font-barlow font-semibold text-base text-white">
                                {getGoalLabel(data.primaryGoal)}
                            </p>
                        </div>
                    </div>
                )}

                <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Calendar size={22} className="text-green-400" />
                    </div>
                    <div className="text-right flex-1">
                        <p className="font-barlow text-sm text-[#8E8E93]">תדירות אימונים</p>
                        <p className="font-barlow font-semibold text-base text-white">
                            {data.preferredWorkoutDays} ימים בשבוע
                        </p>
                    </div>
                </div>

                <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Clock size={22} className="text-blue-400" />
                    </div>
                    <div className="text-right flex-1">
                        <p className="font-barlow text-sm text-[#8E8E93]">משך כל אימון</p>
                        <p className="font-barlow font-semibold text-base text-white">
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
        setData(prev => ({ ...prev, ...updates }));
    }, []);

    const goNext = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete(data);
        }
    }, [currentStep, data, onComplete]);

    const goBack = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
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
            className="fixed inset-0 bg-black z-[9999] flex flex-col"
            dir="rtl"
        >
            {/* Skip Button - safe area aware */}
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
                <div className="absolute top-0 left-0 right-0 p-4 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="font-barlow text-sm text-[#8E8E93] hover:text-white transition-colors 
                            min-h-[44px] min-w-[44px] flex items-center justify-start"
                    >
                        דלג
                    </button>
                </div>
            )}

            {/* Progress */}
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
                <ProgressDots currentStep={currentStep - 1} totalSteps={STEPS.length - 2} />
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {renderStep()}
                </AnimatePresence>
            </div>

            {/* Navigation - thumb zone optimized */}
            {currentStep > 0 && (
                <div 
                    className="px-4 pb-4 pt-2"
                    style={{ paddingBottom: 'calc(1rem+env(safe-area-inset-bottom))' }}
                >
                    <div className="flex gap-3">
                        {currentStep < STEPS.length - 1 && (
                            <button
                                type="button"
                                onClick={goBack}
                                className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center 
                                    active:scale-95 transition-transform"
                            >
                                <ChevronLeft size={28} className="text-white" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canProceed()}
                            className={`flex-1 h-16 rounded-2xl font-barlow font-bold text-lg 
                                flex items-center justify-center gap-3 transition-all ${
                                canProceed()
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]'
                                    : 'bg-[#2a2a2a] text-white/30 cursor-not-allowed'
                            }`}
                        >
                            {currentStep === STEPS.length - 2 ? 'סיום' : 'המשך'}
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
