// WorkoutSummary - Ultra Premium Post-Workout Summary with Cinematic Stats
// Features: Animated counters, activity rings, confetti celebration, share capabilities, workout comparison
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutSession } from '../../types';
import { TrophyIcon, FlameIcon, CheckCircleIcon, ClockIcon } from '../icons';
import { getWorkoutSessions } from '../../services/dataService';
import { calculatePRsFromHistory, isNewPR, exportWorkoutHistoryCSV } from '../../services/prService';
import { useCelebration } from '../../hooks/useCelebration';
import { ModalOverlay } from '../ui/ModalOverlay';

// ============================================================
// TYPES
// ============================================================

interface WorkoutSummaryProps {
    isOpen: boolean;
    session: Partial<WorkoutSession>;
    onClose: () => void;
    onSaveAsTemplate?: () => void;
}

interface ComparisonData {
    prevVolume: number;
    prevDuration: number;
    prevSets: number;
    volumeChange: number;
    durationChange: number;
    setsChange: number;
}

// ============================================================
// COMPARISON BADGE COMPONENT
// ============================================================

interface ComparisonBadgeProps {
    label: string;
    current: number;
    previous: number;
    unit?: string;
    isPositive?: boolean;
    delay?: number;
}

const ComparisonBadge: React.FC<ComparisonBadgeProps> = ({
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
// ANIMATED COUNTER
// ============================================================

interface AnimatedCounterProps {
    value: number;
    suffix?: string;
    duration?: number;
    className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
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
            // Easing function for smooth deceleration
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
};

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

const ActivityRing: React.FC<ActivityRingProps> = ({
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
            {/* Background Track */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`${color}20`}
                strokeWidth={strokeWidth}
            />
            {/* Progress Arc */}
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
                    ease: [0.34, 1.56, 0.64, 1] // Bounce easing
                }}
            />
        </svg>
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

const StatCard: React.FC<StatCardProps> = ({
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
        {/* Gradient overlay */}
        <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
                background: `radial-gradient(circle at 50% 0%, ${color}40 0%, transparent 70%)`,
            }}
        />

        {/* Ring + Icon */}
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

        {/* Value */}
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

// ============================================================
// EXERCISE SUMMARY ITEM
// ============================================================

interface ExerciseSummaryItemProps {
    name: string;
    setsCompleted: number;
    totalVolume: number;
    bestSet?: { weight: number; reps: number };
    isPR?: boolean;
    delay?: number;
}

const ExerciseSummaryItem: React.FC<ExerciseSummaryItemProps> = ({
    name,
    setsCompleted,
    totalVolume,
    bestSet,
    isPR,
    delay = 0
}) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, type: 'spring', stiffness: 200 }}
        className="relative premium-card p-4"
    >
        {/* PR Badge */}
        {isPR && (
            <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400 }}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
            >
                <TrophyIcon className="w-4 h-4 text-white" />
            </motion.div>
        )}

        <div className="flex justify-between items-start mb-3">
            <h4 className="text-base font-bold text-white leading-tight">{name}</h4>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg font-mono">
                {setsCompleted} sets
            </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
                <FlameIcon className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white/70 font-medium">{totalVolume.toLocaleString()} kg</span>
            </div>
            {bestSet && (
                <div className="flex items-center gap-1.5">
                    <span className="text-white/30">Best:</span>
                    <span className="text-[var(--cosmos-accent-primary)] font-bold">
                        {bestSet.weight}kg × {bestSet.reps}
                    </span>
                </div>
            )}
        </div>
    </motion.div>
);

// ============================================================
// CONFETTI CELEBRATION
// ============================================================

const Confetti: React.FC = () => {
    const particles = useMemo(() =>
        Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            rotation: Math.random() * 360,
            delay: Math.random() * 0.5,
            duration: 1 + Math.random() * 2,
            size: 4 + Math.random() * 8,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        })), []
    );

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute"
                    style={{
                        left: `${p.x}%`,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: p.borderRadius,
                    }}
                    initial={{
                        top: '-10%',
                        rotate: 0,
                        opacity: 1
                    }}
                    animate={{
                        top: '110%',
                        rotate: p.rotation * 3,
                        opacity: [1, 1, 0]
                    }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: 'linear',
                    }}
                />
            ))}
        </div>
    );
};

const CONFETTI_COLORS = ['#a3e635', '#22d3ee', '#f43f5e', '#fbbf24', '#a855f7'];

// ============================================================
// MAIN COMPONENT
// ============================================================

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({ isOpen, session, onClose, onSaveAsTemplate }) => {
    const { triggerConfetti } = useCelebration();
    const [showConfetti, setShowConfetti] = useState(true);
    const [view, setView] = useState<'overview' | 'details'>('overview');
    const [prsCount, setPrsCount] = useState<number | null>(null);
    const [prExercises, setPrExercises] = useState<Set<string>>(new Set());
    const [comparison, setComparison] = useState<ComparisonData | null>(null);

    // Celebrate on mount - trigger confetti for post-workout celebration
    useEffect(() => {
        triggerConfetti();
        const timer = setTimeout(() => setShowConfetti(false), 4000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load comparison data
    useEffect(() => {
        const loadComparison = async () => {
            try {
                const allSessions = await getWorkoutSessions();
                if (allSessions.length < 2) return;

                // Get the last workout (excluding current)
                const currentStartMs = session.startTime ? new Date(session.startTime).getTime() : null;
                const previousSessions = allSessions
                    .filter(s => !currentStartMs || new Date(s.startTime || 0).getTime() < currentStartMs)
                    .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());

                if (previousSessions.length === 0) return;

                const prevSession = previousSessions[0];

                // Calculate previous stats
                const prevExercises = prevSession.exercises || [];
                const prevWorkingSets = prevExercises.flatMap(ex => 
                    (ex.sets || []).filter(s => !s.isWarmup)
                );

                const prevVolume = prevWorkingSets.reduce((sum, s) =>
                    s.completedAt ? sum + (s.weight || 0) * (s.reps || 0) : sum
                , 0);

                const prevDuration = prevSession.startTime && prevSession.endTime
                    ? Math.round((new Date(prevSession.endTime).getTime() - new Date(prevSession.startTime).getTime()) / 1000 / 60)
                    : 0;

                const prevSets = prevWorkingSets.filter(s => s.completedAt).length;

                // Calculate current stats
                const currentExercises = session.exercises || [];
                const currentWorkingSets = currentExercises.flatMap(ex =>
                    (ex.sets || []).filter(s => !s.isWarmup)
                );

                const currentVolume = currentWorkingSets.reduce((sum, s) =>
                    s.completedAt ? sum + (s.weight || 0) * (s.reps || 0) : sum
                , 0);

                const currentDuration = session.startTime && session.endTime
                    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000 / 60)
                    : 0;

                const currentSets = currentWorkingSets.filter(s => s.completedAt).length;

                setComparison({
                    prevVolume,
                    prevDuration,
                    prevSets,
                    volumeChange: currentVolume - prevVolume,
                    durationChange: currentDuration - prevDuration,
                    setsChange: currentSets - prevSets,
                });
            } catch {
                // Silently handle comparison loading errors
            }
        };

        if (isOpen) {
            loadComparison();
        }
    }, [isOpen, session]);

    // Calculate stats
    const stats = useMemo(() => {
        const exercises = session.exercises || [];

        // Filter out warmup sets from all calculations
        const workingSets = (ex: typeof exercises[0]) => ex.sets.filter(s => !s.isWarmup);

        const totalVolume = exercises.reduce((sum, ex) =>
            sum + workingSets(ex).reduce((setSum, set) =>
                set.completedAt && set.weight && set.reps
                    ? setSum + set.weight * set.reps
                    : setSum
                , 0)
            , 0);

        const totalSets = exercises.reduce((sum, ex) =>
            sum + workingSets(ex).filter(s => s.completedAt).length
            , 0);

        const totalReps = exercises.reduce((sum, ex) =>
            sum + workingSets(ex).reduce((setSum, set) =>
                set.completedAt && set.reps ? setSum + set.reps : setSum
                , 0)
            , 0);

        const duration = session.startTime && session.endTime
            ? Math.round(
                (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000 / 60
            )
            : 0;

        const exerciseCount = exercises.filter(ex =>
            workingSets(ex).some(s => s.completedAt)
        ).length;

        // RPE comparison: actual vs target
        let rpeActualTotal = 0;
        let rpeActualCount = 0;
        let rpeTargetTotal = 0;
        let rpeTargetCount = 0;

        exercises.forEach(ex => {
            workingSets(ex).forEach(s => {
                if (s.completedAt && s.rpe) {
                    rpeActualTotal += s.rpe;
                    rpeActualCount++;
                }
            });
            if (ex.programExtras?.rpeTarget) {
                const parsed = parseFloat(String(ex.programExtras.rpeTarget));
                if (!isNaN(parsed)) {
                    rpeTargetTotal += parsed;
                    rpeTargetCount++;
                }
            }
        });

        const avgRpeActual = rpeActualCount > 0 ? +(rpeActualTotal / rpeActualCount).toFixed(1) : null;
        const avgRpeTarget = rpeTargetCount > 0 ? +(rpeTargetTotal / rpeTargetCount).toFixed(1) : null;

        // Calculate exercise-specific stats
        const exerciseStats = exercises.map(ex => {
            const completedSets = workingSets(ex).filter(s => s.completedAt);
            const volume = completedSets.reduce((sum, s) =>
                s.weight && s.reps ? sum + s.weight * s.reps : sum
                , 0);
            const bestSet = completedSets.reduce<{ weight: number; reps: number } | undefined>((best, s) => {
                if (!s.weight || !s.reps) return best;
                const current = s.weight * s.reps;
                const bestVolume = best ? best.weight * best.reps : 0;
                return current > bestVolume ? { weight: s.weight, reps: s.reps } : best;
            }, undefined);

            return {
                name: ex.name,
                setsCompleted: completedSets.length,
                totalVolume: volume,
                bestSet,
            };
        }).filter(e => e.setsCompleted > 0);

        return { totalVolume, totalSets, totalReps, duration, exerciseCount, exerciseStats, avgRpeActual, avgRpeTarget };
    }, [session]);

    // Compute PRs
    useEffect(() => {
        let cancelled = false;

        const computePRs = async () => {
            if (!session.exercises || session.exercises.length === 0) {
                if (!cancelled) {
                    setPrsCount(0);
                    setPrExercises(new Set());
                }
                return;
            }

            try {
                const allSessions = await getWorkoutSessions();
                const currentStartMs = session.startTime ? new Date(session.startTime).getTime() : null;

                const historyBefore = currentStartMs
                    ? allSessions.filter(s => {
                        if (!s.startTime) return true;
                        return new Date(s.startTime).getTime() < currentStartMs;
                    })
                    : allSessions;

                const basePrMap = calculatePRsFromHistory(historyBefore);
                let count = 0;
                const prNames = new Set<string>();

                session.exercises.forEach(ex => {
                    const hasNewPr = ex.sets?.some(set => isNewPR(ex.exerciseId || ex.id, set.weight, set.reps, basePrMap).isWeightPR);
                    if (hasNewPr) {
                        count += 1;
                        prNames.add(ex.name ?? '');
                    }
                });

                if (!cancelled) {
                    setPrsCount(count);
                    setPrExercises(prNames);
                }
            } catch (error) {
                console.error('Failed to compute PR count for summary', error);
                if (!cancelled) {
                    setPrsCount(0);
                    setPrExercises(new Set());
                }
            }
        };

        computePRs();

        return () => { cancelled = true; };
    }, [session]);

    // Export CSV
    const handleExportCSV = useCallback(() => {
        exportWorkoutHistoryCSV([session as WorkoutSession]);
        const blob = new Blob(['Workout exported'], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `workout_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [session]);

    // Share (if available)
    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'סיכום אימון',
                    text: `סיימתי אימון! 🏋️\n⏱️ ${stats.duration} דקות\n🔥 ${stats.totalVolume.toLocaleString()} ק״ג נפח\n✅ ${stats.totalSets} סטים\n🏆 ${prsCount || 0} שיאים חדשים!`,
                });
            } catch {
                // Share cancelled or failed — no action needed
            }
        }
    }, [stats, prsCount]);

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="modal"
            zLevel="high"
            backdropOpacity={90}
            blur="xl"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel="סיכום אימון"
        >
            {/* Confetti */}
            {showConfetti && <Confetti />}

            <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={e => e.stopPropagation()}
                className="spark-glass-heavy rounded-[32px] p-6 max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                {/* Header */}
                <motion.div
                    className="text-center mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--cosmos-accent-primary)] to-emerald-500 flex items-center justify-center shadow-lg shadow-[var(--cosmos-accent-primary)]/30"
                    >
                        <CheckCircleIcon className="w-10 h-10 text-black" />
                    </motion.div>
                    <h2 className="text-3xl font-black text-white tracking-tight mb-1">
                        אימון הושלם! 🎉
                    </h2>
                    <p className="text-sm text-white/40 font-medium">
                        {new Date().toLocaleDateString('he-IL', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                        })}
                    </p>
                </motion.div>

                {/* View Toggle */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex premium-card p-1 text-xs" style={{ padding: '4px', borderRadius: '16px' }}>
                        {['overview', 'details'].map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setView(v as 'overview' | 'details')}
                                onPointerDown={(e) => { e.preventDefault(); setView(v as 'overview' | 'details'); }}
                                className={`px-5 py-2 rounded-lg font-bold transition-all ${view === v
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-white/40 hover:text-white/60'
                                    }`}
                            >
                                {v === 'overview' ? 'סקירה' : 'פרטים'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
                    <AnimatePresence mode="wait">
                        {view === 'overview' ? (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, x: -30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 30 }}
                                className="space-y-5"
                            >
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard
                                        icon={<FlameIcon className="w-6 h-6" />}
                                        label="נפח כולל"
                                        value={stats.totalVolume}
                                        suffix=" ק״ג"
                                        color="var(--cosmos-accent-tertiary)"
                                        delay={0.1}
                                        ringProgress={Math.min(stats.totalVolume / 5000 * 100, 100)}
                                    />
                                    <StatCard
                                        icon={<ClockIcon className="w-6 h-6" />}
                                        label="משך"
                                        value={stats.duration}
                                        suffix=" דק'"
                                        color="var(--cosmos-success)"
                                        delay={0.2}
                                        ringProgress={Math.min(stats.duration / 90 * 100, 100)}
                                    />
                                    <StatCard
                                        icon={<CheckCircleIcon className="w-6 h-6" />}
                                        label="סטים"
                                        value={stats.totalSets}
                                        color="var(--cosmos-info)"
                                        delay={0.3}
                                        ringProgress={Math.min(stats.totalSets / 30 * 100, 100)}
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

                                {/* Comparison to Previous Workout */}
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
                                            current={stats.totalVolume}
                                            previous={comparison.prevVolume}
                                            unit=" ק״ג"
                                            isPositive={true}
                                            delay={0.4}
                                        />
                                        <ComparisonBadge
                                            label="משך"
                                            current={stats.duration}
                                            previous={comparison.prevDuration}
                                            unit=" דק'"
                                            isPositive={true}
                                            delay={0.45}
                                        />
                                        <ComparisonBadge
                                            label="סטים"
                                            current={stats.totalSets}
                                            previous={comparison.prevSets}
                                            isPositive={true}
                                            delay={0.5}
                                        />
                                    </motion.div>
                                )}

                                {/* RPE Comparison */}
                                {stats.avgRpeActual !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.45 }}
                                        className="premium-card p-4"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">מאמץ (RPE)</span>
                                            {stats.avgRpeTarget !== null && (
                                                <span className="text-[10px] text-white/30">
                                                    יעד: {stats.avgRpeTarget}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-[800] text-white">
                                                {stats.avgRpeActual}
                                            </span>
                                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        backgroundColor: stats.avgRpeActual <= 6 ? 'var(--cosmos-success)' :
                                                            stats.avgRpeActual <= 8 ? 'var(--cosmos-warning)' : 'var(--cosmos-error)',
                                                    }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(stats.avgRpeActual * 10, 100)}%` }}
                                                    transition={{ duration: 1, delay: 0.5 }}
                                                />
                                            </div>
                                            <span className="text-sm">
                                                {stats.avgRpeActual <= 6 ? '😊' :
                                                    stats.avgRpeActual <= 8 ? '😤' : '🔥'}
                                            </span>
                                        </div>
                                        {stats.avgRpeTarget !== null && (
                                            <p className="text-[10px] text-white/30 mt-2">
                                                {stats.avgRpeActual < stats.avgRpeTarget
                                                    ? '📉 מתחת ליעד — אפשר לדחוף יותר!'
                                                    : stats.avgRpeActual > stats.avgRpeTarget
                                                        ? '📈 מעל היעד — מאמץ גבוה!'
                                                        : '✅ בול ביעד!'
                                                }
                                            </p>
                                        )}
                                    </motion.div>
                                )}

                                {/* Quick Summary */}
                                {stats.exerciseStats.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.15em] mb-3 px-1">
                                            סיכום תרגילים
                                        </h3>
                                        <div className="space-y-2">
                                            {stats.exerciseStats.slice(0, 4).map((ex, i) => (
                                                <ExerciseSummaryItem
                                                    key={ex.name ?? ''}
                                                    name={ex.name ?? ''}
                                                    setsCompleted={ex.setsCompleted}
                                                    totalVolume={ex.totalVolume}
                                                    bestSet={ex.bestSet}
                                                    isPR={prExercises.has(ex.name ?? '')}
                                                    delay={0.5 + i * 0.08}
                                                />
                                            ))}
                                            {stats.exerciseStats.length > 4 && (
                                                <p className="text-center text-xs text-white/30 pt-2">
                                                    + {stats.exerciseStats.length - 4} תרגילים נוספים
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-4"
                            >
                                {stats.exerciseStats.map((ex, i) => (
                                    <ExerciseSummaryItem
                                        key={ex.name ?? ''}
                                        name={ex.name ?? ''}
                                        setsCompleted={ex.setsCompleted}
                                        totalVolume={ex.totalVolume}
                                        bestSet={ex.bestSet}
                                        isPR={prExercises.has(ex.name ?? '')}
                                        delay={i * 0.05}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <motion.div
                    className="mt-6 space-y-3 pt-4 border-t border-white/5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <button
                        onClick={() => onClose()}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            onClose();
                        }}
                        className="btn-primary w-full shadow-apple-action text-xl mb-3"
                    >
                        סיום 🎉
                    </button>

                    <div className="flex gap-3">
                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                            <button
                                onClick={handleShare}
                                onPointerDown={(e) => { e.preventDefault(); handleShare(); }}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                                שתף
                            </button>
                        )}
                        <button
                            onClick={handleExportCSV}
                            onPointerDown={(e) => { e.preventDefault(); handleExportCSV(); }}
                            className="btn-secondary flex-1"
                        >
                            ייצוא CSV
                        </button>
                        {onSaveAsTemplate && (
                            <button
                                onClick={onSaveAsTemplate}
                                onPointerDown={(e) => { e.preventDefault(); onSaveAsTemplate(); }}
                                className="btn-secondary flex-1"
                            >
                                שמור תבנית
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </ModalOverlay>
    );
};

export default React.memo(WorkoutSummary);
