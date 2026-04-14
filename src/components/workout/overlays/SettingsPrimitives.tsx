// Settings UI Primitives - Extracted from WorkoutSettingsOverlay
// Reusable components: Toggle, ChipSelector, SliderSetting, GoalSelector,
// ThemeSelector, RestTimeSelector, Divider, SectionHeader, TabBar

import { memo } from 'react';
import { motion } from 'framer-motion';
import { WORKOUT_THEMES, getThemeVariables } from '../themes';

// ============================================================
// HAPTIC
// ============================================================

export const triggerSettingsHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
    }
};

// ============================================================
// CONSTANTS
// ============================================================

export const SETTINGS_TABS = [
    { id: 'general' as const, label: 'כללי' },
    { id: 'display' as const, label: 'תצוגה' },
    { id: 'timers' as const, label: 'טיימרים' },
    { id: 'audio' as const, label: 'שמע' },
    { id: 'advanced' as const, label: 'מתקדם' },
    { id: 'accessibility' as const, label: 'נגישות' },
    { id: 'library' as const, label: 'ספריה' },
    { id: 'records' as const, label: 'שיאים' },
    { id: 'analytics' as const, label: 'נתונים' },
] as const;

export type SettingsTab = typeof SETTINGS_TABS[number]['id'];

export const GOALS = [
    { id: 'strength', label: 'כוח', color: '#ef4444' },
    { id: 'hypertrophy', label: 'נפח', color: '#f97316' },
    { id: 'endurance', label: 'סיבולת', color: '#22c55e' },
    { id: 'flexibility', label: 'גמישות', color: '#06b6d4' },
    { id: 'general', label: 'כללי', color: '#8b5cf6' },
];

export const REST_TIME_OPTIONS = [30, 60, 90, 120, 180, 240];

// ============================================================
// PRIMITIVES
// ============================================================

/** Clean Toggle Switch */
export const Toggle = memo<{
    label: string;
    description?: string;
    value: boolean;
    onChange: (v: boolean) => void;
}>(({ label, description, value, onChange }) => (
    <button
        type="button"
        onClick={() => {
            triggerSettingsHaptic();
            onChange(!value);
        }}
        className="w-full flex items-center justify-between py-4 px-1 active:opacity-70 transition-opacity"
    >
        <div className="flex-1 text-start pe-4">
            <div className="text-[15px] text-white font-medium">{label}</div>
            {description && (
                <div className="text-[13px] text-white/50 mt-0.5 leading-snug">{description}</div>
            )}
        </div>
        <div
            className={`relative w-[52px] h-[32px] rounded-full transition-all duration-200 flex-shrink-0 ${value ? 'bg-[#34C759]' : 'bg-white/20'
                }`}
        >
            <motion.div
                className="absolute top-[2px] w-[28px] h-[28px] rounded-full bg-white shadow-md"
                animate={{ left: value ? '22px' : '2px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
        </div>
    </button>
));
Toggle.displayName = 'Toggle';

/** Chip Selector */
export const ChipSelector = memo<{
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}>(({ label, options, value, onChange }) => (
    <div className="py-3">
        <div className="text-[13px] text-white/50 mb-3 font-medium">{label}</div>
        <div className="flex gap-2 flex-wrap">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                        triggerSettingsHaptic();
                        onChange(opt.value);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all ${value === opt.value
                        ? 'bg-[var(--cosmos-accent-primary)] text-black'
                        : 'bg-white/10 text-white/70 active:bg-white/20'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
));
ChipSelector.displayName = 'ChipSelector';

/** Slider with value display */
export const SliderSetting = memo<{
    label: string;
    description?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (v: number) => void;
}>(({ label, description, value, min, max, step = 1, unit = '', onChange }) => (
    <div className="py-4">
        <div className="flex justify-between items-center mb-3">
            <div className="text-start">
                <div className="text-[15px] text-white font-medium">{label}</div>
                {description && <div className="text-[13px] text-white/50 mt-0.5">{description}</div>}
            </div>
            <div className="text-[15px] text-[var(--cosmos-accent-primary)] font-bold tabular-nums">
                {value}{unit}
            </div>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => {
                triggerSettingsHaptic();
                onChange(Number(e.target.value));
            }}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-6
                [&::-webkit-slider-thumb]:h-6
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-[var(--cosmos-accent-primary)]
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer"
        />
    </div>
));
SliderSetting.displayName = 'SliderSetting';

/** Goal Selector */
export const GoalSelector = memo<{ value: string; onChange: (v: string) => void }>(({ value, onChange }) => (
    <div className="py-3">
        <div className="text-[13px] text-white/50 mb-3 font-medium">מטרת האימון</div>
        <div className="grid grid-cols-2 gap-2">
            {GOALS.map(goal => {
                const isActive = value === goal.id;
                return (
                    <button
                        key={goal.id}
                        type="button"
                        onClick={() => {
                            triggerSettingsHaptic();
                            onChange(goal.id);
                        }}
                        className={`relative flex items-center gap-3 p-4 rounded-2xl transition-all border-2 ${isActive ? 'bg-white/15' : 'bg-white/5 active:bg-white/10 border-transparent'
                            }`}
                        style={{ borderColor: isActive ? goal.color : 'transparent' }}
                    >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }} />
                        <span className={`text-[15px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                            {goal.label}
                        </span>
                        {isActive && (
                            <svg className="absolute end-3 w-5 h-5 text-[#34C759]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
));
GoalSelector.displayName = 'GoalSelector';

/** Theme Selector */
export const ThemeSelector = memo<{ value: string; onChange: (v: string) => void }>(({ value, onChange }) => (
    <div className="py-3">
        <div className="text-[13px] text-white/50 mb-3 font-medium">ערכת נושא</div>
        <div className="grid grid-cols-2 gap-3">
            {Object.values(WORKOUT_THEMES).map(theme => {
                const isActive = value === theme.id;
                return (
                    <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                            triggerSettingsHaptic();
                            onChange(theme.id);
                            const vars = getThemeVariables(theme.id);
                            Object.entries(vars).forEach(([key, val]) => {
                                document.documentElement.style.setProperty(key, val);
                            });
                        }}
                        className={`relative p-4 rounded-2xl transition-all text-start ${isActive ? 'bg-white/15 ring-2 ring-[#34C759]' : 'bg-white/5 active:bg-white/10'
                            }`}
                    >
                        <div className="flex gap-1.5 mb-3">
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.colors.secondary }} />
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                        </div>
                        <div className={`text-[14px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                            {theme.name}
                        </div>
                        {isActive && (
                            <svg className="absolute top-3 end-3 w-5 h-5 text-[#34C759]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
));
ThemeSelector.displayName = 'ThemeSelector';

/** Rest Time Selector */
export const RestTimeSelector = memo<{ value: number; onChange: (v: number) => void }>(({ value, onChange }) => (
    <div className="py-3">
        <div className="text-[13px] text-white/50 mb-3 font-medium">זמן מנוחה ברירת מחדל</div>
        <div className="grid grid-cols-3 gap-2">
            {REST_TIME_OPTIONS.map(time => {
                const isActive = value === time;
                const mins = Math.floor(time / 60);
                const secs = time % 60;
                const label = mins === 0 ? `${secs}s` : secs === 0 ? `${mins}:00` : `${mins}:${secs.toString().padStart(2, '0')}`;
                return (
                    <button
                        key={time}
                        type="button"
                        onClick={() => {
                            triggerSettingsHaptic();
                            onChange(time);
                        }}
                        className={`py-3.5 rounded-xl text-[15px] font-semibold transition-all ${isActive
                            ? 'bg-[var(--cosmos-accent-primary)] text-black'
                            : 'bg-white/10 text-white/70 active:bg-white/20'
                            }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    </div>
));
RestTimeSelector.displayName = 'RestTimeSelector';

/** Section Divider */
export const Divider = () => <div className="h-px bg-white/10 my-2" />;

/** Section Header */
export const SectionHeader = memo<{ title: string }>(({ title }) => (
    <div className="text-[12px] text-white/40 uppercase tracking-wider font-semibold pt-4 pb-2">{title}</div>
));
SectionHeader.displayName = 'SectionHeader';

/** Tab Bar */
export const TabBar = memo<{ tabs: readonly { id: string; label: string }[]; activeTab: string; onTabChange: (t: SettingsTab) => void }>(
    ({ tabs, activeTab, onTabChange }) => (
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                        triggerSettingsHaptic();
                        onTabChange(tab.id as SettingsTab);
                    }}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white/15 text-white' : 'text-white/50 active:text-white/70'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    )
);
TabBar.displayName = 'TabBar';
