import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WaterReminderToastProps {
  isVisible: boolean;
  onDismiss: () => void;
}

const WaterReminderToast: React.FC<WaterReminderToastProps> = ({ isVisible, onDismiss }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onDismiss, 5000); // Auto dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          onClick={onDismiss}
          className="fixed bottom-[100px] left-1/2 -translate-x-1/2 bg-cyan-500/20 border border-[var(--cosmos-accent-cyan)] backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-3 z-[9000] shadow-[0_4px_20px_rgba(6,182,212,0.3)] cursor-pointer hover:bg-cyan-500/30 transition-colors"
        >
          <span className="text-2xl">💧</span>
          <div>
            <div className="font-bold text-white text-sm">שתה מים!</div>
            <div className="text-xs text-white/80">זמן ללגום מעט מים</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(WaterReminderToast);
