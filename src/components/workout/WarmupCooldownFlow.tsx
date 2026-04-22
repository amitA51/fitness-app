// WarmupCooldownFlow - Sport Annual Editorial Design
// Navy masthead + bone body · Sharp corners · Big Shoulders typography
// Warmup: dynamic movement warmup routine
// Cooldown: guided stretching routine

import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { safeJsonParseOr } from '../../utils/safeJson';

interface WarmupCooldownFlowProps {
  type: 'warmup' | 'cooldown';
  onComplete: () => void;
  onSkip: () => void;
}

interface RoutineItem {
  id: string;
  name: string;
  nameHe: string;
  duration: number;
  selected: boolean;
}

const WARMUP_STORAGE_KEY = 'warmup_routine_selections';
const COOLDOWN_STORAGE_KEY = 'cooldown_routine_selections';

const DEFAULT_WARMUP: RoutineItem[] = [
  { id: 'w1', name: 'Jumping Jacks', nameHe: 'קפיצות ג׳ק', duration: 60, selected: true },
  { id: 'w2', name: 'Arm Circles', nameHe: 'סיבובי ידיים', duration: 30, selected: true },
  { id: 'w3', name: 'Torso Twists', nameHe: 'סיבובי גו', duration: 30, selected: true },
  { id: 'w4', name: 'Leg Swings', nameHe: 'תנופות רגליים', duration: 45, selected: true },
  { id: 'w5', name: 'High Knees', nameHe: 'ברכיים גבוהות', duration: 45, selected: false },
  { id: 'w6', name: 'Dynamic Squats', nameHe: 'סקוואטים דינמיים', duration: 45, selected: false },
  { id: 'w7', name: 'Lunges', nameHe: 'לאנג׳ים', duration: 45, selected: false },
  { id: 'w8', name: 'Shoulder Rolls', nameHe: 'גלילות כתפיים', duration: 30, selected: false },
];

const DEFAULT_COOLDOWN: RoutineItem[] = [
  { id: 'c1', name: 'Static Stretching', nameHe: 'מתיחות סטטיות', duration: 60, selected: true },
  { id: 'c2', name: 'Deep Breathing', nameHe: 'נשימות עמוקות', duration: 60, selected: true },
  { id: 'c3', name: "Child's Pose", nameHe: 'תנוחת הילד', duration: 45, selected: true },
  { id: 'c4', name: 'Hamstring Stretch', nameHe: 'מתיחת ירכיים אחוריות', duration: 45, selected: false },
  { id: 'c5', name: 'Quad Stretch', nameHe: 'מתיחת ירך קדמית', duration: 45, selected: false },
  { id: 'c6', name: 'Shoulder Stretch', nameHe: 'מתיחת כתפיים', duration: 30, selected: false },
];

// ============================================================
// STATE MANAGEMENT
// ============================================================

type State = {
  step: 'selection' | 'active';
  items: RoutineItem[];
  currentIndex: number;
  timeLeft: number;
  isPaused: boolean;
  endTimestamp: number;
  pausedRemaining: number;
};

type Action =
  | { type: 'SET_ITEMS'; payload: RoutineItem[] }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'START_ROUTINE' }
  | { type: 'NEXT_EXERCISE'; onComplete: () => void }
  | { type: 'PREV_EXERCISE' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'TICK' };

const reducer = (state: State, action: Action): State => {
  const activeItems = state.items.filter((i) => i.selected);

  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload };

    case 'TOGGLE_SELECTION':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, selected: !item.selected } : item
        ),
      };

    case 'START_ROUTINE': {
      if (activeItems.length === 0) return state;
      const firstItem = activeItems[0];
      if (!firstItem) return state;
      return {
        ...state,
        step: 'active',
        currentIndex: 0,
        timeLeft: firstItem.duration,
        isPaused: false,
        endTimestamp: Date.now() + firstItem.duration * 1000,
        pausedRemaining: 0,
      };
    }

    case 'NEXT_EXERCISE': {
      if (state.currentIndex < activeItems.length - 1) {
        const nextIndex = state.currentIndex + 1;
        const nextItem = activeItems[nextIndex];
        if (!nextItem) return state;
        return {
          ...state,
          currentIndex: nextIndex,
          timeLeft: nextItem.duration,
          isPaused: false,
          endTimestamp: Date.now() + nextItem.duration * 1000,
          pausedRemaining: 0,
        };
      } else {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        action.onComplete();
        return state;
      }
    }

    case 'PREV_EXERCISE': {
      if (state.currentIndex > 0) {
        const prevIndex = state.currentIndex - 1;
        const prevItem = activeItems[prevIndex];
        if (!prevItem) return state;
        return {
          ...state,
          currentIndex: prevIndex,
          timeLeft: prevItem.duration,
          isPaused: false,
          endTimestamp: Date.now() + prevItem.duration * 1000,
          pausedRemaining: 0,
        };
      }
      return state;
    }

    case 'TOGGLE_PAUSE': {
      if (state.isPaused) {
        return {
          ...state,
          isPaused: false,
          endTimestamp: Date.now() + state.pausedRemaining * 1000,
        };
      } else {
        const remaining = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
        return {
          ...state,
          isPaused: true,
          pausedRemaining: remaining,
          timeLeft: remaining,
        };
      }
    }

    case 'TICK': {
      const tickRemaining = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
      return { ...state, timeLeft: tickRemaining };
    }

    default:
      return state;
  }
};

// ============================================================
// HELPERS
// ============================================================

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ============================================================
// SELECTION STEP
// ============================================================

interface SelectionStepProps {
  type: 'warmup' | 'cooldown';
  items: RoutineItem[];
  activeItems: RoutineItem[];
  totalDuration: number;
  onToggle: (id: string) => void;
  onStart: () => void;
  onSkip: () => void;
}

const SelectionStep: React.FC<SelectionStepProps> = ({
  type,
  items,
  activeItems,
  totalDuration,
  onToggle,
  onStart,
  onSkip,
}) => {
  const title = type === 'warmup' ? 'חימום' : 'צינון';
  const subtitle = type === 'warmup' ? 'בחר תרגילי חימום' : 'בחר מתיחות לצינון';

  return (
    <motion.div
      key="selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Masthead */}
      <div style={{ background: 'var(--navy)', flexShrink: 0 }}>
        {/* Chapter strip */}
        <div
          className="chapter-break"
          style={{ borderBottom: '1px solid rgba(var(--text-on-navy-rgb),0.1)' }}
        >
          <span className="left" style={{ color: 'var(--mustard)' }}>
            §01 · {title}
          </span>
          <span className="right">{activeItems.length} תרגילים</span>
        </div>

        {/* Title area */}
        <div className="px-5 pt-5 pb-6">
          <h2
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 36,
              color: 'var(--bone)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              direction: 'ltr',
              textAlign: 'left',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'rgba(var(--text-on-navy-rgb),0.45)',
              textTransform: 'uppercase',
              marginTop: 8,
            }}
          >
            {subtitle}
          </p>

          {/* Total duration badge */}
          <div
            className="mt-3"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(var(--text-on-navy-rgb),0.08)',
              padding: '6px 12px',
              border: '1px solid rgba(var(--text-on-navy-rgb),0.15)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.15em',
                color: 'var(--mustard)',
                textTransform: 'uppercase',
              }}
            >
              {formatTime(totalDuration)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'rgba(var(--text-on-navy-rgb),0.4)',
                textTransform: 'uppercase',
              }}
            >
              סה״כ
            </span>
          </div>
        </div>
      </div>

      {/* Bone body */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
        style={{ background: 'var(--bone)' }}
      >
        <div className="flex flex-col gap-2 pb-4">
          {items.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => onToggle(item.id)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px',
                background: item.selected ? 'var(--bone-deep)' : 'var(--bone)',
                border: `2px solid ${item.selected ? 'var(--navy)' : 'var(--bone-deep)'}`,
                cursor: 'pointer',
                transition: 'all 150ms',
                minHeight: 56,
              }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 0,
                    border: `2px solid ${item.selected ? 'var(--navy)' : 'var(--stone)'}`,
                    background: item.selected ? 'var(--mustard)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.selected && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="var(--navy)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 15,
                    color: item.selected ? 'var(--navy)' : 'var(--stone)',
                    letterSpacing: '-0.01em',
                    textAlign: 'right',
                  }}
                >
                  {item.nameHe}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  color: item.selected ? 'var(--navy)' : 'var(--stone)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {formatTime(item.duration)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex flex-col gap-2 px-5 py-4"
        style={{ background: 'var(--bone)', borderTop: '1px solid var(--bone-deep)' }}
      >
        <button
          type="button"
          onClick={onStart}
          disabled={activeItems.length === 0}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px 24px',
            background: 'var(--navy)',
            color: 'var(--mustard)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: activeItems.length === 0 ? 0.5 : 1,
            transition: 'all 150ms',
            minHeight: 52,
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.background = 'var(--navy-deep)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.background = 'var(--navy)';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.background = 'var(--navy)';
          }}
        >
          התחל {title} ({activeItems.length})
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 24px',
            background: 'transparent',
            color: 'var(--stone)',
            border: '2px solid var(--stone)',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transition: 'all 150ms',
            minHeight: 48,
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.color = 'var(--navy)';
            e.currentTarget.style.borderColor = 'var(--navy)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.color = 'var(--stone)';
            e.currentTarget.style.borderColor = 'var(--stone)';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.color = 'var(--stone)';
            e.currentTarget.style.borderColor = 'var(--stone)';
          }}
        >
          דלג על {title}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================
// ACTIVE STEP
// ============================================================

interface ActiveStepProps {
  type: 'warmup' | 'cooldown';
  currentItem: RoutineItem | undefined;
  currentIndex: number;
  totalItems: number;
  timeLeft: number;
  isPaused: boolean;
  progress: number;
  isWarning: boolean;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipAll: () => void;
  isLast: boolean;
}

const ActiveStep: React.FC<ActiveStepProps> = ({
  type,
  currentItem,
  currentIndex,
  totalItems,
  timeLeft,
  isPaused,
  progress,
  isWarning,
  onTogglePause,
  onPrev,
  onNext,
  onSkipAll,
  isLast,
}) => {
  const title = type === 'warmup' ? 'חימום' : 'צינון';

  const timerColor = isWarning ? 'var(--color-error)' : 'var(--mustard)';

  return (
    <motion.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col"
      style={{ height: '100%', background: 'var(--bone)' }}
    >
      {/* Navy header strip */}
      <div
        style={{
          background: 'var(--navy)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--mustard)',
            textTransform: 'uppercase',
          }}
        >
          {currentIndex + 1} / {totalItems}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.06em',
            color: 'rgba(var(--text-on-navy-rgb),0.5)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={onSkipAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(var(--text-on-navy-rgb),0.4)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: 0,
          }}
        >
          דלג על הכל
        </button>
      </div>

      {/* Exercise name */}
      <div
        className="text-center"
        style={{
          padding: '24px 20px 0',
          background: 'var(--bone)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            color: 'var(--stone)',
            textTransform: 'uppercase',
          }}
        >
          {type === 'warmup' ? 'תרגיל' : 'מתיחה'}
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 28,
            color: 'var(--navy)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            marginTop: 6,
            direction: 'rtl',
          }}
        >
          {currentItem?.nameHe}
        </h2>
      </div>

      {/* Timer — massive editorial number */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--bone)', minHeight: 0 }}
        onClick={onTogglePause}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(240px, 60vw)',
            height: 'min(240px, 60vw)',
          }}
        >
          {/* SVG progress ring */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            viewBox="0 0 240 240"
          >
            {/* Track */}
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke="var(--bone-deep)"
              strokeWidth="6"
              fill="none"
            />
            {/* Progress */}
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke={timerColor}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 108}
              strokeDashoffset={2 * Math.PI * 108 * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
            />
          </svg>

          {/* Time + label */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.span
              key={timeLeft}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(48px, 14vw, 72px)',
                color: isWarning ? 'var(--color-error)' : 'var(--navy)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTime(timeLeft)}
            </motion.span>
            {isPaused && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.2em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                מושהה
              </span>
            )}
            {timeLeft === 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.2em',
                  color: 'var(--color-success)',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                הושלם!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          padding: '0 20px 24px',
          background: 'var(--bone)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'var(--stone)',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          לחץ על השעון להשהייה / המשך
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex === 0}
            style={{
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bone-deep)',
              color: currentIndex === 0 ? 'var(--stone-light)' : 'var(--navy)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 18,
              opacity: currentIndex === 0 ? 0.5 : 1,
              transition: 'all 150ms',
            }}
            aria-label="תרגיל קודם"
          >
            ←
          </button>

          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              background: 'var(--navy)',
              color: 'var(--mustard)',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'background 150ms',
              minHeight: 52,
            }}
            onPointerDown={(e) => {
              e.currentTarget.style.background = 'var(--navy-deep)';
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.background = 'var(--navy)';
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.background = 'var(--navy)';
            }}
          >
            {isLast ? 'סיום' : 'הבא →'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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

  useEffect(() => {
    if (!state.isPaused && state.step === 'active' && state.timeLeft > 0) {
      timerRef.current = setTimeout(() => dispatch({ type: 'TICK' }), 1000);
    } else if (state.timeLeft === 0 && state.step === 'active' && !state.isPaused) {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.isPaused, state.step, state.timeLeft]);

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
    dispatch({ type: 'NEXT_EXERCISE', onComplete });
  }, [onComplete]);

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
    <motion.div
      className="fixed inset-0 z-[11000] flex flex-col"
      style={{ background: 'var(--bone)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Safe area top */}
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0)', background: 'var(--navy)', flexShrink: 0 }} />

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
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', background: 'var(--bone)', flexShrink: 0 }} />
    </motion.div>
  );
};

export default React.memo(WarmupCooldownFlow);
