// ============================================================================
// ToggleSwitch — dark-mode contrast regression tests
// ============================================================================
// Three separate passes each fixed one dark-mode contrast defect in this file and
// left a sibling broken, because --fs-primary appears in more than one place and
// does NOT invert (#16292d light -> #0a0a0a dark). These tests pin all three
// call sites at once so the next pass cannot re-open one of them:
//
//   1. the track border   was var(--fs-primary)  -> 1.31:1 on the OFF fill
//   2. the ON label       was var(--fs-primary)  -> 1.05:1 on the card
//   3. the knob on the ON track                  -> 1.50:1 (fixed via the track)
// ============================================================================

import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import ToggleSwitch, { trackBackgroundColor } from '../ToggleSwitch';

/** Flush the MutationObserver callback that useIsDarkTheme subscribes with. */
const setTheme = async (dark: boolean) => {
  await act(async () => {
    document.documentElement.classList.toggle('dark', dark);
    // MutationObserver callbacks are microtask-scheduled.
    await Promise.resolve();
  });
};

const trackOf = (container: HTMLElement): HTMLElement => {
  const track = container.querySelector<HTMLElement>('input + div');
  if (!track) throw new Error('track element not found');
  return track;
};

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ToggleSwitch dark-mode contrast', () => {
  describe('track border (defect 1)', () => {
    it('uses the inverting --fs-ink, never the non-inverting --fs-primary', () => {
      const { container } = render(<ToggleSwitch checked={false} onChange={() => {}} />);

      const border = trackOf(container).style.border;
      expect(border).toBe('1px solid var(--fs-ink)');
      expect(border).not.toContain('--fs-primary');
    });

    it('keeps the border when checked, so the ON track still has an edge', () => {
      const { container } = render(<ToggleSwitch checked onChange={() => {}} />);

      expect(trackOf(container).style.border).toBe('1px solid var(--fs-ink)');
    });
  });

  describe('optional label (defect 2)', () => {
    it('uses --fs-ink when ON — --fs-primary made it vanish in dark', () => {
      render(<ToggleSwitch checked onChange={() => {}} label="מנוחה אוטומטית" />);

      const label = screen.getByText('מנוחה אוטומטית');
      expect(label.style.color).toBe('var(--fs-ink)');
      expect(label.style.color).not.toContain('--fs-primary');
    });

    it('uses --fs-muted when OFF', () => {
      render(<ToggleSwitch checked={false} onChange={() => {}} label="מנוחה אוטומטית" />);

      expect(screen.getByText('מנוחה אוטומטית').style.color).toBe('var(--fs-muted)');
    });

    it('stays visible across a theme flip while mounted', async () => {
      render(<ToggleSwitch checked onChange={() => {}} label="מנוחה אוטומטית" />);

      await setTheme(true);
      // --fs-ink is theme-inverting, so the ON label needs no per-theme branch.
      expect(screen.getByText('מנוחה אוטומטית').style.color).toBe('var(--fs-ink)');
    });
  });

  describe('checked track fill (defect 3)', () => {
    it('is the resting mint token in light mode', () => {
      expect(trackBackgroundColor(true, false)).toBe('var(--fs-accent)');
    });

    it('is a deeper mint in dark mode, so the --fs-ink knob clears 3:1', () => {
      // #4ddcbb with every channel scaled 0.64 — same hue and saturation, lower
      // value. Bright #4ddcbb left the knob at 1.50:1; this gives 3.54:1.
      expect(trackBackgroundColor(true, true)).toBe('#318d78');
    });

    it('is not a third accent hue — it is --fs-accent scaled per channel', () => {
      const dark = trackBackgroundColor(true, true).replace('#', '');
      const channel = (i: number) => Number.parseInt(dark.slice(i, i + 2), 16);
      const [r, g, b] = [channel(0), channel(2), channel(4)];
      // --fs-accent in dark = #4ddcbb
      const [ar, ag, ab] = [77, 220, 187];

      // Channel ratios are preserved => hue and saturation are unchanged.
      expect(r / g).toBeCloseTo(ar / ag, 2);
      expect(b / g).toBeCloseTo(ab / ag, 2);
      // ...and the value genuinely dropped.
      expect(g).toBeLessThan(ag);
    });

    it('uses the same OFF fill in both themes', () => {
      expect(trackBackgroundColor(false, false)).toBe('var(--fs-surface-2)');
      expect(trackBackgroundColor(false, true)).toBe('var(--fs-surface-2)');
    });
  });

  describe('theme reactivity', () => {
    it('re-resolves the track fill when html.dark is toggled while mounted', async () => {
      const { container } = render(<ToggleSwitch checked onChange={() => {}} />);

      expect(trackOf(container).style.backgroundColor).toBe('var(--fs-accent)');

      await setTheme(true);
      expect(trackOf(container).style.backgroundColor).toBe('rgb(49, 141, 120)');

      await setTheme(false);
      expect(trackOf(container).style.backgroundColor).toBe('var(--fs-accent)');
    });

    it('picks up a theme that was already set before mount', () => {
      document.documentElement.classList.add('dark');
      const { container } = render(<ToggleSwitch checked onChange={() => {}} />);

      expect(trackOf(container).style.backgroundColor).toBe('rgb(49, 141, 120)');
    });
  });
});
