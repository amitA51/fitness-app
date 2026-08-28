import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ActionChip from './ActionChip';

// The chip lives in a horizontal scroller on the live workout screen, and this
// app runs RTL — the row starts at the RIGHT and its overflow edge is the LEFT.
// Pin the direction for the whole file so anything direction-dependent is
// observable.
beforeAll(() => {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'he';
});
afterAll(() => {
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

const Icon = () => <svg aria-hidden="true" role="presentation" />;

/**
 * Physical inline-axis properties only. `top`/`bottom` are block-axis and mirror
 * safely, so they are not defects; `left`/`right` and their padding, margin and
 * border forms are.
 */
const PHYSICAL_INLINE_PROPERTY =
  /(?:^|;)\s*(?:left|right|(?:padding|margin|border)-(?:left|right))\s*:/;

describe('ActionChip — cannot be compressed into its own Hebrew label', () => {
  /**
   * THE BUG THIS PINS: the chip row overflows its 362px container at a 390px
   * viewport. The chips used to inherit `flex-shrink: 1`, so the browser took
   * the deficit out of their padding boxes while `white-space: nowrap` held the
   * label at full width. The label then painted outside its own box and the
   * scroller clipped it — the app owner saw "כלים" render as "כליב", the final
   * ם sliced vertically, measured 2.97px past the row's end (left, in RTL) edge.
   *
   * A chip must keep its intrinsic width and let the ROW scroll instead.
   */
  it('refuses to shrink, so its label can never be clipped mid-glyph', () => {
    render(<ActionChip icon={<Icon />} label="כלים" onClick={() => {}} ariaLabel="tools" />);

    const chip = screen.getByRole('button', { name: 'tools' });

    expect(chip.style.flexShrink).toBe('0');
    // Belt and braces: nowrap without flex-shrink: 0 is exactly the combination
    // that painted text outside the box.
    expect(chip.style.whiteSpace).toBe('nowrap');
  });

  it('keeps the label on one line rather than wrapping it out of the pill', () => {
    render(<ActionChip icon={<Icon />} label="תרגיל חלופי" onClick={() => {}} ariaLabel="swap" />);

    expect(screen.getByRole('button', { name: 'swap' }).style.whiteSpace).toBe('nowrap');
  });
});

describe('ActionChip — 44px touch floor in BOTH dimensions', () => {
  it('labelled chip is at least 44px tall', () => {
    render(<ActionChip icon={<Icon />} label="הוסף סט" onClick={() => {}} ariaLabel="add set" />);

    expect(screen.getByRole('button', { name: 'add set' }).style.minHeight).toBe('44px');
  });

  /**
   * An icon-only chip measures 12px + 14px + 12px of content and padding plus
   * 2px of border = 40px wide. Height alone was constrained, so the undo chip
   * shipped as a 40px-wide target — under the floor this surface holds to.
   */
  it('icon-only chip is at least 44px in width as well as height', () => {
    render(<ActionChip icon={<Icon />} onClick={() => {}} ariaLabel="undo" />);

    const chip = screen.getByRole('button', { name: 'undo' });

    expect(chip.style.minHeight).toBe('44px');
    expect(chip.style.minWidth).toBe('44px');
  });

  it('does not force a min-width on a labelled chip, which is already wider', () => {
    render(<ActionChip icon={<Icon />} label="מאמן AI" onClick={() => {}} ariaLabel="coach" />);

    expect(screen.getByRole('button', { name: 'coach' }).style.minWidth).toBe('');
  });
});

describe('ActionChip — RTL safety', () => {
  it('introduces no physical inline-axis property on the chip or its dot', () => {
    const { container } = render(
      <ActionChip icon={<Icon />} label="כלים" onClick={() => {}} ariaLabel="tools" dot />
    );

    const chip = screen.getByRole('button', { name: 'tools' });
    const dot = container.querySelector('span[aria-hidden]');

    expect(chip.getAttribute('style') ?? '').not.toMatch(PHYSICAL_INLINE_PROPERTY);
    expect(dot).not.toBeNull();
    // The dot is absolutely positioned, so it is the likeliest place for a
    // `right: 4px` to creep in. It must stay on inset-inline-end.
    expect(dot?.getAttribute('style') ?? '').not.toMatch(PHYSICAL_INLINE_PROPERTY);
    expect(dot?.getAttribute('style') ?? '').toContain('inset-inline-end');
  });

  it('aligns to the start of the scroll port when the row snaps', () => {
    render(<ActionChip icon={<Icon />} label="כלים" onClick={() => {}} ariaLabel="tools" />);

    // `start` is a logical keyword: the right edge in RTL, the left in LTR.
    expect(screen.getByRole('button', { name: 'tools' }).style.scrollSnapAlign).toBe('start');
  });
});
