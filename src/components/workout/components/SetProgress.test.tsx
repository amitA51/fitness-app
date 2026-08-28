import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetProgress } from './SetProgress';

// The app is Hebrew RTL; the spine's fill direction is only observable under a
// real RTL document, so pin the direction for the whole file.
beforeAll(() => {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'he';
});
afterAll(() => {
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

/**
 * HARD CONSTRAINT guard: the progressbar's announcement must count the SAME
 * sets, in the same order, as the visible label. A mismatch once announced a
 * different number to screen-reader users than the screen showed.
 */
const expectAriaInSyncWithLabel = (visibleText: string) => {
  const aria = screen.getByRole('progressbar').getAttribute('aria-label') ?? '';
  const visibleNumbers = visibleText.match(/\d+/g) ?? [];
  const ariaNumbers = aria.match(/\d+/g) ?? [];
  expect(ariaNumbers).toEqual(visibleNumbers);
  return aria;
};

describe('SetProgress label — names the set that is PENDING, never ambiguously', () => {
  it('mid-workout: prefixes "הבא" so the number is unmistakably the next set', () => {
    // Arrange — 5 working sets, 1 done. The lifter is about to do set 2.
    const { container } = render(
      <SetProgress
        current={1}
        total={5}
        completed={1}
        workingTotal={5}
        workingCompleted={1}
        warmupTotal={0}
        warmupCompleted={0}
        activeIsWarmup={false}
      />
    );

    // Assert — "סט 2 מתוך 5" alone could mean set 2 is finished; "הבא" fixes it.
    expect(container.textContent).toBe('הבא · סט 2 מתוך 5');
    const aria = expectAriaInSyncWithLabel(container.textContent ?? '');
    expect(aria).toBe('התקדמות סטים, הבא, סט 2 מתוך 5');
  });

  it('warmup phase: keeps the "חימום" phase name and the same "הבא" framing', () => {
    // Arrange — 2 warmups + 4 working, first warmup pending.
    const { container } = render(
      <SetProgress
        current={0}
        total={6}
        completed={0}
        warmupIndices={new Set([0, 1])}
        workingTotal={4}
        workingCompleted={0}
        warmupTotal={2}
        warmupCompleted={0}
        activeIsWarmup
      />
    );

    // Assert
    expect(container.textContent).toBe('הבא · חימום 1 מתוך 2');
    const aria = expectAriaInSyncWithLabel(container.textContent ?? '');
    expect(aria).toBe('התקדמות סטים, הבא, חימום 1 מתוך 2');
  });

  it('completed: reads as a finished state with no pending ordinal at all', () => {
    // Arrange — every set done.
    const { container } = render(
      <SetProgress
        current={4}
        total={5}
        completed={5}
        workingTotal={5}
        workingCompleted={5}
        warmupTotal={0}
        warmupCompleted={0}
        activeIsWarmup={false}
      />
    );

    // Assert — no "הבא", because nothing is pending.
    expect(container.textContent).toBe('הושלם · 5/5');
    expect(container.textContent).not.toContain('הבא');
    const aria = expectAriaInSyncWithLabel(container.textContent ?? '');
    expect(aria).toBe('התקדמות סטים, הושלם, 5 מתוך 5');
  });

  it('all-sets fallback (no working counts) carries the same "הבא" framing', () => {
    // Arrange — plain non-program template: no workingTotal supplied.
    const { container } = render(<SetProgress current={2} total={4} completed={2} />);

    // Assert
    expect(container.textContent).toBe('הבא · סט 3 מתוך 4');
    expectAriaInSyncWithLabel(container.textContent ?? '');
  });
});

describe('SetProgress spine — fills from the reading start under RTL', () => {
  it('does not force LTR, so multiple segments advance right→left in Hebrew', () => {
    // Arrange — MORE THAN ONE segment: with a single set the fill direction is
    // invisible, which is why this defect survived a QA pass.
    render(
      <SetProgress
        current={2}
        total={5}
        completed={2}
        workingTotal={5}
        workingCompleted={2}
        warmupTotal={0}
        warmupCompleted={0}
        activeIsWarmup={false}
      />
    );
    const spine = screen.getByRole('progressbar');

    // Assert — five segments, emitted in ascending index order, and NO direction
    // override of any kind. A flex row that inherits the document's `rtl` starts
    // its main axis at the right edge, so segment 1 (index 0) renders at the
    // reading start and the fill advances right→left.
    expect(spine.children).toHaveLength(5);
    expect(spine.style.direction).toBe('');
    expect(spine.getAttribute('style')).not.toContain('direction');
    expect(spine.hasAttribute('dir')).toBe(false);
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('reports fill progress semantically so the order is not the only signal', () => {
    // Arrange
    render(<SetProgress current={2} total={5} completed={2} />);
    const spine = screen.getByRole('progressbar');

    // Assert
    expect(spine).toHaveAttribute('aria-valuemin', '0');
    expect(spine).toHaveAttribute('aria-valuemax', '5');
    expect(spine).toHaveAttribute('aria-valuenow', '2');
  });
});
