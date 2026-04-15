import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrashIcon } from '../../icons';
import { PersonalExercise } from '../../../types';

const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

interface ExerciseCardProps {
  exercise: PersonalExercise;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onClick?: (exercise: PersonalExercise) => void;
  onDelete?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = memo(({
  exercise,
  isSelectionMode = false,
  selectedIds,
  onClick,
  onDelete,
}) => {
  const renderExerciseName = (name: string) => {
    if (name.includes('|')) {
      const [first = '', second = ''] = name.split('|').map(s => s.trim());
      const firstIsHebrew = hasHebrew(first);
      return (
        <div className="flex flex-col">
          <span className="font-bold text-white text-base leading-tight">
            {firstIsHebrew ? first : second}
          </span>
          <span className="text-xs text-white/50 font-medium">
            {firstIsHebrew ? second : first}
          </span>
        </div>
      );
    }
    return <span className="font-bold text-white text-base">{name}</span>;
  };

  const isSelected = selectedIds?.has(exercise.id);

  return (
    <motion.div
      layoutId={`ex-${exercise.id}`}
      key={exercise.id}
      onClick={() => onClick?.(exercise)}
      className={`
        relative p-4 rounded-xl border transition-all cursor-pointer group overflow-hidden
        ${
          isSelectionMode
            ? isSelected
              ? 'border-[var(--cosmos-accent-primary)] bg-[var(--cosmos-accent-primary)]/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
              : 'hover:border-[var(--cosmos-accent-primary)]/50 hover:bg-[var(--cosmos-accent-primary)]/5 bg-white/5 border-white/10'
            : 'bg-[var(--bg-secondary)] border-white/5 hover:border-white/20 hover:bg-white/10'
        }
      `}
    >
      {/* Selection Indicator - Premium Checkbox */}
      {isSelectionMode && (
        <motion.div
          className={`absolute top-4 left-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'border-[var(--cosmos-accent-primary)] bg-[var(--cosmos-accent-primary)] scale-110'
              : 'border-white/30 bg-transparent group-hover:border-[var(--cosmos-accent-primary)]/50'
          }`}
          animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence>
            {isSelected && (
              <motion.svg
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Selection Glow Effect */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(99,102,241,0.1) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex justify-between items-start">
        <div className={`flex-1 ${isSelectionMode ? 'pl-10' : ''}`}>
          {renderExerciseName(exercise.name ?? '')}

          <div className="flex flex-wrap gap-2 mt-2">
            {exercise.muscleGroup && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                isSelected
                  ? 'bg-[var(--cosmos-accent-primary)]/20 text-[var(--cosmos-accent-primary)] border-[var(--cosmos-accent-primary)]/30'
                  : 'bg-white/10 text-white/70 border-white/5'
              }`}>
                {exercise.muscleGroup}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 flex items-center gap-1">
              ⏱ {exercise.defaultRestTime || 90}s
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 flex items-center gap-1">
              📊 {exercise.defaultSets || 4} sets
            </span>
          </div>

          {exercise.notes && (
            <p className="text-xs text-white/30 mt-2 line-clamp-1 italic">
              "{exercise.notes}"
            </p>
          )}
        </div>

        {!isSelectionMode && onDelete && (
          <button
            onClick={e => onDelete(exercise, e)}
            className="p-2 -mt-2 -ml-2 text-white/10 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
});

ExerciseCard.displayName = 'ExerciseCard';

export { ExerciseCard };
