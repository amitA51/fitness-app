import React, { useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WarmupCooldownFlowProps {
  type: 'warmup' | 'cooldown';
  onComplete: () => void;
  onSkip: () => void;
}

interface RoutineItem {
  id: string;
  name: string;
  nameHe: string; // Hebrew name
  duration: number; // seconds
  selected: boolean;
}

// Storage keys for persistence
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
  endTimestamp: number; // Timestamp-based for background accuracy
  pausedRemaining: number; // Seconds left when paused
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
  const activeItems = state.items.filter(i => i.selected);

  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload };

    case 'TOGGLE_SELECTION':
      return {
        ...state,
        items: state.items.map(item =>
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
        // Complete
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
        // Resuming: set new endTimestamp from pausedRemaining
        return {
          ...state,
          isPaused: false,
          endTimestamp: Date.now() + state.pausedRemaining * 1000,
        };
      } else {
        // Pausing: save remaining time
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
      // Timestamp-based: calculate actual remaining from endTimestamp
      const tickRemaining = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
      return { ...state, timeLeft: tickRemaining };
    }

    default:
      return state;
  }
};

/**
 * WarmupCooldownFlow - Redesigned with persistence, Hebrew UI, larger timer
 */
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

  // Load saved selections on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const selections: Record<string, boolean> = JSON.parse(saved);
        const merged = defaultItems.map(item => ({
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

  // Save selections whenever they change
  useEffect(() => {
    if (state.items.length === 0) return;

    const selections: Record<string, boolean> = {};
    state.items.forEach(item => {
      selections[item.id] = item.selected;
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(selections));
    } catch (e) {
      console.error('Failed to save routine selections:', e);
    }
  }, [state.items, storageKey]);

  // Timer effect
  useEffect(() => {
    if (!state.isPaused && state.step === 'active' && state.timeLeft > 0) {
      timerRef.current = setTimeout(() => dispatch({ type: 'TICK' }), 1000);
    } else if (state.timeLeft === 0 && state.step === 'active' && !state.isPaused) {
      // Vibrate when exercise ends
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.isPaused, state.step, state.timeLeft]);

  const activeItems = useMemo(() => state.items.filter(i => i.selected), [state.items]);
  const currentItem = activeItems[state.currentIndex];
  const totalDuration = useMemo(() => activeItems.reduce((sum, i) => sum + i.duration, 0), [activeItems]);

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

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const progress = currentItem
    ? ((currentItem.duration - state.timeLeft) / currentItem.duration) * 100
    : 0;

  const isWarning = state.timeLeft <= 3 && state.timeLeft > 0;

  return (
    <motion.div
      className="fixed inset-0 z-[11000] bg-black/95 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="h-full flex flex-col justify-center p-6 max-w-lg mx-auto safe-area-top safe-area-bottom">
        <AnimatePresence mode="wait">
          {state.step === 'selection' ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex flex-col h-full"
            >
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-3xl font-black text-white mb-2">
                  {type === 'warmup' ? 'חימום' : 'צינון'}
                </h2>
                <p className="text-white/60 text-sm">
                  בחר את התרגילים שתרצה לבצע
                </p>
                <p className="text-[var(--cosmos-accent-primary)] text-xs mt-1 font-medium">
                  סה״כ: {formatTime(totalDuration)} • {activeItems.length} תרגילים
                </p>
              </div>

              {/* Exercise List */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar pb-4">
                {state.items.map(item => (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleSelection(item.id)}
                    className={`p-4 min-h-[60px] rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${item.selected
                      ? 'bg-[var(--cosmos-accent-primary)]/15 border-[var(--cosmos-accent-primary)]'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${item.selected
                        ? 'bg-[var(--cosmos-accent-primary)] border-[var(--cosmos-accent-primary)]'
                        : 'border-white/30'
                        }`}>
                        {item.selected && <span className="text-black text-sm">✓</span>}
                      </div>
                      <span className={`font-semibold ${item.selected ? 'text-white' : 'text-white/60'}`}>
                        {item.nameHe}
                      </span>
                    </div>
                    <span className="text-sm text-white/50 tabular-nums">
                      {formatTime(item.duration)}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-auto pt-4 space-y-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onSkip}
                  className="w-full h-14 min-h-[56px] rounded-2xl bg-transparent border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all font-medium"
                >
                  דלג על {type === 'warmup' ? 'החימום' : 'הצינון'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={startRoutine}
                  disabled={activeItems.length === 0}
                  className="w-full h-14 min-h-[56px] rounded-2xl bg-[var(--cosmos-accent-primary)] text-black font-bold text-lg shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  התחל שגרה ({activeItems.length})
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full flex flex-col items-center h-full"
            >
              {/* Progress Header */}
              <div className="w-full flex justify-between items-center mb-6">
                <span className="text-white/60 font-medium text-sm">
                  {state.currentIndex + 1} / {activeItems.length}
                </span>
                <button
                  onClick={onSkip}
                  className="text-white/50 hover:text-white transition-colors text-sm"
                >
                  דלג על הכל
                </button>
              </div>

              {/* Exercise Name */}
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                {currentItem?.nameHe}
              </h2>

              {/* Large Circular Timer - 200px */}
              <div className="flex-1 flex items-center justify-center">
                <div
                  onClick={togglePause}
                  className="relative w-[200px] h-[200px] rounded-full cursor-pointer hover:scale-105 transition-transform active:scale-95"
                >
                  {/* Background Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="10"
                      fill="none"
                    />
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="90"
                      stroke={isWarning ? '#ef4444' : 'var(--cosmos-accent-primary)'}
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 90}
                      strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
                      style={{
                        filter: isWarning
                          ? 'drop-shadow(0 0 15px rgba(239,68,68,0.5))'
                          : 'drop-shadow(0 0 10px rgba(99,102,241,0.3))'
                      }}
                    />
                  </svg>

                  {/* Time Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      key={state.timeLeft}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className={`text-5xl font-black tabular-nums ${isWarning ? 'text-red-500' : state.timeLeft === 0 ? 'text-green-500' : 'text-white'
                        }`}
                    >
                      {formatTime(state.timeLeft)}
                    </motion.span>
                    {state.isPaused && (
                      <span className="text-yellow-400 text-xs font-semibold mt-2 animate-pulse">
                        מושהה
                      </span>
                    )}
                    {state.timeLeft === 0 && (
                      <span className="text-green-400 text-xs font-semibold mt-2">
                        הושלם!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tip */}
              <p className="text-white/30 text-xs mb-6">
                לחץ על השעון להשהייה/המשך
              </p>

              {/* Navigation Buttons */}
              <div className="w-full flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={prevExercise}
                  disabled={state.currentIndex === 0}
                  className={`w-16 h-14 min-h-[56px] rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center text-2xl text-white transition-all ${state.currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'
                    }`}
                >
                  →
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={nextExercise}
                  className="flex-1 h-14 min-h-[56px] rounded-2xl bg-green-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:brightness-110 transition-all"
                >
                  {state.currentIndex === activeItems.length - 1 ? 'סיום' : 'הבא'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .safe-area-top { padding-top: env(safe-area-inset-top, 0); }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 16px); }
      `}</style>
    </motion.div>
  );
};

export default React.memo(WarmupCooldownFlow);
