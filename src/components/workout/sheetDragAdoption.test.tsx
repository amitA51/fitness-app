// Five sheets used to bypass the house drag-to-dismiss in ModalOverlay: four
// hand-rolled their own with `dragConstraints={{top: 0, bottom: 0}}` +
// `dragElastic` 0.4–0.5 (the sheet moved half as far as the finger), and
// NumpadOverlay — the weight/reps entry surface, the most-touched sheet in the
// product — had no `drag` prop at all.
//
// One test per surface, asserting the two things migration is supposed to buy:
// a grabbable handle, and a transform that equals the pointer delta exactly.

import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ExerciseReorder from './ExerciseReorder';
import ExerciseSelector from './ExerciseSelector';
import SupersetPicker from './components/SupersetPicker';
import NumpadOverlay from './overlays/NumpadOverlay';
import WorkoutSettingsOverlay from './overlays/WorkoutSettingsOverlay';

vi.mock('../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
}));

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
  useMotionConfigMode: () => 'user',
}));

// The exercise library and template picker are large trees with their own data
// dependencies; this file is about the sheet chrome, not their contents.
vi.mock('./ExerciseLibraryTab', () => ({
  default: () => <div data-testid="library-tab" />,
}));
vi.mock('../templates/EmbeddedTemplatePicker', () => ({
  EmbeddedTemplatePicker: () => <div data-testid="template-picker" />,
}));
vi.mock('../../services/dataService', () => ({
  incrementExerciseUse: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { darkMode: false, workoutSettings: {} },
    updateSettings: vi.fn(),
    updateWorkoutSettings: vi.fn(),
  }),
}));

beforeAll(() => {
  // jsdom has no pointer capture (it THROWS rather than no-ops) and no
  // PointerEvent constructor — without which fireEvent silently drops clientY
  // and every assertion here would pass while measuring nothing.
  const proto = HTMLElement.prototype as unknown as {
    setPointerCapture: (id: number) => void;
    releasePointerCapture: (id: number) => void;
    hasPointerCapture: (id: number) => boolean;
  };
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.hasPointerCapture = () => false;

  if (typeof window.PointerEvent === 'undefined') {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      isPrimary: boolean;
      constructor(
        type: string,
        init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
      ) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
        this.isPrimary = true;
      }
    }
    window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  }
});

let nextPointerId = 100;

/** Drag the sheet's own handle down by `distance` and return the layer's transform. */
const dragHandleBy = async (distance: number): Promise<string> => {
  const handle = document.querySelector('[data-sheet-drag-handle]');
  if (!handle) throw new Error('no [data-sheet-drag-handle] on this sheet');
  const layer = screen.getByRole('dialog').firstElementChild as HTMLElement;
  const pointerId = ++nextPointerId;

  fireEvent.pointerDown(handle, { clientX: 60, clientY: 200, pointerId, buttons: 1 });
  fireEvent.pointerMove(window, { clientX: 60, clientY: 230, pointerId, buttons: 1 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  fireEvent.pointerMove(window, { clientX: 60, clientY: 200 + distance, pointerId, buttons: 1 });
  await new Promise((resolve) => setTimeout(resolve, 40));

  const transform = layer.style.transform;
  fireEvent.pointerUp(window, { clientX: 60, clientY: 200 + distance, pointerId });
  await new Promise((resolve) => setTimeout(resolve, 40));
  return transform;
};

const wrap = (ui: React.ReactNode) => render(<LazyMotion features={domMax}>{ui}</LazyMotion>);

afterEach(() => {
  vi.clearAllMocks();
});

describe('bottom sheets adopt the house drag-to-dismiss', () => {
  it('NumpadOverlay — the weight/reps surface — is draggable at all, and 1:1', async () => {
    wrap(
      <NumpadOverlay
        isOpen
        target="weight"
        value="60"
        onInput={vi.fn()}
        onSetValue={vi.fn()}
        onDelete={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(document.querySelector('[data-sheet-drag-handle]')).not.toBeNull();
    expect(await dragHandleBy(150)).toBe('translateY(150px)');
  });

  it('a numpad key does not start a drag — the keypad keeps its presses', async () => {
    wrap(
      <NumpadOverlay
        isOpen
        target="weight"
        value="60"
        onInput={vi.fn()}
        onSetValue={vi.fn()}
        onDelete={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const layer = screen.getByRole('dialog').firstElementChild as HTMLElement;
    const key = screen.getByRole('button', { name: '7' });
    const pointerId = ++nextPointerId;

    fireEvent.pointerDown(key, { clientX: 60, clientY: 200, pointerId, buttons: 1 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 340, pointerId, buttons: 1 });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(layer.style.transform).toBe('none');
    fireEvent.pointerUp(window, { clientX: 60, clientY: 340, pointerId });
  });

  it('ExerciseSelector tracks 1:1 instead of at dragElastic 0.5', async () => {
    wrap(<ExerciseSelector isOpen onSelect={vi.fn()} onClose={vi.fn()} onCreateNew={vi.fn()} />);

    expect(document.querySelector('[data-sheet-drag-handle]')).not.toBeNull();
    expect(await dragHandleBy(150)).toBe('translateY(150px)');
  });

  it('WorkoutSettingsOverlay tracks 1:1 instead of at dragElastic 0.4', async () => {
    wrap(
      <WorkoutSettingsOverlay isOpen settings={{}} onClose={vi.fn()} onUpdateSetting={vi.fn()} />
    );

    expect(document.querySelector('[data-sheet-drag-handle]')).not.toBeNull();
    expect(await dragHandleBy(150)).toBe('translateY(150px)');
  });

  it('SupersetPicker tracks 1:1 instead of at dragElastic 0.5', async () => {
    wrap(
      <SupersetPicker
        isOpen
        exercises={[
          { id: 'a', name: 'סקוואט' },
          { id: 'b', name: 'לחיצת חזה' },
        ]}
        anchorExerciseId="a"
        existingGroups={[]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(document.querySelector('[data-sheet-drag-handle]')).not.toBeNull();
    expect(await dragHandleBy(150)).toBe('translateY(150px)');
  });

  it('ExerciseReorder tracks 1:1 and no longer competes with its Reorder.Group', async () => {
    wrap(
      <ExerciseReorder
        exercises={[]}
        currentIndex={0}
        onReorder={vi.fn()}
        onSelectExercise={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(document.querySelector('[data-sheet-drag-handle]')).not.toBeNull();
    expect(await dragHandleBy(150)).toBe('translateY(150px)');
  });

  it('ExerciseReorder header buttons still fire — a grab never swallows a tap', async () => {
    const onClose = vi.fn();
    wrap(
      <ExerciseReorder
        exercises={[]}
        currentIndex={0}
        onReorder={vi.fn()}
        onSelectExercise={vi.fn()}
        onClose={onClose}
      />
    );

    // The close button lives INSIDE the navy header, which is itself a drag
    // handle. Without ModalOverlay's interactive-element guard, the pointer-down
    // would start a drag and Framer would eat the click.
    const layer = screen.getByRole('dialog').firstElementChild as HTMLElement;
    const close = screen.getByRole('button', { name: 'סגור' });
    const pointerId = ++nextPointerId;

    fireEvent.pointerDown(close, { clientX: 60, clientY: 200, pointerId, buttons: 1 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 260, pointerId, buttons: 1 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(layer.style.transform).toBe('none');

    fireEvent.pointerUp(window, { clientX: 60, clientY: 260, pointerId });
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
