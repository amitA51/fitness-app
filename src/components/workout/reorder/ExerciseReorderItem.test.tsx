import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reorder } from 'framer-motion';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../../types';
import { ExerciseReorderItem } from './ExerciseReorderItem';

vi.mock('../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));

const exercise: Exercise = {
  id: 'ex-1',
  name: 'לחיצת חזה',
  muscleGroup: 'חזה',
  targetRestTime: 90,
  sets: [],
};

function renderItem(overrides: Partial<React.ComponentProps<typeof ExerciseReorderItem>> = {}) {
  const onMove = vi.fn();
  render(
    <Reorder.Group axis="y" values={[exercise]} onReorder={vi.fn()}>
      <ExerciseReorderItem
        exercise={exercise}
        index={1}
        originalIndex={1}
        total={3}
        isActive={false}
        isExpanded={false}
        completedSets={0}
        totalSets={0}
        isDeleteConfirm={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onToggleExpand={vi.fn()}
        onMove={onMove}
        {...overrides}
      />
    </Reorder.Group>
  );
  return { onMove };
}

describe('ExerciseReorderItem keyboard reorder', () => {
  it('exposes the grip as a focusable button announcing its position', () => {
    renderItem();
    const grip = screen.getByRole('button', {
      name: 'גרור או השתמש בחצים לשינוי סדר — תרגיל 2 מתוך 3',
    });
    expect(grip).toBeInTheDocument();
  });

  it('moves the item down on ArrowDown when not last', async () => {
    const user = userEvent.setup();
    const { onMove } = renderItem({ index: 1, total: 3 });
    const grip = screen.getByRole('button', { name: /לשינוי סדר/ });
    grip.focus();
    await user.keyboard('{ArrowDown}');
    expect(onMove).toHaveBeenCalledWith(1, 'down');
  });

  it('moves the item up on ArrowUp when not first', async () => {
    const user = userEvent.setup();
    const { onMove } = renderItem({ index: 1, total: 3 });
    const grip = screen.getByRole('button', { name: /לשינוי סדר/ });
    grip.focus();
    await user.keyboard('{ArrowUp}');
    expect(onMove).toHaveBeenCalledWith(1, 'up');
  });

  it('does not move past the start (ArrowUp on first item is a no-op)', async () => {
    const user = userEvent.setup();
    const { onMove } = renderItem({ index: 0, total: 3 });
    const grip = screen.getByRole('button', { name: /לשינוי סדר/ });
    grip.focus();
    await user.keyboard('{ArrowUp}');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not move past the end (ArrowDown on last item is a no-op)', async () => {
    const user = userEvent.setup();
    const { onMove } = renderItem({ index: 2, total: 3 });
    const grip = screen.getByRole('button', { name: /לשינוי סדר/ });
    grip.focus();
    await user.keyboard('{ArrowDown}');
    expect(onMove).not.toHaveBeenCalled();
  });
});
