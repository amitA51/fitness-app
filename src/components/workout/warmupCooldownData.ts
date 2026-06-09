// WarmupCooldownFlow — data, types, state reducer, helpers
// Extracted from WarmupCooldownFlow.tsx (pure structural split, no behavior change).

export interface RoutineItem {
  id: string;
  name: string;
  nameHe: string;
  duration: number;
  selected: boolean;
}

export const WARMUP_STORAGE_KEY = 'warmup_routine_selections';
export const COOLDOWN_STORAGE_KEY = 'cooldown_routine_selections';

export const DEFAULT_WARMUP: RoutineItem[] = [
  { id: 'w1', name: 'Jumping Jacks', nameHe: 'קפיצות ג׳ק', duration: 60, selected: true },
  { id: 'w2', name: 'Arm Circles', nameHe: 'סיבובי ידיים', duration: 30, selected: true },
  { id: 'w3', name: 'Torso Twists', nameHe: 'סיבובי גו', duration: 30, selected: true },
  { id: 'w4', name: 'Leg Swings', nameHe: 'תנופות רגליים', duration: 45, selected: true },
  { id: 'w5', name: 'High Knees', nameHe: 'ברכיים גבוהות', duration: 45, selected: false },
  { id: 'w6', name: 'Dynamic Squats', nameHe: 'סקוואטים דינמיים', duration: 45, selected: false },
  { id: 'w7', name: 'Lunges', nameHe: 'לאנג׳ים', duration: 45, selected: false },
  { id: 'w8', name: 'Shoulder Rolls', nameHe: 'גלילות כתפיים', duration: 30, selected: false },
];

export const DEFAULT_COOLDOWN: RoutineItem[] = [
  { id: 'c1', name: 'Static Stretching', nameHe: 'מתיחות סטטיות', duration: 60, selected: true },
  { id: 'c2', name: 'Deep Breathing', nameHe: 'נשימות עמוקות', duration: 60, selected: true },
  { id: 'c3', name: "Child's Pose", nameHe: 'תנוחת הילד', duration: 45, selected: true },
  {
    id: 'c4',
    name: 'Hamstring Stretch',
    nameHe: 'מתיחת ירכיים אחוריות',
    duration: 45,
    selected: false,
  },
  { id: 'c5', name: 'Quad Stretch', nameHe: 'מתיחת ירך קדמית', duration: 45, selected: false },
  { id: 'c6', name: 'Shoulder Stretch', nameHe: 'מתיחת כתפיים', duration: 30, selected: false },
];

// ============================================================
// STATE MANAGEMENT
// ============================================================

export type State = {
  step: 'selection' | 'active';
  items: RoutineItem[];
  currentIndex: number;
  timeLeft: number;
  isPaused: boolean;
  endTimestamp: number;
  pausedRemaining: number;
};

export type Action =
  | { type: 'SET_ITEMS'; payload: RoutineItem[] }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'START_ROUTINE' }
  | { type: 'NEXT_EXERCISE' }
  | { type: 'PREV_EXERCISE' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'TICK' }
  | { type: 'ROUTINE_COMPLETED' };

export const reducer = (state: State, action: Action): State => {
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
      }
      return { ...state, step: 'selection' as const, currentIndex: -1 };
    }

    case 'ROUTINE_COMPLETED':
      return state;

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
      }
      const remaining = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 1000));
      return {
        ...state,
        isPaused: true,
        pausedRemaining: remaining,
        timeLeft: remaining,
      };
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

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
