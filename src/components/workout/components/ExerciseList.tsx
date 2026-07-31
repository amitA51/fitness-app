// ExerciseList - short results retain native DOM order; large catalogs stay semantic and keyboard reachable.

import { useVirtualizer } from '@tanstack/react-virtual';
import { SearchX } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PersonalExercise } from '../../../types';
import { ExerciseCard } from './ExerciseCard';

interface ExerciseListProps {
  exercises: PersonalExercise[];
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onExerciseClick?: (exercise: PersonalExercise) => void;
  onDeleteExercise?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

interface ExerciseListItemProps {
  exercise: PersonalExercise;
  isSelectionMode: boolean;
  selectedIds?: Set<string>;
  onExerciseClick?: (exercise: PersonalExercise) => void;
  onDeleteExercise?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const VIRTUALIZE_THRESHOLD = 20;
const ESTIMATED_CARD_HEIGHT = 88;
const VIRTUAL_ITEM_GAP = 10;

type FocusEdge = 'first' | 'last';

// At 90 cards this picker mounted 2,402 DOM nodes, including a motion wrapper
// for every card. That contributed to a measured 107 ms search task on a
// throttled Pixel 5, so only large catalogs pay the virtual-list complexity.
const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[tabindex], button')).filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex >= 0
  );

const getVirtualRowFocusTarget = (
  container: HTMLElement | null,
  index: number,
  edge: FocusEdge
): HTMLElement | undefined => {
  const row = container?.querySelector<HTMLElement>(`[data-exercise-index="${index}"]`);
  if (!row) return undefined;

  const focusableElements = getFocusableElements(row);
  return edge === 'first' ? focusableElements[0] : focusableElements[focusableElements.length - 1];
};

const ExerciseListItem = ({
  exercise,
  isSelectionMode,
  selectedIds,
  onExerciseClick,
  onDeleteExercise,
}: ExerciseListItemProps) => (
  <div role="listitem">
    <ExerciseCard
      exercise={exercise}
      isSelectionMode={isSelectionMode}
      isSelected={selectedIds?.has(exercise.id) ?? false}
      onClick={onExerciseClick}
      onDelete={onDeleteExercise}
    />
  </div>
);

const VirtualizedExerciseItems = ({
  exercises,
  isSelectionMode,
  selectedIds,
  onExerciseClick,
  onDeleteExercise,
}: Omit<ExerciseListProps, 'emptyTitle' | 'emptyDescription'>) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<{ index: number; edge: FocusEdge } | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The library shell owns scrolling rather than this list. Tracking the list's
  // offset keeps virtual rows aligned when the filters above it change height.
  const getScrollElement = useCallback((): HTMLElement | null => {
    let element: HTMLElement | null = parentRef.current?.parentElement ?? null;
    while (element) {
      const style = window.getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowY)) return element;
      element = element.parentElement;
    }
    return null;
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const parent = parentRef.current;
      const scrollElement = getScrollElement();
      if (!parent || !scrollElement) return;
      const offset =
        parent.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top +
        scrollElement.scrollTop;
      // Only commit real changes. The observers below fire on attach and on every
      // total-size change, and an unconditional set would re-render on each one.
      setScrollMargin((previous) => (previous === offset ? previous : offset));
    };
    measure();
    window.addEventListener('resize', measure);

    // A window resize is not the only thing that moves this list. Expanding the
    // equipment panel, the quick-picks row appearing, or an error banner mounting
    // all shift the list down inside the same scroll container. Without
    // re-measuring, every virtual row stays positioned against the old offset and
    // the list visibly detaches from its slot. Observing the scroll container's
    // children catches the size changes; the childList observer keeps that set
    // current as banners and the form mount and unmount.
    const scrollElement = getScrollElement();
    let sizeObserver: ResizeObserver | undefined;
    let childObserver: MutationObserver | undefined;

    if (scrollElement && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      sizeObserver = observer;
      const observeSiblings = () => {
        observer.disconnect();
        observer.observe(scrollElement);
        for (const child of Array.from(scrollElement.children)) observer.observe(child);
      };
      observeSiblings();

      if (typeof MutationObserver !== 'undefined') {
        childObserver = new MutationObserver(observeSiblings);
        childObserver.observe(scrollElement, { childList: true });
      }
    }

    return () => {
      window.removeEventListener('resize', measure);
      sizeObserver?.disconnect();
      childObserver?.disconnect();
    };
  }, [getScrollElement]);

  const virtualizer = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: exercises.length,
    getScrollElement,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    getItemKey: (index) => exercises[index]?.id ?? index,
    overscan: 6,
    gap: VIRTUAL_ITEM_GAP,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // Offscreen rows leave the DOM by design. When Tab reaches the rendered
  // buffer's edge, scroll and focus the adjacent logical row so keyboard users
  // retain the same complete catalog traversal as the former plain list.
  useLayoutEffect(() => {
    const pendingFocus = pendingFocusRef.current;
    if (!pendingFocus) return;

    const focusTarget = getVirtualRowFocusTarget(
      parentRef.current,
      pendingFocus.index,
      pendingFocus.edge
    );
    if (focusTarget) {
      pendingFocusRef.current = null;
      focusTarget.focus();
    }
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !(event.target instanceof HTMLElement)) return;

    const row = event.target.closest<HTMLElement>('[data-exercise-index]');
    if (!row) return;

    const index = Number(row.dataset.exerciseIndex);
    if (!Number.isInteger(index)) return;

    const focusableElements = getFocusableElements(row);
    const focusedElementIndex = focusableElements.indexOf(event.target);
    if (focusedElementIndex < 0) return;

    const isMovingBackward = event.shiftKey;
    const isAtRowBoundary = isMovingBackward
      ? focusedElementIndex === 0
      : focusedElementIndex === focusableElements.length - 1;
    if (!isAtRowBoundary) return;

    const adjacentIndex = index + (isMovingBackward ? -1 : 1);
    if (adjacentIndex < 0 || adjacentIndex >= exercises.length) return;
    if (virtualItems.some((virtualItem) => virtualItem.index === adjacentIndex)) return;

    event.preventDefault();
    pendingFocusRef.current = {
      index: adjacentIndex,
      edge: isMovingBackward ? 'last' : 'first',
    };
    virtualizer.scrollToIndex(adjacentIndex, { align: 'auto' });
  };

  return (
    // `role="presentation"` on both wrappers is load-bearing, not decoration:
    // `role="list"` requires listitem children, and the virtualizer needs a
    // measuring parent plus a total-height spacer in between. Leaving them as
    // plain generics drops the list→listitem relationship in NVDA/JAWS/VoiceOver,
    // so the catalog stops announcing "N of M" for Hebrew screen-reader users.
    <div ref={parentRef} onKeyDown={handleKeyDown} role="presentation">
      <div
        role="presentation"
        style={{
          blockSize: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          inlineSize: '100%',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const exercise = exercises[virtualItem.index];
          if (!exercise) return null;

          return (
            <div
              key={exercise.id}
              data-index={virtualItem.index}
              data-exercise-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="listitem"
              aria-posinset={virtualItem.index + 1}
              aria-setsize={exercises.length}
              style={{
                position: 'absolute',
                insetBlockStart: 0,
                insetInlineStart: 0,
                inlineSize: '100%',
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              }}
            >
              <ExerciseCard
                exercise={exercise}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds?.has(exercise.id) ?? false}
                onClick={onExerciseClick}
                onDelete={onDeleteExercise}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ExerciseList: React.FC<ExerciseListProps> = memo(
  ({
    exercises,
    isSelectionMode = false,
    selectedIds,
    onExerciseClick,
    onDeleteExercise,
    emptyTitle = 'עדיין אין תרגילים',
    emptyDescription = 'צרו תרגיל חדש כדי להתחיל לבנות את הספרייה.',
  }) => {
    if (exercises.length === 0) {
      return (
        <div className="exercise-library-empty">
          <div className="exercise-library-empty__icon">
            <SearchX aria-hidden="true" />
          </div>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      );
    }

    const shouldVirtualize = exercises.length >= VIRTUALIZE_THRESHOLD;

    return (
      <div className="exercise-list" role="list" aria-label="תרגילים">
        {shouldVirtualize ? (
          <VirtualizedExerciseItems
            exercises={exercises}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onExerciseClick={onExerciseClick}
            onDeleteExercise={onDeleteExercise}
          />
        ) : (
          exercises.map((exercise) => (
            <ExerciseListItem
              key={exercise.id}
              exercise={exercise}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onExerciseClick={onExerciseClick}
              onDeleteExercise={onDeleteExercise}
            />
          ))
        )}
      </div>
    );
  }
);

ExerciseList.displayName = 'ExerciseList';

export { ExerciseList };
