// Extracted from WorkoutSummary.tsx
import React, { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { TrophyIcon, FlameIcon, CheckCircleIcon, ClockIcon } from '../../icons';

export interface ComparisonData {
    prevVolume: number;
    prevDuration: number;
    prevSets: number;
    volumeChange: number;
    durationChange: number;
    setsChange: number;
}

// ============================================================
// ANIMATED COUNTER
// ============================================================

interface AnimatedCounterProps {
    value: number;
    suffix?: string;
    duration?: number;
    className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = memo(({
    value,
    suffix = '',
    duration = 1200,
    className = ''
}) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const steps = 40;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = value * eased;

            if (step >= steps) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value, duration]);

    return (
        <motion.span
            className={className}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
            {displayValue.toLocaleString()}{suffix}
        </motion.span>
    );
});

AnimatedCounter.displayName = 'AnimatedCounter';

// ============================================================
// ACTIVITY RING
// ============================================================

interface ActivityRingProps {
    progress: number;
    color: string;
    size?: number;
    strokeWidth?: number;
    delay?: number;
}

export const ActivityRing: React.FC<ActivityRingProps> = memo(({
    progress,
    color,
    size = 80,
    strokeWidth = 8,
    delay = 0
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(progress, 100) / 100);

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`${color}20`}
                strokeWidth={strokeWidth}
            />
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{
                    duration: 1.5,
                    delay,
                    ease: [0.34, 1.56, 0.64, 1]
                }}
            />
        </svg>
    );
};

// ============================================================
// COMPARISON BADGE
// ============================================================

interface ComparisonBadgeProps {
    label: string;
    current: number;
    previous: number;
    unit?: string;
    isPositive?: boolean;
    delay?: number;
}

export const ComparisonBadge: React.FC<ComparisonBadgeProps> = memo(({
    label,
    current,
    previous,
    unit = '',
    isPositive = true,
    delay = 0
}) => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isImprovement = isPositive ? change > 0 : change < 0;
    const isSame = Math.abs(change) < 1;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: 'spring', stiffness: 300 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
        >
            <div className="flex-1">
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">{label}</div>
                <div className="text-sm font-bold text-white">
                    {current.toLocaleString()}{unit}
                    <span className="text-white/30 text-xs mr-1">
                        ({previous.toLocaleString()}{unit})
                    </span>
                </div>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                isSame ? 'bg-white/10 text-white/50' :
                isImprovement ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
            }`}>
                {isSame ? '≈' : isImprovement ? (
                    <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 15l-6-6-6 6" />
                        </svg>
                        {Math.abs(change).toFixed(0)}%
                    </>
                ) : (
                    <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                        {Math.abs(change).toFixed(0)}%
                    </>
                )}
            </div>
        </motion.div>
    );
};

// ============================================================
// STAT CARD
// ============================================================

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    suffix?: string;
    color: string;
    delay?: number;
    ringProgress?: number;
}

export const StatCard: React.FC<StatCardProps> = memo(({
    icon,
    label,
    value,
    suffix,
    color,
    delay = 0,
    ringProgress
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
            delay,
            type: 'spring',
            stiffness: 300,
            damping: 25
        }}
        className="relative premium-card p-5 flex flex-col items-center gap-3 overflow-hidden"
    >
        <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
                background: `radial-gradient(circle at 50% 0%, ${color}40 0%, transparent 70%)`,
            }}
        />

        <div className="relative">
            {ringProgress !== undefined && (
                <ActivityRing
                    progress={ringProgress}
                    color={color}
                    size={70}
                    strokeWidth={6}
                    delay={delay + 0.2}
                />
            )}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ color }}
            >
                {icon}
            </div>
        </div>

        <div className="text-center">
            <div className="text-2xl font-[800] text-white tracking-tight">
                <AnimatedCounter value={value} suffix={suffix} duration={1500} />
            </div>
            <span className="text-[10px] text-white/40 uppercase tracking-[0.15em] font-bold">
                {label}
            </span>
        </div>
    </motion.div>
);

StatCard.displayName = 'StatCard';

// ============================================================
// STATS GRID (Combined Component)
// ============================================================

export interface StatsGridProps {
    totalVolume: number;
    duration: number;
    totalSets: number;
    prsCount: number | null;
    comparison?: ComparisonData | null;
}

export const StatsGrid: React.FC<StatsGridProps> = memo(({
    totalVolume,
    duration,
    totalSets,
    prsCount,
    comparison
}) => {
    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    icon={<FlameIcon className="w-6 h-6" />}
                    label="נפח כולל"
                    value={totalVolume}
                    suffix=" ק״ג"
                    color="var(--cosmos-accent-tertiary)"
                    delay={0.1}
                    ringProgress={Math.min(totalVolume / 5000 * 100, 100)}
                />
                <StatCard
                    icon={<ClockIcon className="w-6 h-6" />}
                    label="משך"
                    value={duration}
                    suffix=" דק'"
                    color="var(--cosmos-success)"
                    delay={0.2}
                    ringProgress={Math.min(duration / 90 * 100, 100)}
                />
                <StatCard
                    icon={<CheckCircleIcon className="w-6 h-6" />}
                    label="סטים"
                    value={totalSets}
                    color="var(--cosmos-info)"
                    delay={0.3}
                    ringProgress={Math.min(totalSets / 30 * 100, 100)}
                />
                <StatCard
                    icon={<TrophyIcon className="w-6 h-6" />}
                    label="שיאים"
                    value={prsCount ?? 0}
                    color="var(--cosmos-warning)"
                    delay={0.4}
                    ringProgress={prsCount ? 100 : 0}
                />
            </div>

            {comparison && (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="space-y-2"
                >
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.15em] mb-3 px-1 flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3v18h18" />
                            <path d="M18 17V9" />
                            <path d="M13 17V5" />
                            <path d="M8 17v-3" />
                        </svg>
                        בהשוואה לאימון הקודם
                    </h3>
                    <ComparisonBadge
                        label="נפח"
                        current={totalVolume}
                        previous={comparison.prevVolume}
                        unit=" ק״ג"
                        isPositive={true}
                        delay={0.4}
                    />
                    <ComparisonBadge
                        label="משך"
                        current={duration}
                        previous={comparison.prevDuration}
                        unit=" דק'"
                        isPositive={true}
                        delay={0.45}
                    />
                    <ComparisonBadge
                        label="סטים"
                        current={totalSets}
                        previous={comparison.prevSets}
                        isPositive={true}
                        delay={0.5}
                    />
                </motion.div>
            )}
        </>
    );
};