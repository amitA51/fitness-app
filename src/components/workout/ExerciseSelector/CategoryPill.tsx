import { motion } from 'framer-motion';
import { triggerHaptic } from '../../../utils/haptics';

interface CategoryPillProps {
  label: string;
  emoji?: string;
  isActive: boolean;
  onClick: () => void;
}

export const CategoryPill = ({ label, emoji, isActive, onClick }: CategoryPillProps) => (
  <motion.button
    type="button"
    onClick={() => {
      triggerHaptic();
      onClick();
    }}
    whileTap={{ scale: 0.95 }}
    className={`
      relative flex-shrink-0 flex items-center gap-2 
      px-4 py-2 rounded-full
      font-medium text-sm
      transition-all duration-200
            ${
              isActive
                ? 'bg-[var(--bg-inverse)] text-[var(--text-inverse)] font-bold'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] active:bg-[var(--bg-hover)]'
            }
    `}
  >
    {emoji && <span className="text-base">{emoji}</span>}
    <span>{label}</span>
  </motion.button>
);
