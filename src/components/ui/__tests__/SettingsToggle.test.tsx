// ============================================================================
// SettingsToggle — dark-mode contrast regression tests
// ============================================================================
// This is the toggle that actually ships (ThemeSection, NotificationsSection,
// WorkoutPrefsSection). Its track border and OFF knob were both --fs-primary,
// which does NOT invert (#16292d light -> #0a0a0a dark), so in dark they painted
// #0a0a0a on the #262626 OFF track = 1.31:1: no visible edge, no visible knob.
//
// An identical fix once landed on a near-duplicate component that nothing
// rendered, which is why the live defect survived. These tests pin the live one:
//
//   1. track border   was var(--fs-primary)  -> 1.31:1 on the OFF fill (dark)
//   2. OFF knob       was var(--fs-primary)  -> 1.31:1 on the OFF fill (dark)
//   3. ON track fill  a light edge is 1.50:1 on the bright dark mint, so the
//                     dark ON fill drops to #318d78 (accent x 0.64) -> 3.54:1
// ============================================================================

import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsToggle, trackBackground } from '../SettingsToggle';

/** Flush the MutationObserver callback that useIsDarkTheme subscribes with. */
const setTheme = async (dark: boolean) => {
  await act(async () => {
    document.documentElement.classList.toggle('dark', dark);
    // MutationObserver callbacks are microtask-scheduled.
    await Promise.resolve();
  });
};

const partsOf = (container: HTMLElement): { track: HTMLElement; knob: HTMLElement } => {
  const visual = container.querySelector<HTMLElement>('span[aria-hidden="true"]');
  if (!visual) throw new Error('visual track wrapper not found');
  const [track, knob] = Array.from(visual.children) as HTMLElement[];
  if (!track || !knob) throw new Error('track/knob not found');
  return { track, knob };
};

/** jsdom may expose an inline `background` as the shorthand, the longhand, or
 *  only on the style attribute — and normalizes hex to rgb(). Accept any form. */
const fillOf = (el: HTMLElement): string =>
  `${el.style.background} ${el.style.backgroundColor} ${el.getAttribute('style') ?? ''}`;

const expectFill = (el: HTMLElement, ...accepted: string[]) => {
  const actual = fillOf(el);
  expect(accepted.some((form) => actual.includes(form))).toBe(true);
};

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('SettingsToggle dark-mode contrast', () => {
  describe('track border (defect 1)', () => {
    it('uses the inverting --fs-ink, never the non-inverting --fs-primary', () => {
      const { container } = render(
        <SettingsToggle checked={false} onChange={() => {}} label="מצב כהה" />
      );

      const { border } = partsOf(container).track.style;
      expect(border).toBe('2px solid var(--fs-ink)');
      expect(border).not.toContain('--fs-primary');
    });

    it('keeps the border when checked, so the ON track still has an edge', () => {
      const { container } = render(<SettingsToggle checked onChange={() => {}} label="מצב כהה" />);

      expect(partsOf(container).track.style.border).toBe('2px solid var(--fs-ink)');
    });
  });

  describe('knob (defect 2)', () => {
    it('uses --fs-ink when OFF — --fs-primary made it vanish in dark', () => {
      const { container } = render(
        <SettingsToggle checked={false} onChange={() => {}} label="מצב כהה" />
      );

      const { knob } = partsOf(container);
      expectFill(knob, 'var(--fs-ink)');
      expect(fillOf(knob)).not.toContain('--fs-primary');
    });

    it('uses --fs-surface when ON, contrasting the mint fill it sits on', () => {
      const { container } = render(<SettingsToggle checked onChange={() => {}} label="מצב כהה" />);

      expectFill(partsOf(container).knob, 'var(--fs-surface)');
    });
  });

  describe('checked track fill (defect 3)', () => {
    it('is the resting mint token in light mode', () => {
      expect(trackBackground(true, false)).toBe('var(--fs-accent)');
    });

    it('is a deeper mint in dark mode, so the --fs-ink edge clears 3:1', () => {
      // #4ddcbb with every channel scaled 0.64 — same hue and saturation, lower
      // value. Bright #4ddcbb left the edge at 1.50:1; this gives 3.54:1.
      expect(trackBackground(true, true)).toBe('#318d78');
    });

    it('is not a third accent hue — it is --fs-accent scaled per channel', () => {
      const dark = trackBackground(true, true).replace('#', '');
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
      expect(trackBackground(false, false)).toBe('var(--fs-surface-2)');
      expect(trackBackground(false, true)).toBe('var(--fs-surface-2)');
    });
  });

  describe('theme reactivity', () => {
    it('re-resolves the track fill when html.dark is toggled while mounted', async () => {
      const { container } = render(<SettingsToggle checked onChange={() => {}} label="מצב כהה" />);
      const { track } = partsOf(container);

      expectFill(track, 'var(--fs-accent)');

      await setTheme(true);
      expectFill(track, '#318d78', 'rgb(49, 141, 120)');

      await setTheme(false);
      expectFill(track, 'var(--fs-accent)');
    });

    it('picks up a theme that was already set before mount', () => {
      document.documentElement.classList.add('dark');
      const { container } = render(<SettingsToggle checked onChange={() => {}} label="מצב כהה" />);

      expectFill(partsOf(container).track, '#318d78', 'rgb(49, 141, 120)');
    });
  });

  describe('tap target', () => {
    it('keeps the ≥44px target while the visual track stays 52x32', () => {
      const { container } = render(
        <SettingsToggle checked={false} onChange={() => {}} label="מצב כהה" />
      );

      const button = container.querySelector<HTMLElement>('button[role="switch"]');
      expect(button?.style.minWidth).toBe('44px');
      expect(button?.style.minHeight).toBe('44px');

      const visual = container.querySelector<HTMLElement>('span[aria-hidden="true"]');
      expect(visual?.style.width).toBe('52px');
      expect(visual?.style.height).toBe('32px');
    });
  });
});
