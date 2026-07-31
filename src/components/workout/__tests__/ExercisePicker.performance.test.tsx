const deferredQuery = vi.hoisted(() => ({ current: '' }));
const deferredValueMock = vi.hoisted(() => vi.fn());
const virtualizerMock = vi.hoisted(() => ({
  useVirtualizer: vi.fn((options: { count: number; scrollMargin?: number }) => ({
    getTotalSize: () => options.count * 98,
    getVirtualItems: () =>
      Array.from({ length: Math.min(options.count, 6) }, (_, index) => ({
        index,
        start: index * 98,
        key: index,
      })),
    measureElement: () => undefined,
    scrollToIndex: () => undefined,
  })),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useDeferredValue = deferredValueMock;
  return {
    ...actual,
    default: { ...actual, useDeferredValue },
    useDeferredValue,
  };
});

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: virtualizerMock.useVirtualizer,
}));

vi.mock('../../../services/dataService', () => ({
  getPersonalExercises: vi.fn(),
  createPersonalExercise: vi.fn(),
  deletePersonalExercise: vi.fn(),
}));

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dataService from '../../../services/dataService';
import type { PersonalExercise } from '../../../types';
import ExerciseLibraryTab from '../ExerciseLibraryTab';
import { ExerciseList } from '../components/ExerciseList';

const createExercise = (index: number): PersonalExercise => ({
  id: `exercise-${index}`,
  name: `תרגיל ${index}`,
  muscleGroup: 'Chest',
  targetMuscle: 'Chest',
  equipment: 'barbell',
});

const catalog: PersonalExercise[] = [
  {
    id: 'bench',
    name: 'לחיצת חזה | Bench Press',
    muscleGroup: 'Chest',
    targetMuscle: 'Chest',
    equipment: 'barbell',
  },
  {
    id: 'squat',
    name: 'סקוואט',
    muscleGroup: 'Legs',
    targetMuscle: 'Legs',
    equipment: 'barbell',
  },
  {
    id: 'row',
    name: 'חתירה בכבל',
    muscleGroup: 'Back',
    targetMuscle: 'Back',
    equipment: 'cable',
  },
];

beforeEach(() => {
  deferredValueMock.mockImplementation(() => deferredQuery.current);
  deferredQuery.current = '';
  vi.mocked(dataService.getPersonalExercises).mockResolvedValue(catalog);
});

describe('Exercise picker performance safeguards', () => {
  it('renders a bounded card window for a large catalog while preserving keyboard activation', () => {
    const onExerciseClick = vi.fn();
    const exercises = Array.from({ length: 90 }, (_, index) => createExercise(index + 1));

    render(
      <ExerciseList exercises={exercises} isSelectionMode onExerciseClick={onExerciseClick} />
    );

    const list = screen.getByRole('list', { name: 'תרגילים' });
    const renderedItems = within(list).getAllByRole('listitem');
    expect(renderedItems).toHaveLength(6);
    expect(renderedItems.length).toBeLessThan(exercises.length);

    fireEvent.keyDown(screen.getByRole('button', { name: /^תרגיל 1,/ }), { key: 'Enter' });
    expect(onExerciseClick).toHaveBeenCalledWith(exercises[0]);
  });

  it('keeps list ownership intact so virtual rows stay announced as list items', () => {
    const exercises = Array.from({ length: 90 }, (_, index) => createExercise(index + 1));

    render(<ExerciseList exercises={exercises} isSelectionMode onExerciseClick={vi.fn()} />);

    const list = screen.getByRole('list', { name: 'תרגילים' });

    // The virtualizer needs a measuring parent and a height spacer between the
    // list and its rows. Every such wrapper must be presentational, otherwise the
    // list → listitem relationship breaks in screen readers.
    const wrappers = Array.from(list.querySelectorAll('div')).filter(
      (element) => element.querySelector('[role="listitem"]') !== null
    );
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      expect(wrapper).toHaveAttribute('role', 'presentation');
    }

    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveAttribute('aria-posinset', '1');
    expect(rows[0]).toHaveAttribute('aria-setsize', '90');
  });

  it('marks results as settled once the deferred query matches the input', async () => {
    const user = userEvent.setup();
    deferredValueMock.mockImplementation((value: string) => value);

    const { container } = render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    await screen.findByText('סקוואט');
    const results = container.querySelector('.exercise-library__scroll');
    expect(results).toHaveAttribute('data-stale', 'false');

    await user.type(screen.getByRole('searchbox', { name: 'חיפוש לפי שם, שריר או ציוד' }), 'כבל');

    expect(results).toHaveAttribute('data-stale', 'false');
    expect(screen.getByText('חתירה בכבל')).toBeInTheDocument();
  });

  it('flags in-flight filtering without locking the list', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    // Deferred value frozen behind the input: the state the user sees mid-typing.
    deferredValueMock.mockImplementation(() => '');

    const { container } = render(<ExerciseLibraryTab isSelectionMode onSelect={onSelect} />);

    await screen.findByText('סקוואט');
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש לפי שם, שריר או ציוד' }), 'כבל');

    const results = container.querySelector('.exercise-library__scroll');
    expect(results).toHaveAttribute('data-stale', 'true');

    // Stale is a visual recede only — a card tapped during the transition must
    // still commit, so the interface never locks the user out mid-update.
    await user.click(screen.getByRole('button', { name: /סקוואט/ }));
    expect(onSelect).toHaveBeenCalledWith(catalog[1]);
  });

  it('keeps the input urgent while the catalog uses the deferred query', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExerciseLibraryTab isSelectionMode onSelect={onSelect} />);

    await screen.findByText('סקוואט');
    const search = screen.getByRole('searchbox', {
      name: 'חיפוש לפי שם, שריר או ציוד',
    });
    await user.type(search, 'כבל');

    expect(search).toHaveValue('כבל');
    expect(deferredValueMock).toHaveBeenCalledWith('כבל');
    expect(screen.getByText('סקוואט')).toBeInTheDocument();

    deferredQuery.current = 'כבל';
    await user.type(search, 'x');

    expect(search).toHaveValue('כבלx');
    expect(deferredValueMock).toHaveBeenCalledWith('כבלx');
    await waitFor(() => {
      expect(screen.getByText('חתירה בכבל')).toBeInTheDocument();
      expect(screen.queryByText('סקוואט')).not.toBeInTheDocument();
    });
  });

  it('publishes the floating toolbar height so focus is never hidden behind it', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const height = this.classList.contains('exercise-library__toolbar') ? 160 : 0;
        return {
          height,
          width: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    try {
      const { container } = render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);
      await screen.findByText('סקוואט');

      const section = container.querySelector<HTMLElement>('.exercise-library');
      expect(section?.style.getPropertyValue('--exercise-toolbar-block-size')).toBe('160px');
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('returns to the first result when the effective filter changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    await screen.findByText('סקוואט');
    const section = container.querySelector<HTMLElement>('.exercise-library');
    if (!section) throw new Error('library section missing');

    // Stand in for the user having scrolled deep into a long catalog.
    section.scrollTop = 1200;
    expect(section.scrollTop).toBe(1200);

    await user.click(screen.getByRole('button', { name: 'רגליים' }));

    expect(section.scrollTop).toBe(0);
    expect(screen.getByText('סקוואט')).toBeInTheDocument();
  });

  it('opens and dismisses the equipment panel through a mirrored transition', async () => {
    const user = userEvent.setup();
    render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    await screen.findByText('סקוואט');
    const toggle = screen.getByRole('button', { name: 'סינון' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('group', { name: 'סינון לפי ציוד' })).toBeInTheDocument();

    // Closing must actually retire the panel: an exit animation that never
    // resolves would leave it mounted and keep aria-controls pointing at it.
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'סינון לפי ציוד' })).not.toBeInTheDocument()
    );
  });

  it('re-measures its scroll offset when content above the list changes height', () => {
    const listOffset = { current: 200 };
    const observers: Array<() => void> = [];

    class TestResizeObserver {
      constructor(private readonly callback: () => void) {
        observers.push(() => this.callback());
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const isListRoot = this.parentElement?.classList.contains('exercise-list') ?? false;
        const top = isListRoot ? listOffset.current : 0;
        return {
          height: 0,
          width: 0,
          top,
          left: 0,
          right: 0,
          bottom: top,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      });

    try {
      const exercises = Array.from({ length: 40 }, (_, index) => createExercise(index + 1));
      render(
        <div style={{ overflowY: 'auto' }}>
          <ExerciseList exercises={exercises} isSelectionMode onExerciseClick={vi.fn()} />
        </div>
      );

      const scrollMarginOf = () => {
        const calls = virtualizerMock.useVirtualizer.mock.calls;
        return calls[calls.length - 1]?.[0]?.scrollMargin;
      };
      expect(scrollMarginOf()).toBe(200);

      // The equipment panel expanding pushes the list down. Without a re-measure
      // every virtual row would stay positioned against the old 200px offset.
      listOffset.current = 320;
      act(() => {
        for (const trigger of observers) trigger();
      });

      expect(scrollMarginOf()).toBe(320);
    } finally {
      rectSpy.mockRestore();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });
});
