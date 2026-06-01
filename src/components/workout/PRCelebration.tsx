// PRCelebration - Sport Annual Editorial Design
// Navy masthead · Bone body · Mustard accents · Sharp corners
// Celebrates new personal records with editorial style

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, { useCallback, useRef } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useReducedMotion as useAppReducedMotion } from '../../hooks/useReducedMotion';
import { DUR, gsap, useGSAP } from '../../lib/gsap';
import { fireSparks } from '../../lib/gsapSparks';
import { type PersonalRecord, calculateEst1RM } from '../../services/prService';
import { showToast } from '../ui/GlobalToast';

interface PRCelebrationProps {
  isVisible: boolean;
  pr: PersonalRecord | null;
  onDismiss: () => void;
}

// Editorial confetti palette — reused for the GSAP upward spark fan.
const CONFETTI_COLORS = ['#E8B82D', '#F5F1EB', '#1A1A1A', '#7E7D78', '#EAE4DA', '#0A0A0A'];

const PRCelebration: React.FC<PRCelebrationProps> = ({ isVisible, pr, onDismiss }) => {
  const shouldReduceMotion = useReducedMotion();
  // App hook (boolean, never null) for the GSAP spark guard, matching what
  // useCountUp uses internally — keeps the numbers and the sparks in agreement.
  const gsapReduced = useAppReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const weightRef = useRef<HTMLSpanElement>(null);
  const oneRepMaxRef = useRef<HTMLSpanElement>(null);

  useFocusTrap(contentRef, {
    isOpen: isVisible,
    onClose: onDismiss,
    closeOnEscape: true,
    lockScroll: true,
  });

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

  // Final values the numbers climb TO. maxWeight/oneRepMax are optional on the
  // type, so fall back to the raw set values / a computed 1RM.
  const maxWeightValue = pr?.maxWeight ?? pr?.weight ?? 0;
  const oneRepMaxValue = pr?.oneRepMax ?? (pr ? calculateEst1RM(pr.weight, pr.reps) : 0);

  // Climb FROM the previous record. The type has no previous* fields, so start
  // at ~95% of the new value — the digits visibly tick past the old PR rather
  // than rolling up from zero (which would look wrong for heavy lifts).
  const countEnabled = isVisible && !!pr;
  useCountUp(weightRef, maxWeightValue, {
    from: Math.round(maxWeightValue * 0.95),
    delay: 0.2,
    enabled: countEnabled,
    pop: true,
  });
  useCountUp(oneRepMaxRef, oneRepMaxValue, {
    from: Math.round(oneRepMaxValue * 0.95),
    delay: 0.2,
    enabled: countEnabled,
  });

  // Fire the upward spark fan exactly as the numbers land (start delay + count
  // duration). Centered on 270 (straight up) so it's mirror-symmetric — RTL-safe
  // with no flip. The fan lives OUTSIDE the overflow:hidden card so sparks can
  // travel past its edges.
  useGSAP(
    () => {
      if (gsapReduced || !countEnabled) return;
      const landAt = 0.2 + DUR.count;
      const call = gsap.delayedCall(landAt, () => {
        fireSparks(burstRef.current, {
          count: 28,
          colors: CONFETTI_COLORS,
          angleMin: 240,
          angleMax: 300,
          gravity: 900,
          minVelocity: 420,
          maxVelocity: 820,
        });
      });
      return () => call.kill();
    },
    { scope: contentRef, dependencies: [countEnabled, gsapReduced, pr?.id] }
  );

  if (!pr) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-overlay flex items-center justify-center"
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
            className="w-full max-w-sm mx-4"
            style={{ position: 'relative' }}
            ref={contentRef}
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
                    color: 'var(--fs-heading)',
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
                    color: 'var(--fs-heading)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  שיא חדש!
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
                      color: 'var(--fs-ink)',
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
                        <span ref={weightRef}>{maxWeightValue}</span>
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
                          color: 'var(--fs-ink)',
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
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    1RM משוער: ~<span ref={oneRepMaxRef}>{oneRepMaxValue}</span> ק"ג
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
                      color: 'var(--fs-heading)',
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
            </div>

            {/* Spark fan — lives OUTSIDE the overflow:hidden card so the
                upward burst can travel past the card edges. Fired by fireSparks
                in the useGSAP hook above, centered on 270 (straight up) so it's
                mirror-symmetric and RTL-safe. */}
            <div
              ref={burstRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(PRCelebration);
