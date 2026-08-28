// ProgressBar - Ultra Premium Top Progress Indicator with Glow Effects
// Features: Gradient animation, particle trail, milestone markers

import { AnimatePresence, m } from 'framer-motion';
import { memo } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

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
  <m.div
    className="absolute start-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white"
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

// Milestone positions (static — hoisted so the array isn't rebuilt each render).
const MILESTONES = [25, 50, 75, 100];

const ProgressBar = memo<ProgressBarProps>(({ progress, showMilestones = false }) => {
  const shouldReduce = useReducedMotion();
  // Clamp progress between 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="absolute top-0 start-0 end-0 h-1.5 z-sticky"
      style={{ background: 'var(--fs-surface-2)' }}
    >
      {/* Background Track */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10" />

      {/* Progress Fill */}
      <m.div
        className="absolute top-0 start-0 h-full w-full shadow-[0_0_15px_var(--fs-accent)]"
        style={{
          background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
          // The fill grows from the reading start toward the reading end, matching
          // the app's other progress fills (MacroStrip, AnimatedBar, PRHighlights).
          // transform-origin has no logical `inline-start` keyword, so this uses the
          // project token that resolves to 0%/100% per document direction.
          transformOrigin: 'var(--progress-fill-origin-inline-start)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clampedProgress / 100 }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* Shimmer effect */}
        {!shouldReduce && (
          <m.div
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
        )}

        {/* Leading edge glow */}
        {!shouldReduce && (
          <m.div
            className="absolute end-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full accent-glow"
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
        )}
      </m.div>

      {/* Milestone Markers */}
      {showMilestones &&
        MILESTONES.map((milestone) => (
          <div
            key={milestone}
            className={`
                        absolute top-0 bottom-0 w-[2px]
                        ${clampedProgress >= milestone ? 'bg-white/50' : 'bg-white/10'}
                    `}
            // Milestones are measured along the fill's travel, i.e. from the
            // reading start — the same edge `--progress-fill-origin-inline-start`
            // anchors the fill to. In RTL this resolves to the physical right,
            // which is where these markers already rendered.
            style={{ insetInlineStart: `${milestone}%` }}
          >
            {/* Completion indicator */}
            <AnimatePresence>
              {clampedProgress >= milestone && (
                <m.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  // `left-1/2 -translate-x-1/2` is the centering idiom, not a
                  // direction choice: the physical offset and the physical
                  // translate cancel out, so the dot centres on the marker in
                  // both directions. Converting only the inset would break it.
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-lg shadow-white/50"
                />
              )}
            </AnimatePresence>
          </div>
        ))}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
