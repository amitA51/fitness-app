import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import SlideToComplete from './SlideToComplete';

// SlideToComplete pulls in GSAP, the spark burst, and haptics. None of that is
// relevant to the pointer-down focus behaviour under test, so stub them out to
// keep the test isolated and free of canvas/animation side effects.
vi.mock('../../../lib/gsap', () => ({
  DUR: { fast: 0, micro: 0 },
  EASE: { pop: 'none', out: 'none', popHard: 'none' },
  gsap: { set: vi.fn(), timeline: () => ({ to: () => ({}) }) },
  useGSAP: vi.fn(),
}));
vi.mock('../../../lib/gsapSparks', () => ({ fireSparks: vi.fn() }));
vi.mock('../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

// jsdom does not implement the Pointer Capture API; stub it so the pointer-down
// handler can run to completion.
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
  };
  if (!proto.setPointerCapture) {
    proto.setPointerCapture = () => {};
    proto.releasePointerCapture = () => {};
  }
});

describe('SlideToComplete', () => {
  it('focuses the slider on pointer-down so a following Enter activates it', () => {
    // Arrange
    render(<SlideToComplete label="החלק לסימון סט 1/3" onComplete={vi.fn()} />);
    const slider = screen.getByRole('button', { name: 'החלק לסימון סט 1/3' });
    // A previously focused control simulates the real bug: without explicit
    // focus, Enter would activate this other element instead of the slider.
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    // Act
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });

    // Assert
    expect(document.activeElement).toBe(slider);

    other.remove();
  });

  it('does not steal focus when disabled', () => {
    // Arrange
    render(<SlideToComplete label="התרגיל הושלם" onComplete={vi.fn()} disabled />);
    const slider = screen.getByRole('button', { name: 'התרגיל הושלם' });
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();

    // Act
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });

    // Assert — disabled slider must not grab focus
    expect(document.activeElement).toBe(other);

    other.remove();
  });
});
