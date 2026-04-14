import React from 'react';
import { motion } from 'framer-motion';
import { WorkoutGoal } from '../../types';

interface WorkoutGoalSelectorProps {
  onSelect: (goal: WorkoutGoal) => void;
  onClose: () => void;
  currentGoal?: WorkoutGoal;
}

const goals: {
  id: WorkoutGoal;
  label: string;
  icon: string;
  description: string;
  color: string;
}[] = [
    {
      id: 'strength',
      label: 'כוח',
      icon: '💪',
      description: 'חזרות מעטות, משקל גבוה, מנוחה ארוכה. התמקדות בכוח גולמי.',
      color: '#ef4444',
    },
    {
      id: 'hypertrophy',
      label: 'היפרטרופיה',
      icon: '🦍',
      description: 'חזרות בינוניות, משקל בינוני. התמקדות בגדילת שרירים.',
      color: '#3b82f6',
    },
    {
      id: 'endurance',
      label: 'סיבולת',
      icon: '🏃',
      description: 'חזרות רבות, משקל נמוך, מנוחה קצרה. התמקדות בכושר.',
      color: '#10b981',
    },
    {
      id: 'general',
      label: 'כושר כללי',
      icon: '✨',
      description: 'גישה מאוזנת לבריאות ואיכות חיים כללית.',
      color: '#8b5cf6',
    },
  ];

const WorkoutGoalSelector: React.FC<WorkoutGoalSelectorProps> = ({
  onSelect,
  onClose,
  currentGoal,
}) => {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-[90%] max-w-[400px] p-6 flex flex-col gap-5 workout-glass-card rounded-3xl shadow-2xl"
      >
        {/* Header with gradient */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-1">בחר את המטרה שלך</h2>
          <p className="text-sm text-white/50">התאם את האימון לצרכים שלך</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {goals.map((goal, index) => {
            const isSelected = currentGoal === goal.id;
            return (
              <motion.button
                key={goal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(30);
                  onSelect(goal.id);
                }}
                className={`
                  relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all w-full text-right overflow-hidden
                  ${isSelected
                    ? 'workout-glow-primary'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }
                `}
                style={{
                  borderColor: isSelected ? goal.color : undefined,
                  background: isSelected
                    ? `linear-gradient(135deg, ${goal.color}20 0%, ${goal.color}10 100%)`
                    : undefined,
                }}
              >
                {/* Shimmer effect on selected */}
                {isSelected && (
                  <div className="absolute inset-0 workout-shimmer pointer-events-none" />
                )}

                <span className="text-4xl filter drop-shadow-lg">{goal.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-lg">{goal.label}</div>
                  <div className="text-sm text-white/60 mt-0.5 leading-relaxed">{goal.description}</div>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
                    style={{ background: goal.color }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="mt-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
        >
          ביטול
        </motion.button>
      </motion.div>
    </div>
  );
};

export default React.memo(WorkoutGoalSelector);

