import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
// NumpadOverlay - Fresh Steel / Obsidian numpad for weight/reps
// Dark masthead, surface body, sharp corners, oversized display numerals.
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { LiveRegion } from '../../ui/Accessible';
import { ModalOverlay } from '../../ui/ModalOverlay';

// ============================================================
// TYPES
// ============================================================

interface NumpadOverlayProps {
  isOpen: boolean;
  target: 'weight' | 'reps' | null;
  value: string;
  onInput: (digit: string) => void;
  onSetValue: (value: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  /** Clear the whole value in one tap (calculator "C"). */
  onClear?: () => void;
  /** Submit weight and re-target the numpad to reps without closing. */
  onSubmitAdvance?: () => void;
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
        <m.div
          className="tabular-nums"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(56px, 18vw, 96px)',
            fontWeight: 700,
            lineHeight: 0.85,
            letterSpacing: '-0.03em',
            color: 'var(--fs-heading)',
          }}
          animate={shouldReduceMotion ? {} : { scale: isChanging ? [1, 1.04, 1] : 1 }}
          transition={{ duration: 0.15 }}
        >
          {displayValue.split('').map((char, i) => (
            <m.span
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
            </m.span>
          ))}
        </m.div>

        {/* Unit suffix — mono */}
        <m.span
          className="absolute -end-10 bottom-3 uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {target === 'weight' ? 'ק״ג' : 'x'}
        </m.span>
      </div>
    );
  }
);

AnimatedValue.displayName = 'AnimatedValue';

/** Numpad key — sharp surface square with heading-color text */
const NumpadButton = memo<{
  value: string | number | null;
  onInput: (digit: string) => void;
  onDelete: () => void;
  variant?: 'number' | 'action' | 'delete' | 'submit';
  disabled?: boolean;
  label?: string;
}>(({ value, onInput, onDelete, variant = 'number', disabled = false, label }) => {
  const shouldReduceMotion = useReducedMotion();
  // True once pointerDown has already fired the per-press haptic for this press
  // (touch/pen), so the follow-up click doesn't double-buzz.
  const buzzedOnDownRef = useRef(false);

  const emit = useCallback(() => {
    if (disabled || value === null) return;
    if (value === '⌫') {
      onDelete();
    } else {
      onInput(String(value));
    }
  }, [value, onInput, onDelete, disabled]);

  // Per-digit feedback fires on pointerDown for the snappiest feel, BUT only for
  // touch/pen — a mouse gets neither the tap haptic nor the press-scale (both
  // suppressed when pointerType === 'mouse'). The value emit still happens on
  // click so keyboard/AT activation (detail === 0, no pointer event) works.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || value === null || e.pointerType === 'mouse') return;
      // Single soft tap is owned here. The parent handleInput/handleDelete do NOT
      // also fire a haptic, so each keypress buzzes exactly once.
      triggerHaptic('light');
      buzzedOnDownRef.current = true;
      if (shouldReduceMotion) return;
      e.currentTarget.style.transform = 'scale(0.92)';
    },
    [value, disabled, shouldReduceMotion]
  );

  const releasePress = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
  }, []);

  const handleClick = useCallback(() => {
    if (disabled || value === null) return;
    // Touch/pen already buzzed on pointerDown — consume that flag and skip.
    // Mouse and keyboard/AT (no preceding pointerdown buzz) buzz here instead.
    if (buzzedOnDownRef.current) {
      buzzedOnDownRef.current = false;
    } else {
      triggerHaptic('light');
    }
    emit();
  }, [emit, value, disabled]);

  if (value === null) {
    return <div className="w-20 h-20" />;
  }

  // Fresh Steel / Obsidian — sharp edges, heading-on-surface, accent submit
  const baseStyle: React.CSSProperties = {
    minWidth: 72,
    minHeight: 72,
    width: 72,
    height: 72,
    borderRadius: 12,
    border: '1px solid var(--fs-primary)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: variant === 'number' ? 32 : 20,
    letterSpacing: '-0.01em',
  };

  const variantStyle: Record<string, React.CSSProperties> = {
    number: { backgroundColor: 'var(--fs-surface)', color: 'var(--fs-heading)' },
    action: { backgroundColor: 'var(--fs-surface-2)', color: 'var(--fs-heading)' },
    delete: { backgroundColor: 'var(--fs-surface)', color: 'var(--fs-warn)' },
    submit: { backgroundColor: 'var(--fs-accent)', color: 'var(--color-ink-on-accent)' },
  };

  const getAriaLabel = (): string => {
    if (label) return label;
    if (variant === 'delete') return 'מחק';
    if (variant === 'submit') return 'אישור';
    return String(value);
  };

  const extraClass =
    variant === 'number' || variant === 'action'
      ? ' magnetic-card'
      : variant === 'submit'
        ? ' accent-glow'
        : '';

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={releasePress}
      onPointerLeave={releasePress}
      onPointerCancel={releasePress}
      onClick={handleClick}
      disabled={disabled}
      className={`relative flex items-center justify-center transition-transform duration-100${extraClass}`}
      style={{
        ...baseStyle,
        ...variantStyle[variant],
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      aria-label={getAriaLabel()}
    >
      {value}
    </button>
  );
});

NumpadButton.displayName = 'NumpadButton';

/** Preset chip — surface, accent fill when selected */
const PresetButton = memo<{
  value: number;
  isSelected: boolean;
  onSelect: (value: number) => void;
  isPrevious?: boolean;
}>(({ value, isSelected, onSelect, isPrevious }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <m.button
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.96 }}
      onClick={() => {
        triggerHaptic();
        onSelect(value);
      }}
      className="relative transition-all uppercase"
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: '2px solid var(--fs-primary)',
        backgroundColor: isSelected ? 'var(--fs-accent)' : 'var(--fs-surface)',
        // Selected chip sits on the mint accent fill — use ink-on-accent so it
        // stays legible in dark mode (where --fs-heading is light text).
        color: isSelected ? 'var(--color-ink-on-accent)' : 'var(--fs-heading)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        letterSpacing: '0.04em',
        fontWeight: 600,
      }}
      aria-label={`ערך ${value}`}
    >
      {value}
      {isPrevious && (
        <m.div
          className="absolute -top-1 -end-1"
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'var(--fs-accent)',
            border: '1px solid var(--fs-primary)',
            borderRadius: 12,
          }}
          animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1] }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 1.5, repeat: Number.POSITIVE_INFINITY }
          }
        />
      )}
    </m.button>
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
    <div className="flex items-center gap-2" dir="ltr">
      {/* Decrease buttons */}
      <div className="flex gap-1">
        {increments
          .slice()
          .reverse()
          .map((inc) => (
            <m.button
              key={`dec-${inc}`}
              whileTap={{ scale: shouldReduceMotion ? 1 : 0.92 }}
              onClick={() => {
                triggerHaptic();
                onAdjust(-inc);
              }}
              className="w-11 h-11 flex items-center justify-center transition-all"
              style={{
                backgroundColor: 'var(--fs-surface)',
                border: '2px solid var(--fs-warn)',
                color: 'var(--fs-warn)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: 12,
              }}
              aria-label={`הפחת ${inc}`}
            >
              -{inc}
            </m.button>
          ))}
      </div>

      {/* Current value */}
      <div
        className="px-4 py-2 min-w-[64px] text-center"
        style={{
          backgroundColor: 'var(--fs-surface-2)',
          border: '2px solid var(--fs-primary)',
          borderRadius: 12,
        }}
      >
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--fs-heading)',
          }}
        >
          {currentValue}
        </span>
      </div>

      {/* Increase buttons */}
      <div className="flex gap-1">
        {increments.map((inc) => (
          <m.button
            key={`inc-${inc}`}
            whileTap={{ scale: shouldReduceMotion ? 1 : 0.92 }}
            onClick={() => {
              triggerHaptic();
              onAdjust(inc);
            }}
            className="w-11 h-11 flex items-center justify-center transition-all"
            style={{
              backgroundColor: 'var(--fs-accent)',
              border: '2px solid var(--fs-primary)',
              color: 'var(--color-ink-on-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: 12,
            }}
            aria-label={`הוסף ${inc}`}
          >
            +{inc}
          </m.button>
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
      <m.div
        className="flex items-center gap-2 px-3 py-1.5 uppercase"
        style={{
          backgroundColor: 'var(--fs-surface-2)',
          borderRadius: 12,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.01em',
        }}
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: entryX }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      >
        <span style={{ fontSize: '10px', color: 'var(--fs-muted)', fontWeight: 600 }}>{label}</span>
        <span
          className="tabular-nums"
          style={{ fontSize: '13px', color: 'var(--fs-heading)', fontWeight: 700 }}
        >
          {value}
        </span>
      </m.div>
    );
  }
);

GhostValue.displayName = 'GhostValue';

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * NumpadOverlay - Fresh Steel / Obsidian numpad for precise input
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
    onSetValue,
    onDelete,
    onSubmit,
    onClear,
    onSubmitAdvance,
    onClose,
    previousValue,
    recentValues = [],
    exerciseName,
    lastWorkoutValue,
  }) => {
    const [mode, setMode] = useState<'numpad' | 'stepper'>('numpad');
    const shouldReduceMotion = useReducedMotion();
    // Read document direction reactively rather than during render (SSR-safe, updates if dir flips)
    const [isRTL, setIsRTL] = useState(false);
    useEffect(() => {
      setIsRTL(document.dir === 'rtl');
    }, []);

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
        // Replace value entirely (not append)
        onSetValue(String(preset));
      },
      [onSetValue]
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
        onSetValue(formatted);
      },
      [numericValue, target, onSetValue]
    );

    const handleInput = useCallback(
      (digit: string) => {
        // Haptic is fired once by NumpadButton; firing here too double-buzzed.
        onInput(digit);
      },
      [onInput]
    );

    const handleDelete = useCallback(() => {
      // Haptic is fired once by NumpadButton; firing here too double-buzzed.
      onDelete();
    }, [onDelete]);

    const handleSubmit = useCallback(() => {
      // Confirming a value is a soft commit, not a set completion — keep it a
      // light tick; the heavier 'success' buzz is reserved for COMPLETE_SET.
      triggerHaptic('light');
      onSubmit();
    }, [onSubmit]);

    // Confirm is dead with no value, and for reps also at 0 (0 reps is never a
    // valid set; stepper mode holds value '0' so the empty-check alone misses it).
    // Weight stays submittable at 0 — bodyweight exercises are real.
    const isConfirmDisabled = value === '' || (target === 'reps' && numericValue <= 0);

    const handleClear = useCallback(() => {
      triggerHaptic('light');
      onClear?.();
    }, [onClear]);

    const handleSubmitAdvance = useCallback(() => {
      triggerHaptic('light');
      onSubmitAdvance?.();
    }, [onSubmitAdvance]);

    // The advance flow only makes sense from weight → reps.
    const showAdvance = target === 'weight' && onSubmitAdvance !== undefined;

    // Number pad keys - weight allows decimal, reps doesn't
    const keys: (number | string | null)[][] = useMemo(
      () =>
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
            ],
      [target]
    );

    const label = target === 'weight' ? 'משקל' : 'חזרות';
    const labelEn = target === 'weight' ? 'WEIGHT' : 'REPS';

    // Announce the current value + unit to screen readers on change
    const announcement = useMemo(() => {
      const unit = target === 'weight' ? 'ק״ג' : 'חזרות';
      return `${value || '0'} ${unit}`;
    }, [value, target]);

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        variant="none"
        zLevel="ultra"
        backdropOpacity={50}
        blur="sm"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel={label}
      >
        <m.div
          initial={shouldReduceMotion ? { y: 0 } : { y: '100%' }}
          animate={{ y: 0 }}
          exit={shouldReduceMotion ? { y: 0 } : { y: '100%' }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 350 }
          }
          className="w-full max-w-md mx-auto overflow-hidden fixed bottom-0 left-0 right-0 glass-surface-dark"
          style={{
            backgroundColor: 'var(--fs-bg)',
            borderTop: '2px solid var(--fs-primary)',
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -12px 32px rgba(11,26,43,0.2)',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Navy Masthead — exercise + label */}
          <div className="px-6 py-4" style={{ backgroundColor: 'var(--fs-primary)' }}>
            {exerciseName && (
              <m.div
                className="text-center mb-1 uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '-0.01em',
                  color: 'rgba(255,255,255,0.55)',
                  fontWeight: 600,
                }}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {exerciseName}
              </m.div>
            )}
            <div
              className="text-center uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.28em',
                color: 'var(--fs-accent)',
                fontWeight: 700,
              }}
            >
              {labelEn} · {label}
            </div>
          </div>

          {/* Value Display on bone */}
          <div className="px-6 pt-5 pb-4 text-center relative">
            {/* Clear-all — calculator "C" affordance; beats 5 backspaces on a typo */}
            {onClear && value !== '' && (
              <m.button
                whileTap={{ scale: shouldReduceMotion ? 1 : 0.95 }}
                onClick={handleClear}
                className="absolute top-2 start-6 uppercase"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  color: 'var(--fs-warn)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="נקה את הערך"
              >
                נקה
              </m.button>
            )}
            <div className="flex justify-center mb-3">
              <AnimatedValue value={value} target={target} />
            </div>

            {/* Screen-reader announcement of the current value + unit */}
            <LiveRegion message={announcement} politeness="polite" />

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
            <div className="tab-row">
              <m.button
                onClick={() => setMode('numpad')}
                className={`tab${mode === 'numpad' ? ' active' : ''}`}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                aria-label="מקלדת מספרים"
                aria-pressed={mode === 'numpad'}
              >
                מקלדת
              </m.button>
              <m.button
                onClick={() => setMode('stepper')}
                className={`tab${mode === 'stepper' ? ' active' : ''}`}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                aria-label="כפתורי עלייה וירידה"
                aria-pressed={mode === 'stepper'}
              >
                כפתורי +/-
              </m.button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="px-6 mb-4">
            <div className="flex gap-2 justify-center flex-wrap" dir="ltr">
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
              <m.div
                key="numpad"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: numpadEntryX }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: numpadExitX }}
                className="px-6 pb-4"
              >
                <div className="flex flex-col items-center gap-2" dir="ltr">
                  {keys.map((row, rowIndex) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed numpad layout, static rows, never reordered
                    <div key={rowIndex} className="flex gap-2">
                      {row.map((key, keyIndex) => (
                        <NumpadButton
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed numpad layout, static keys (may include null), never reordered
                          key={`${rowIndex}-${keyIndex}`}
                          value={key}
                          onInput={handleInput}
                          onDelete={handleDelete}
                          variant={key === '⌫' ? 'delete' : 'number'}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </m.div>
            ) : (
              /* Stepper Mode */
              <m.div
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
              </m.div>
            )}
          </AnimatePresence>

          {/* Confirm Button — sticky at bottom so it stays reachable on small screens */}
          <div
            className="px-6 pb-6 pt-3"
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--fs-bg)',
              borderTop: '1px solid var(--fs-surface-2)',
              zIndex: 2,
            }}
          >
            <div className="flex gap-2">
              <m.button
                whileTap={{ scale: shouldReduceMotion ? 1 : 0.98 }}
                onClick={handleSubmit}
                disabled={isConfirmDisabled}
                className={`btn-primary flex-1${isConfirmDisabled ? '' : ' accent-glow'}`}
                style={{
                  opacity: isConfirmDisabled ? 0.4 : 1,
                  cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
                  minHeight: 56,
                }}
                aria-label="אישור ערך"
              >
                אישור
              </m.button>
              {/* Submit-and-advance: write the weight, jump straight to reps on
                  the SAME set — halves the taps on the most-repeated action */}
              {showAdvance && (
                <m.button
                  whileTap={{ scale: shouldReduceMotion ? 1 : 0.98 }}
                  onClick={handleSubmitAdvance}
                  disabled={isConfirmDisabled}
                  style={{
                    minHeight: 56,
                    paddingInline: 24,
                    borderRadius: 12,
                    border: '2px solid var(--fs-primary)',
                    backgroundColor: 'var(--fs-surface-2)',
                    color: 'var(--fs-heading)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 18,
                    opacity: isConfirmDisabled ? 0.4 : 1,
                    cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="אישור ומעבר לחזרות"
                >
                  הבא
                </m.button>
              )}
            </div>
          </div>
        </m.div>
      </ModalOverlay>
    );
  }
);

NumpadOverlay.displayName = 'NumpadOverlay';

export default NumpadOverlay;
