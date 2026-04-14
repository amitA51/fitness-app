import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersonalRecord } from '../../services/prService';
import { TrophyIcon } from '../icons';
import { showToast } from './components/ui/Toast';

interface PRCelebrationProps {
  isVisible: boolean;
  pr: PersonalRecord | null;
  onDismiss: () => void;
}

// ============================================================
// CONFETTI PARTICLE CONFIG (deterministic - no Math.random in render)
// ============================================================

const CONFETTI_COLORS = ['#fcd34d', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];

// Pre-computed confetti particles with deterministic values
const CONFETTI_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  // Use deterministic pseudo-random based on index
  const seed = (i * 1337) % 100;
  const angle = (i / 24) * Math.PI * 2;
  const distance = 100 + (seed % 60);
  const rotation = seed * 7.2; // 0-720 range
  const delay = (seed % 30) / 100; // 0-0.3 range
  const size = 8 + (seed % 8);
  const isCircle = seed % 2 === 0;

  return {
    id: i,
    angle,
    distance,
    rotation,
    delay,
    size,
    isCircle,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  };
});

const PRCelebration: React.FC<PRCelebrationProps> = ({ isVisible, pr, onDismiss }) => {
  // Stable share handler
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pr) return;

    const shareText = `🏆 שיא אישי חדש!\n${pr.exerciseName}: ${pr.maxWeight}kg × ${pr.maxWeightReps}\n1RM משוער: ~${pr.oneRepMax} ק"ג`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'שיא אישי חדש! 🏆',
          text: shareText,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      showToast('הועתק ללוח!', 'success');
    }
  }, [pr]);

  if (!pr) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
            className="pointer-events-auto"
            onClick={onDismiss}
          >
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-3xl opacity-60 animate-pulse" />

              {/* Main Card */}
              <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-600/20 backdrop-blur-xl border-2 border-yellow-400/50 rounded-3xl p-8 shadow-2xl min-w-[320px]">
                {/* Trophy Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="flex justify-center mb-4"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50">
                    <TrophyIcon className="w-10 h-10 text-white" />
                  </div>
                </motion.div>

                {/* Text */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
                    שיא אישי חדש!
                  </h2>
                  <p className="text-sm text-yellow-200/80 mb-4 uppercase tracking-widest font-bold">
                    {pr.exerciseName}
                  </p>

                  <div className="bg-black/30 rounded-2xl p-4 border border-yellow-400/30">
                    <div className="text-4xl font-black text-yellow-300 mb-1">
                      {pr.maxWeight}kg × {pr.maxWeightReps}
                    </div>
                    <div className="text-sm text-yellow-200/60">1RM משוער: ~{pr.oneRepMax} ק"ג</div>
                  </div>

                  {/* Share Button */}
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={handleShare}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold rounded-full text-sm shadow-lg shadow-yellow-500/30 transition-all"
                  >
                    שתף את השיא 🚀
                  </motion.button>

                  <p className="text-xs text-white/50 mt-4">לחץ להמשך</p>
                </motion.div>

                {/* Confetti Explosion - using pre-computed particles */}
                {CONFETTI_PARTICLES.map((particle) => (
                  <motion.div
                    key={particle.id}
                    initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 0.5],
                      opacity: [1, 1, 0],
                      x: Math.cos(particle.angle) * particle.distance,
                      y: Math.sin(particle.angle) * particle.distance + 30,
                      rotate: particle.rotation,
                    }}
                    transition={{
                      duration: 1.2,
                      delay: particle.delay,
                      ease: 'easeOut',
                    }}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color,
                      borderRadius: particle.isCircle ? '50%' : '2px',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(PRCelebration);
