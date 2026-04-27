import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
// NumpadOverlay - Sport Annual numpad for weight/reps
// Editorial sports-yearbook: navy masthead, bone body, sharp corners, display numbers
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { ModalOverlay } from '../../ui/ModalOverlay';

// ============================================================
// TYPES
// ============================================================

interface NumpadOverlayProps {
  isOpen: boolean;
  target: 'weight' | 'reps' | null;
  value: string;
  onInput: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onClose: () => void;
  /** Previous value for this set (ghost value) */
  previousValue?: number;
  /** Recent values used for this exercise */
  recentValues?: number[];
  /** Exercise name for context */
  exerciseName?: string;
  /** Last workout's value for comparison */
  lastWorkoutValue?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const WEIGHT_PRESETS = [20, 40, 60, 80, 100, 120];
const REPS_PRESETS = [6, 8, 10, 12, 15, 20];
const WEIGHT_INCREMENTS = [1.25, 2.5, 5, 10];
const REPS_INCREMENTS = [1, 2, 3, 5];

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Animated display — big navy number on bone */
const AnimatedValue = memo<{ value: string; target: 'weight' | 'reps' | null }>(
  ({ value, target }) => {
    const shouldReduceMotion = useReducedMotion();
    const displayValue = value || '0';
    const prevValueRef = useRef(displayValue);
    const [isChanging, setIsChanging] = useState(false);

    useEffect(() => {
      if (prevValueRef.current !== displayValue) {
        setIsChanging(true);
        prevValueRef.current = displayValue;
        const timer = setTimeout(() => setIsChanging(false), 150);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [displayValue]);

    return (
      <div className="relative overflow-hidden">
        <motion.div
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(56px, 18vw, 96px)',
            fontWeight: 900,
            lineHeight: 0.85,
            letterSpacing: '-0.03em',
            color: 'var(--navy)',
          }}
          animate={shouldReduceMotion ? {} : { scale: isChanging ? [1, 1.04, 1] : 1 }}
          transition={{ duration: 0.15 }}
        >
          {displayValue.split('').map((char, i) => (
            <motion.span
              key={`${i}-${char}`}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              className="inline-block"
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                      delay: i * 0.02,
                    }
              }
            >
              {char}
            </motion.span>
          ))}
        </motion.div>

        {/* Unit suffix — mono */}
        <motion.span
          className="absolute -end-10 bottom-3 uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            letterSpacing: '0.2em',
            color: 'var(--stone)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {target === 'weight' ? 'ק״ג' : 'x'}
        </motion.span>
      </div>
    );
  }
);

AnimatedValue.displayName = 'AnimatedValue';

/** Sport Annual numpad key — sharp bone square with navy text */
const NumpadButton = memo<{
  value: string | number | null;
  onPress: () => void;
  variant?: 'number' | 'action' | 'delete' | 'submit';
  disabled?: boolean;
  label?: string;
}>(({ value, onPress, variant = 'number', disabled = false, label }) => {
  const handleClick = useCallback(() => {
    if (disabled) return;
    triggerHaptic();
    onPress();
  }, [onPress, disabled]);

  if (value === null) {
    return <div className="w-20 h-20" />;
  }

  // Editorial style — sharp edges, navy-on-bone, mustard submit
  const baseStyle: React.CSSProperties = {
    minWidth: 72,
    minHeight: 72,
    width: 72,
    height: 72,
    borderRadius: 0,
    border: '1px solid var(--navy)',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: variant === 'number' ? 32 : 20,
    letterSpacing: '-0.01em',
  };

  const variantStyle: Record<string, React.CSSProperties> = {
    number: { backgroundColor: 'var(--bone)', color: 'var(--navy)' },
    action: { backgroundColor: 'var(--bone-deep)', color: 'var(--navy)' },
    delete: { backgroundColor: 'var(--bone)', color: 'var(--color-error)' },
    submit: { backgroundColor: 'var(--mustard)', color: 'var(--color-on-mustard)' },
  };

  const getAriaLabel = (): string => {
    if (label) return label;
    if (variant === 'delete') return 'מחק';
    if (variant === 'submit') return 'אישור';
    return String(value);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      onPointerDown={(e) => {
        e.preventDefault();
        handleClick();
      }}
      disabled={disabled}
      className="relative flex items-center justify-center transition-all duration-150"
      style={{
        ...baseStyle,
        ...variantStyle[variant],
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      aria-label={getAriaLabel()}
    >
      {value}
    </motion.button>
  );
});

NumpadButton.displayName = 'NumpadButton';

/** Preset chip — bone/navy, mustard when selected */
const PresetButton = memo<{
  value: number;
  isSelected: boolean;
  onSelect: (value: number) => void;
  isPrevious?: boolean;
}>(({ value, isSelected, onSelect, isPrevious }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.button
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.96 }}
      onClick={() => {
        triggerHaptic();
        onSelect(value);
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        triggerHaptic();
        onSelect(value);
      }}
      className="relative transition-all uppercase"
      style={{
        padding: '8px 14px',
        borderRadius: 0,
        border: '2px solid var(--navy)',
        backgroundColor: isSelected ? 'var(--mustard)' : 'var(--bone)',
        color: 'var(--navy)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        letterSpacing: '0.04em',
        fontWeight: 600,
      }}
      aria-label={`ערך ${value}`}
    >
      {value}
      {isPrevious && (
        <motion.div
          className="absolute -top-1 -end-1"
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'var(--mustard)',
            border: '1px solid var(--navy)',
            borderRadius: 0,
          }}
          animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1] }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 1.5, repeat: Number.POSITIVE_INFINITY }
          }
        />
      )}
    </motion.button>
  );
});

PresetButton.displayName = 'PresetButton';

/** Increment/Decrement stepper — editorial editorial palette */
const ValueStepper = memo<{
  currentValue: number;
  increments: number[];
  onAdjust: (delta: number) => void;
}>(({ currentValue, increments, onAdjust }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-2">
      {/* Decrease buttons */}
      <div className="flex gap-1">
        {increments
          .slice()
          .reverse()
          .map((inc) => (
            <motion.button
              key={`dec-${inc}`}
              whileTap={{ scale: shouldReduceMotion ? 1 : 0.92 }}
              onClick={() => {
                triggerHaptic();
                onAdjust(-inc);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                triggerHaptic();
                onAdjust(-inc);
              }}
              className="w-11 h-11 flex items-center justify-center transition-all"
              style={{
                backgroundColor: 'var(--bone)',
                border: '2px solid var(--color-error)',
                color: 'var(--color-error)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: 0,
              }}
              aria-label={`הפחת ${inc}`}
            >
              -{inc}
            </motion.button>
          ))}
      </div>

      {/* Current value */}
      <div
        className="px-4 py-2 min-w-[64px] text-center"
        style={{
          backgroundColor: 'var(--bone-deep)',
          border: '2px solid var(--navy)',
          borderRadius: 0,
        }}
      >
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 800,
            color: 'var(--navy)',
          }}
        >
          {currentValue}
        </span>
      </div>

      {/* Increase buttons */}
      <div className="flex gap-1">
        {increments.map((inc) => (
          <motion.button
            key={`inc-${inc}`}
            whileTap={{ scale: shouldReduceMotion ? 1 : 0.92 }}
            onClick={() => {
              triggerHaptic();
              onAdjust(inc);
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              triggerHaptic();
              onAdjust(inc);
            }}
            className="w-11 h-11 flex items-center justify-center transition-all"
            style={{
              backgroundColor: 'var(--mustard)',
              border: '2px solid var(--navy)',
              color: 'var(--navy)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: 0,
            }}
            aria-label={`הוסף ${inc}`}
          >
            +{inc}
          </motion.button>
        ))}
      </div>
    </div>
  );
});

ValueStepper.displayName = 'ValueStepper';

/** Previous value ghost indicator — mono editorial chip */
const GhostValue = memo<{ value: number; label: string; entryX?: number }>(
  ({ value, label, entryX = -10 }) => {
    const shouldReduceMotion = useReducedMotion();
    return (
      <motion.div
        className="flex items-center gap-2 px-3 py-1.5 uppercase"
        style={{
          backgroundColor: 'var(--bone-deep)',
          borderRadius: 0,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
        }}
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: entryX }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      >
        <span style={{ fontSize: '10px', color: 'var(--stone)', fontWeight: 600 }}>{label}</span>
        <span
          className="tabular-nums"
          style={{ fontSize: '13px', color: 'var(--navy)', fontWeight: 700 }}
        >
          {value}
        </span>
      </motion.div>
    );
  }
);

GhostValue.displayName = 'GhostValue';

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * NumpadOverlay - Sport Annual numpad for precise input
 *
 * Features:
 * - Smart presets based on exercise history
 * - Increment/decrement steppers
 * - Previous value ghost indicator
 * - Animated digit display
 * - Haptic feedback on every interaction
 * - Spring-based animations
 * - Portal rendering for proper z-index stacking
 * - Focus trap and scroll lock
 */
const NumpadOverlay = memo<NumpadOverlayProps>(
  ({
    isOpen,
    target,
    value,
    onInput,
    onDelete,
    onSubmit,
    onClose,
    previousValue,
    recentValues = [],
    exerciseName,
    lastWorkoutValue,
  }) => {
    const [mode, setMode] = useState<'numpad' | 'stepper'>('numpad');
    const shouldReduceMotion = useReducedMotion();
    const isRTL = document.dir === 'rtl';

    // RTL-aware animation values
    const numpadEntryX = shouldReduceMotion ? 0 : isRTL ? 20 : -20;
    const numpadExitX = shouldReduceMotion ? 0 : isRTL ? -20 : 20;
    const stepperEntryX = shouldReduceMotion ? 0 : isRTL ? -20 : 20;
    const stepperExitX = shouldReduceMotion ? 0 : isRTL ? 20 : -20;
    const ghostEntryX = shouldReduceMotion ? 0 : isRTL ? 10 : -10;

    // Calculate numeric value for stepper
    const numericValue = useMemo(() => Number.parseFloat(value) || 0, [value]);

    // Smart presets - combine defaults with recent values
    const presets = useMemo(() => {
      const defaults = target === 'weight' ? WEIGHT_PRESETS : REPS_PRESETS;
      const unique = [...new Set([...recentValues, ...defaults])].sort((a, b) => a - b);
      return unique.slice(0, 6);
    }, [target, recentValues]);

    const increments = target === 'weight' ? WEIGHT_INCREMENTS : REPS_INCREMENTS;

    // Handle preset selection
    const handlePresetSelect = useCallback(
      (preset: number) => {
        // Clear and set new value
        onInput(String(preset));
      },
      [onInput]
    );

    // Handle stepper adjustment
    const handleAdjust = useCallback(
      (delta: number) => {
        const newValue = Math.max(0, numericValue + delta);
        // Format appropriately
        const formatted =
          target === 'weight'
            ? newValue.toFixed(newValue % 1 === 0 ? 0 : 2)
            : String(Math.round(newValue));
        onInput(formatted);
      },
      [numericValue, target, onInput]
    );

    const handleInput = useCallback(
      (digit: string) => {
        triggerHaptic();
        onInput(digit);
      },
      [onInput]
    );

    const handleDelete = useCallback(() => {
      triggerHaptic('light');
      onDelete();
    }, [onDelete]);

    const handleSubmit = useCallback(() => {
      triggerHaptic('success');
      onSubmit();
    }, [onSubmit]);

    // Number pad keys - weight allows decimal, reps doesn't
    const keys: (number | string | null)[][] =
      target === 'weight'
        ? [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
            ['.', 0, '⌫'],
          ]
        : [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
            [null, 0, '⌫'],
          ];

    const label = target === 'weight' ? 'משקל' : 'חזרות';
    const labelEn = target === 'weight' ? 'WEIGHT' : 'REPS';

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        variant="none"
        zLevel="ultra"
        backdropOpacity={80}
        blur="sm"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel={label}
      >
        <motion.div
          initial={shouldReduceMotion ? { y: 0 } : { y: '100%' }}
          animate={{ y: 0 }}
          exit={shouldReduceMotion ? { y: 0 } : { y: '100%' }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 350 }
          }
          className="w-full max-w-md mx-auto pb-safe-bottom overflow-hidden fixed bottom-0 left-0 right-0"
          style={{
            backgroundColor: 'var(--bone)',
            borderTop: '2px solid var(--navy)',
            borderRadius: 0,
            boxShadow: '0 -12px 32px rgba(11,26,43,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Navy Masthead — exercise + label */}
          <div className="px-6 py-4" style={{ backgroundColor: 'var(--navy)' }}>
            {exerciseName && (
              <motion.div
                className="text-center mb-1 uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  color: 'rgba(var(--text-on-navy-rgb),0.55)',
                  fontWeight: 600,
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {exerciseName}
              </motion.div>
            )}
            <div
              className="text-center uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.28em',
                color: 'var(--mustard)',
                fontWeight: 700,
              }}
            >
              {labelEn} · {label}
            </div>
          </div>

          {/* Value Display on bone */}
          <div className="px-6 pt-5 pb-4 text-center">
            <div className="flex justify-center mb-3">
              <AnimatedValue value={value} target={target} />
            </div>

            {/* Ghost values row */}
            <div className="flex justify-center gap-2 flex-wrap">
              {previousValue !== undefined && (
                <GhostValue value={previousValue} label="קודם" entryX={ghostEntryX} />
              )}
              {lastWorkoutValue !== undefined && (
                <GhostValue value={lastWorkoutValue} label="אימון קודם" entryX={ghostEntryX} />
              )}
            </div>
          </div>

          {/* Mode Toggle — sharp tabs */}
          <div className="flex justify-center mb-4 px-6">
            <div className="flex" style={{ border: '2px solid var(--navy)', borderRadius: 0 }}>
              <motion.button
                onClick={() => setMode('numpad')}
                className="px-4 py-2 uppercase transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                  backgroundColor: mode === 'numpad' ? 'var(--navy)' : 'var(--bone)',
                  color: mode === 'numpad' ? 'var(--mustard)' : 'var(--navy)',
                  borderRadius: 0,
                }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                aria-label="מקלדת מספרים"
              >
                מקלדת
              </motion.button>
              <motion.button
                onClick={() => setMode('stepper')}
                className="px-4 py-2 uppercase transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                  backgroundColor: mode === 'stepper' ? 'var(--navy)' : 'var(--bone)',
                  color: mode === 'stepper' ? 'var(--mustard)' : 'var(--navy)',
                  borderRadius: 0,
                  borderInlineEnd: '2px solid var(--navy)',
                }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                aria-label="כפתורי עלייה וירידה"
              >
                כפתורי +/-
              </motion.button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="px-6 mb-4">
            <div className="flex gap-2 justify-center flex-wrap">
              {presets.map((preset) => (
                <PresetButton
                  key={preset}
                  value={preset}
                  isSelected={numericValue === preset}
                  onSelect={handlePresetSelect}
                  isPrevious={preset === previousValue}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="sync">
            {mode === 'numpad' ? (
              /* Number Grid */
              <motion.div
                key="numpad"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: numpadEntryX }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: numpadExitX }}
                className="px-6 pb-4"
              >
                <div className="flex flex-col items-center gap-2">
                  {keys.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-2">
                      {row.map((key, keyIndex) => (
                        <NumpadButton
                          key={`${rowIndex}-${keyIndex}`}
                          value={key}
                          onPress={() => {
                            if (key === '⌫') {
                              handleDelete();
                            } else if (key !== null) {
                              handleInput(String(key));
                            }
                          }}
                          variant={key === '⌫' ? 'delete' : 'number'}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* Stepper Mode */
              <motion.div
                key="stepper"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: stepperEntryX }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: stepperExitX }}
                className="px-6 pb-4 flex justify-center"
              >
                <ValueStepper
                  currentValue={numericValue}
                  increments={increments}
                  onAdjust={handleAdjust}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm Button — sticky at bottom so it stays reachable on small screens */}
          <div
            className="px-6 pb-6 pt-3"
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--bone)',
              borderTop: '1px solid var(--bone-deep)',
              zIndex: 2,
            }}
          >
            <motion.button
              whileTap={{ scale: shouldReduceMotion ? 1 : 0.98 }}
              onClick={handleSubmit}
              onPointerDown={(e) => {
                if (value !== '') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={value === ''}
              className="btn-primary w-full"
              style={{
                opacity: value === '' ? 0.4 : 1,
                cursor: value === '' ? 'not-allowed' : 'pointer',
                minHeight: 48,
              }}
              aria-label="אישור ערך"
            >
              אישור
            </motion.button>
          </div>
        </motion.div>

        <style>{`
                .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 24px); }
            `}</style>
      </ModalOverlay>
    );
  }
);

NumpadOverlay.displayName = 'NumpadOverlay';

export default NumpadOverlay;
