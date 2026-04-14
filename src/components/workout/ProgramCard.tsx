import React from 'react';
import { motion } from 'framer-motion';
import type { WorkoutProgram } from '../../data/workoutPrograms';
import { getIconForName } from './common/IconMap';
import { CalendarIcon } from './icons';

interface ProgramCardProps {
    program: WorkoutProgram;
    onClick: () => void;
    isSelected?: boolean;
}

const difficultyConfig = {
    beginner: { label: 'מתחיל', color: '#10B981', bgColor: '#10B98120' },
    intermediate: { label: 'ביניים', color: '#F59E0B', bgColor: '#F59E0B20' },
    advanced: { label: 'מתקדם', color: '#EF4444', bgColor: '#EF444420' },
};

/**
 * ProgramCard - Displays a workout program with key info
 * Used in Fitness hub to select training programs
 */
export const ProgramCard: React.FC<ProgramCardProps> = ({
    program,
    onClick,
    isSelected = false,
}) => {
    const Icon = getIconForName(program.icon);
    const difficulty = difficultyConfig[program.difficulty];

    // Read program progress from localStorage
    const progress = React.useMemo(() => {
        try {
            const stored = localStorage.getItem(`program_progress_${program.id}`);
            if (stored) return JSON.parse(stored) as { completedDays: number; currentWeek: number; totalDays: number };
        } catch { /* ignore */ }
        return null;
    }, [program.id]);

    const progressPercent = progress && progress.totalDays > 0
        ? Math.round((progress.completedDays / progress.totalDays) * 100)
        : 0;

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`
        w-full p-5 rounded-2xl text-right transition-all relative overflow-hidden
        ${isSelected
                    ? 'ring-2 ring-offset-2 ring-offset-black'
                    : 'hover:bg-white/5'
                }
      `}
            style={{
                background: isSelected
                    ? `linear-gradient(135deg, ${program.color}30, ${program.color}10)`
                    : 'rgba(255,255,255,0.03)',
            }}
        >
            {/* Background gradient accent */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at top right, ${program.color}, transparent 70%)`,
                }}
            />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${program.color}20` }}
                    >
                        <Icon className="w-6 h-6" style={{ color: program.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg truncate">
                            {program.nameHe}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {program.name}
                        </p>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {program.descriptionHe}
                </p>

                {/* Progress Bar */}
                {progress && progressPercent > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                שבוע {progress.currentWeek}{program.totalWeeks ? ` / ${program.totalWeeks}` : ''}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: program.color }}>
                                {progressPercent}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: program.color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="text-[10px] text-white/30 mt-1 block">
                            {progress.completedDays} / {progress.totalDays} ימים הושלמו
                        </span>
                    </div>
                )}

                {/* Meta badges */}
                <div className="flex flex-wrap gap-2">
                    {/* Difficulty */}
                    <span
                        className="px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: difficulty.bgColor, color: difficulty.color }}
                    >
                        {difficulty.label}
                    </span>

                    {/* Days per week */}
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-gray-300 flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {program.daysPerWeek} ימים/שבוע
                    </span>

                    {/* Focus areas */}
                    {(program.focusAreas ?? []).slice(0, 2).map((area, i) => (
                        <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400"
                        >
                            {area === 'strength' ? 'כוח' :
                                area === 'hypertrophy' ? 'נפח' :
                                    area === 'compound' ? 'תרגילים מורכבים' :
                                        area === 'balanced' ? 'מאוזן' : area}
                        </span>
                    ))}

                    {/* Multi-week indicator */}
                    {program.totalWeeks && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                            style={{ backgroundColor: `${program.color}15`, color: program.color }}>
                            📅 {program.totalWeeks} שבועות
                        </span>
                    )}
                    {program.periodization && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400 flex items-center gap-1">
                            📈 {program.periodization === 'Linear' ? 'פרוגרסיה ליניארית' : program.periodization}
                        </span>
                    )}
                </div>
            </div>
        </motion.button>
    );
};

export default ProgramCard;
