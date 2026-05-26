// SwipeComplete - Ultra Premium Swipe-to-Complete with Spring Physics
// Features: Fluid spring animations, haptic simulation, success celebration, undo window

import {
  AnimatePresence,
  type PanInfo,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Check as CheckCheckIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';

// ============================================================
// TYPES
// ============================================================

interface SwipeCompleteProps {
  onComplete: () => void;
  onUndo?: () => void;
  disabled?: boolean;
  label?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const UNDO_TIMEOUT = 4000; // 4 seconds to undo
const COMPLETE_THRESHOLD = 120; // Pixels to drag for completion
const SPRING_CONFIG = { stiffness: 400, damping: 30, mass: 0.8 };

// ============================================================
// SUCCESS PARTICLES (pre-generated for stability)
// ============================================================

// Pre-generate particle configurations outside component to avoid recreation
const PARTICLE_COLORS = ['#30D158', '#34C759', '#32D74B', '#a3e635'];
const PARTICLE_CONFIG = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  angle: (i / 12) * 360,
  distance: 40 + (i % 4) * 10, // Deterministic instead of random
  size: 4 + (i % 3) * 2, // Deterministic instead of random
  duration: 0.5 + (i % 4) * 0.1, // Deterministic instead of random
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
}));

const SuccessParticles = memo(() => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {PARTICLE_CONFIG.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            scale: [0, 1.5, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            ease: 'easeOut',
          }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
});

SuccessParticles.displayName = 'SuccessParticles';

// ============================================================
// ANIMATED CHECKMARK
// ============================================================

const AnimatedCheckmark = memo<{ isComplete: boolean }>(({ isComplete }) => (
  <motion.svg viewBox="0 0 24 24" className="w-7 h-7" initial={false}>
    <motion.path
      d="M5 13l4 4L19 7"
      fill="none"
      stroke={isComplete ? '#000' : '#000'}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: isComplete ? 1 : 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  </motion.svg>
));

AnimatedCheckmark.displayName = 'AnimatedCheckmark';

// ============================================================
// MAIN COMPONENT
// ============================================================

const SwipeComplete = memo<SwipeCompleteProps>(
  ({ onComplete, onUndo, disabled = false, label = 'החלק לסיום' }) => {
    const x = useMotionValue(0);
    const springX = useSpring(x, SPRING_CONFIG);

    const [isCompleting, setIsCompleting] = useState(false);
    const [showUndo, setShowUndo] = useState(false);
    const [showParticles, setShowParticles] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const maxDrag = containerWidth - 76; // Account for handle width

    // RTL awareness — match project convention from SlideToComplete.tsx
    const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';

    // Transforms based on drag position
    const backgroundOpacity = useTransform(x, [0, COMPLETE_THRESHOLD], [0, 0.5]);
    const textOpacity = useTransform(x, [0, 80], [1, 0]);
    const handleScale = useTransform(x, [0, 50, COMPLETE_THRESHOLD], [1, 1.05, 1.1]);
    const handleRotation = useTransform(x, [0, COMPLETE_THRESHOLD], [0, 15]);
    // Progress as a 0..1 fraction so we can drive scaleX (compositor-friendly)
    // instead of width (layout + paint on every frame).
    const progressScale = useTransform(x, [0, maxDrag], [0, 1]);
    const glowIntensity = useTransform(x, [0, COMPLETE_THRESHOLD], [0, 1]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }
      };
    }, []);

    // Handle drag start
    const handleDragStart = useCallback(() => {
      if (disabled) return;
      setIsDragging(true);
      triggerHaptic('light');
    }, [disabled]);

    // Handle drag
    const handleDrag = useCallback(() => {
      // Haptic feedback at threshold
      const currentX = x.get();
      if (currentX > COMPLETE_THRESHOLD - 10 && currentX < COMPLETE_THRESHOLD + 10) {
        triggerHaptic('selection');
      }
    }, [x]);

    // Handle drag end
    const handleDragEnd = useCallback(
      (_: unknown, info: PanInfo) => {
        if (disabled) return;
        setIsDragging(false);

        if (info.offset.x > COMPLETE_THRESHOLD || info.velocity.x > 500) {
          // Complete!
          setIsCompleting(true);
          setShowParticles(true);
          triggerHaptic('success');

          // Animate to end
          x.set(maxDrag);

          // Trigger callback
          setTimeout(() => {
            onComplete();
          }, 100);

          // Show undo button
          if (onUndo) {
            setShowUndo(true);
            undoTimeoutRef.current = setTimeout(() => {
              setShowUndo(false);
              undoTimeoutRef.current = null;
            }, UNDO_TIMEOUT);
          }

          // Reset after animation
          setTimeout(() => {
            setIsCompleting(false);
            setShowParticles(false);
            x.set(0);
          }, 1000);
        } else {
          // Snap back with spring
          x.set(0);
        }
      },
      [disabled, maxDrag, onComplete, onUndo, x]
    );

    // Handle undo
    const handleUndo = useCallback(() => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
      setShowUndo(false);
      triggerHaptic('light');
      onUndo?.();
    }, [onUndo]);

    return (
      <div
        ref={containerRef}
        className={`
                relative w-full h-[76px] rounded-[24px] overflow-hidden
                ${disabled ? 'opacity-50' : ''}
            `}
      >
        {/* Background Track */}
        <div className="absolute inset-0 bg-[var(--bg-secondary)] border border-white/5 rounded-[24px]" />

        {/* Progress Fill — full-width element scaled via transform (compositor-only). */}
        {/* transformOrigin flips for RTL so the fill grows from the start edge. */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-[var(--color-success-fg)]/20 to-[var(--color-success-fg)]/40 rounded-[24px]"
          style={{
            scaleX: progressScale,
            transformOrigin: isRTL ? 'right center' : 'left center',
            willChange: isDragging ? 'transform' : 'auto',
          }}
        />

        {/* Glow Effect — static box-shadow on a sibling overlay; only opacity animates. */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[24px]"
          style={{
            opacity: glowIntensity,
            boxShadow: '0 0 40px rgba(48, 209, 88, 0.3)',
            willChange: isDragging ? 'opacity' : 'auto',
          }}
        />

        {/* Success Fill Animation */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-green-500/30 rounded-[24px]"
          style={{ opacity: backgroundOpacity }}
        />

        {/* Text — motion.div accepts MotionValue directly, removing the unsafe cast. */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: textOpacity }}
        >
          <div className="flex items-center gap-3 font-bold text-sm tracking-wide uppercase overflow-hidden">
            <span className="text-white/80">{label}</span>
            <span className="text-lg text-white/50">→</span>
          </div>
        </motion.div>

        {/* Draggable Handle */}
        <motion.div
          className={`
                    absolute left-[6px] top-[6px] bottom-[6px] w-[64px]
                    rounded-[20px] z-10
                    flex items-center justify-center 
                    cursor-grab active:cursor-grabbing
                    ${isCompleting ? 'bg-emerald-500' : 'bg-[var(--fs-accent)]'}
                    ${disabled ? 'cursor-not-allowed' : ''}
                `}
          style={{
            x: springX,
            scale: handleScale,
            rotate: handleRotation,
            boxShadow: isCompleting
              ? '0 0 30px rgba(48, 209, 88, 0.6)'
              : '0 0 20px rgba(163, 230, 53, 0.4)',
          }}
          drag={disabled ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0.05}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileTap={disabled ? {} : { scale: 1.05 }}
        >
          {/* Handle Content */}
          <motion.div
            animate={
              isCompleting
                ? {
                    scale: [1, 1.3, 1],
                    rotate: [0, 10, -10, 0],
                  }
                : {}
            }
            transition={{ duration: 0.5 }}
          >
            {isCompleting ? (
              <AnimatedCheckmark isComplete={true} />
            ) : (
              <CheckCheckIcon className="w-7 h-7 text-black" />
            )}
          </motion.div>

          {/* Handle Shine */}
          <div className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none">
            <div
              className="absolute top-0 left-0 right-0 h-[40%]"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
              }}
            />
          </div>
        </motion.div>

        {/* Success Particles */}
        <AnimatePresence>
          {showParticles && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
              style={{ left: maxDrag / 2 }}
            >
              <SuccessParticles />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Checkmark Overlay */}
        <AnimatePresence>
          {isCompleting && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.4 }}
                className="w-16 h-16 rounded-full bg-emerald-500/30 backdrop-blur-sm flex items-center justify-center border border-emerald-500/50"
              >
                <CheckCheckIcon className="w-8 h-8 text-emerald-400" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo Button */}
        <AnimatePresence>
          {showUndo && (
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              onClick={handleUndo}
              className="
                            absolute right-3 top-1/2 -translate-y-1/2 z-30 
                            px-4 py-2.5 rounded-xl
                            bg-[var(--bg-tertiary)] hover:bg-[var(--gray-600)] 
                            border border-white/10
                            text-xs font-bold text-white 
                            shadow-lg transition-all
                            flex items-center gap-2
                        "
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              <span>בטל</span>

              {/* Countdown indicator */}
              <motion.div
                className="absolute bottom-0 left-0 h-[2px] bg-white/30 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: UNDO_TIMEOUT / 1000, ease: 'linear' }}
              />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Drag Hint (pulses when idle) */}
        {!isDragging && !isCompleting && !showUndo && (
          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

SwipeComplete.displayName = 'SwipeComplete';

export default SwipeComplete;
