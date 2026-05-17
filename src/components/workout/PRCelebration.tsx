// PRCelebration - Sport Annual Editorial Design
// Navy masthead · Bone body · Mustard accents · Sharp corners
// Celebrates new personal records with editorial style

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, { useCallback } from 'react';
import type { PersonalRecord } from '../../services/prService';
import { showToast } from './components/ui/Toast';

interface PRCelebrationProps {
  isVisible: boolean;
  pr: PersonalRecord | null;
  onDismiss: () => void;
}

// Pre-computed confetti particles with deterministic values
const CONFETTI_COLORS = ['#E8B82D', '#F5F1EB', '#14293D', '#7E7D78', '#EAE4DA', '#0B1A2B'];

const CONFETTI_PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const seed = (i * 1337) % 100;
  const angle = (i / 20) * Math.PI * 2;
  const distance = 80 + (seed % 50);
  const rotation = seed * 7.2;
  const delay = (seed % 30) / 100;
  const size = 6 + (seed % 6);
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
  const shouldReduceMotion = useReducedMotion();
  const isRTL = document.dir === 'rtl';

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!pr) return;
      const shareText = `שיא אישי חדש! ${pr.exerciseName}: ${pr.maxWeight}kg × ${pr.maxWeightReps} 1RM משוער: ~${pr.oneRepMax} ק"ג`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'שיא אישי חדש!', text: shareText });
        } catch {
          // cancelled
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        showToast('הועתק ללוח', 'success');
      }
    },
    [pr]
  );

  if (!pr) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="שיא אישי חדש"
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { scale: 0.85, opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="pointer-events-auto w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'var(--fs-primary)',
                border: '2px solid var(--fs-accent)',
                boxShadow: '0 8px 24px rgba(11,26,43,0.4)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Mustard ribbon top strip */}
              <div
                style={{
                  background: 'var(--fs-accent)',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.28em',
                    color: 'var(--fs-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  PR · שיא אישי
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 16,
                    color: 'var(--fs-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  §NEW
                </span>
              </div>

              {/* Content */}
              <div className="px-6 pt-6 pb-5">
                {/* Exercise name */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.1 }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      color: 'var(--fs-accent)',
                      textTransform: 'uppercase',
                    }}
                  >
                    תרגיל
                  </span>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 32,
                      color: 'var(--fs-surface)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      marginTop: 4,
                    }}
                  >
                    {pr.exerciseName}
                  </h2>
                </motion.div>

                {/* Big number display */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { delay: 0.15, type: 'spring', stiffness: 200 }
                  }
                  className="mt-5 mb-5"
                >
                  {/* Data strip style */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      border: '2px solid rgba(var(--text-on-navy-rgb),0.15)',
                    }}
                  >
                    <div
                      className="text-center p-4"
                      style={{ borderRight: '2px solid rgba(var(--text-on-navy-rgb),0.15)' }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 900,
                          fontSize: 48,
                          color: 'var(--fs-accent)',
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pr.maxWeight}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.22em',
                          color: 'rgba(var(--text-on-navy-rgb),0.6)',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        ק"ג
                      </div>
                    </div>
                    <div className="text-center p-4">
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 900,
                          fontSize: 48,
                          color: 'var(--fs-surface)',
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pr.maxWeightReps}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.22em',
                          color: 'rgba(var(--text-on-navy-rgb),0.6)',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        חזרות
                      </div>
                    </div>
                  </div>

                  {/* 1RM */}
                  <div
                    className="text-center mt-3"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.15em',
                      color: 'rgba(var(--text-on-navy-rgb),0.6)',
                      textTransform: 'uppercase',
                    }}
                  >
                    1RM משוער: ~{pr.oneRepMax} ק"ג
                  </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.25 }}
                  className="flex flex-col gap-2"
                >
                  <button
                    type="button"
                    onClick={handleShare}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '14px 20px',
                      background: 'var(--fs-accent)',
                      color: 'var(--fs-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 13,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      transition: 'all 150ms',
                      minHeight: 48,
                    }}
                    onPointerDown={(e) => {
                      e.currentTarget.style.background = '#35B392';
                    }}
                    onPointerUp={(e) => {
                      e.currentTarget.style.background = 'var(--fs-accent)';
                    }}
                    onPointerLeave={(e) => {
                      e.currentTarget.style.background = 'var(--fs-accent)';
                    }}
                  >
                    שתף את השיא
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 20px',
                      background: 'transparent',
                      color: 'rgba(var(--text-on-navy-rgb),0.7)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      transition: 'all 150ms',
                    }}
                  >
                    המשך
                  </button>
                </motion.div>
              </div>

              {/* Confetti */}
              {!shouldReduceMotion &&
                CONFETTI_PARTICLES.map((particle) => (
                  <motion.div
                    key={particle.id}
                    initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 0.6],
                      opacity: [1, 1, 0],
                      x: Math.cos(particle.angle) * particle.distance * (isRTL ? -1 : 1),
                      y: Math.sin(particle.angle) * particle.distance + 20,
                      rotate: particle.rotation,
                    }}
                    transition={{
                      duration: 1.2,
                      delay: particle.delay,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      top: '40%',
                      left: '50%',
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color,
                      borderRadius: particle.isCircle ? '50%' : '2px',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(PRCelebration);
