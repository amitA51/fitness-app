// ProgressBar - Ultra Premium Top Progress Indicator with Glow Effects
// Features: Gradient animation, particle trail, milestone markers

import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ProgressBarProps {
  progress: number; // 0-100
  showMilestones?: boolean;
}

// ============================================================
// PROGRESS PARTICLE
// ============================================================

const ProgressParticle = memo<{ delay: number }>(({ delay }) => (
  <motion.div
    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white"
    initial={{ opacity: 0, scale: 0, x: 0 }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
      x: [0, -20, -40],
      y: [0, -5, 0],
    }}
    transition={{
      duration: 1,
      delay,
      ease: 'easeOut',
    }}
  />
));

ProgressParticle.displayName = 'ProgressParticle';

// ============================================================
// MAIN COMPONENT
// ============================================================

const ProgressBar = memo<ProgressBarProps>(({ progress, showMilestones = false }) => {
  // Clamp progress between 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Milestone positions
  const milestones = [25, 50, 75, 100];

  return (
    <div
      className="absolute top-0 left-0 right-0 h-1.5 z-[100]"
      style={{ background: 'var(--fs-surface-2)' }}
    >
      {/* Background Track */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10" />

      {/* Progress Fill */}
      <motion.div
        className="absolute top-0 left-0 h-full shadow-[0_0_15px_var(--fs-accent)]"
        style={{ background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))' }}
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress}%` }}
        transition={{
          duration: 0.5,
          ease: [0.34, 1.56, 0.64, 1], // Bounce easing
        }}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />

        {/* Leading edge glow */}
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full accent-glow"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--fs-accent) 80%, transparent) 0%, transparent 70%)',
          }}
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Milestone Markers */}
      {showMilestones &&
        milestones.map((milestone) => (
          <div
            key={milestone}
            className={`
                        absolute top-0 bottom-0 w-[2px]
                        ${clampedProgress >= milestone ? 'bg-white/50' : 'bg-white/10'}
                    `}
            style={{ left: `${milestone}%` }}
          >
            {/* Completion indicator */}
            <AnimatePresence>
              {clampedProgress >= milestone && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-lg shadow-white/50"
                />
              )}
            </AnimatePresence>
          </div>
        ))}

      {/* Percentage display on hover area (invisible) */}
      <div
        className="absolute inset-0 cursor-default"
        title={`${Math.round(clampedProgress)}% completed`}
      />
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
