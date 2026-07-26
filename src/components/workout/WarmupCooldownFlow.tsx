// WarmupCooldownFlow - Fresh Steel / Obsidian
// Dark masthead + surface body · sharp corners · Bricolage display
// Warmup: dynamic movement warmup routine
// Cooldown: guided stretching routine

import { AnimatePresence, m } from 'framer-motion';
import React, { useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { logger } from '../../utils/logger';
import { safeJsonParseOr } from '../../utils/safeJson';
import ActiveStep from './WarmupCooldownActiveStep';
import SelectionStep from './WarmupCooldownSelectionStep';
import {
  COOLDOWN_STORAGE_KEY,
  DEFAULT_COOLDOWN,
  DEFAULT_WARMUP,
  WARMUP_STORAGE_KEY,
  reducer,
} from './warmupCooldownData';

interface WarmupCooldownFlowProps {
  type: 'warmup' | 'cooldown';
  onComplete: () => void;
  onSkip: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const WarmupCooldownFlow: React.FC<WarmupCooldownFlowProps> = ({ type, onComplete, onSkip }) => {
  const [state, dispatch] = useReducer(reducer, {
    step: 'selection',
    items: [],
    currentIndex: 0,
    timeLeft: 0,
    isPaused: false,
    endTimestamp: 0,
    pausedRemaining: 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  useFocusTrap(flowRef, { isOpen: true, onClose: onSkip, closeOnEscape: true, lockScroll: true });

  const storageKey = type === 'warmup' ? WARMUP_STORAGE_KEY : COOLDOWN_STORAGE_KEY;
  const defaultItems = type === 'warmup' ? DEFAULT_WARMUP : DEFAULT_COOLDOWN;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const selections = safeJsonParseOr<Record<string, boolean>>(saved, {});
        const merged = defaultItems.map((item) => ({
          ...item,
          selected: selections[item.id] ?? item.selected,
        }));
        dispatch({ type: 'SET_ITEMS', payload: merged });
      } else {
        dispatch({ type: 'SET_ITEMS', payload: defaultItems });
      }
    } catch {
      dispatch({ type: 'SET_ITEMS', payload: defaultItems });
    }
  }, [storageKey, defaultItems]);

  useEffect(() => {
    if (state.items.length === 0) return;
    const selections: Record<string, boolean> = {};
    state.items.forEach((item) => {
      selections[item.id] = item.selected;
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(selections));
    } catch (e) {
      logger.workout.error('Failed to save routine selections', e);
    }
  }, [state.items, storageKey]);

  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!state.isPaused && state.step === 'active' && state.timeLeft > 0) {
      timerRef.current = setTimeout(() => dispatch({ type: 'TICK' }), 1000);
    } else if (state.timeLeft === 0 && state.step === 'active' && !state.isPaused) {
      if ('vibrate' in navigator && !shouldReduceMotion) navigator.vibrate([100, 50, 100]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.isPaused, state.step, state.timeLeft, shouldReduceMotion]);

  const activeItems = useMemo(() => state.items.filter((i) => i.selected), [state.items]);
  const currentItem = activeItems[state.currentIndex];
  const totalDuration = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.duration, 0),
    [activeItems]
  );

  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', id });
  }, []);

  const startRoutine = useCallback(() => {
    if (activeItems.length === 0) {
      onSkip();
      return;
    }
    dispatch({ type: 'START_ROUTINE' });
  }, [activeItems.length, onSkip]);

  const nextExercise = useCallback(() => {
    dispatch({ type: 'NEXT_EXERCISE' });
  }, []);

  // Handle routine completion as a side effect (not inside reducer)
  useEffect(() => {
    if (state.step === 'selection' && state.currentIndex === -1) {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      onComplete();
    }
  }, [state.step, state.currentIndex, onComplete]);

  const prevExercise = useCallback(() => {
    dispatch({ type: 'PREV_EXERCISE' });
  }, []);

  const togglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);

  const progress = currentItem
    ? ((currentItem.duration - state.timeLeft) / currentItem.duration) * 100
    : 0;

  const isWarning = state.timeLeft <= 3 && state.timeLeft > 0;

  return (
    <m.div
      ref={flowRef}
      className="fixed inset-0 z-modal flex flex-col"
      style={{ background: 'var(--fs-surface)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={type === 'warmup' ? 'חימום' : 'צינון'}
    >
      {/* Safe area top */}
      <div
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          background: 'var(--fs-primary)',
          flexShrink: 0,
        }}
      />

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="sync">
          {state.step === 'selection' ? (
            <SelectionStep
              type={type}
              items={state.items}
              activeItems={activeItems}
              totalDuration={totalDuration}
              onToggle={toggleSelection}
              onStart={startRoutine}
              onSkip={onSkip}
            />
          ) : (
            <ActiveStep
              type={type}
              currentItem={currentItem}
              currentIndex={state.currentIndex}
              totalItems={activeItems.length}
              timeLeft={state.timeLeft}
              isPaused={state.isPaused}
              progress={progress}
              isWarning={isWarning}
              onTogglePause={togglePause}
              onPrev={prevExercise}
              onNext={nextExercise}
              onSkipAll={onSkip}
              isLast={state.currentIndex === activeItems.length - 1}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Safe area bottom */}
      <div
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          background: 'var(--fs-surface)',
          flexShrink: 0,
        }}
      />
    </m.div>
  );
};

export default React.memo(WarmupCooldownFlow);
