// ============================================================================
// SettingsPrimitives Toggle — the switch visual IS the shared component
// ============================================================================
// The in-workout settings sheet hand-rolled this switch. Two defects, and the
// first one is an RTL bug rather than a colour one:
//
//   D1  the knob was placed with a physical `left: 2` and animated with a
//       physical framer-motion `x` transform. Neither responds to the writing
//       mode, so under `<html dir="rtl">` this switch rested on the wrong side
//       and travelled the OPPOSITE way from every other switch in the app for
//       the same state change. The shared component uses `insetInlineStart`,
//       which flips for free.
//   D2  the knob was hardcoded to --fs-surface in BOTH states. OFF in dark that
//       is #111111 on a #262626 track = 1.25:1, inside a --fs-steel #2a2a2a
//       outline that is 1.05:1 on that same track — the whole OFF control was a
//       featureless blob. The shared knob follows its fill (--fs-ink OFF,
//       --fs-surface ON) behind a 2px --fs-ink edge.
//
// The row is still the tap target. It is a <label> now instead of a <button>,
// because the switch itself is a real <button role="switch"> and buttons cannot
// nest; label activation forwards a click from anywhere in the row to the
// control, which is both wider than 44px and keyboard-reachable on the switch.
//
// These assertions pin the shared component's SIGNATURE here — the 44x44 box,
// the 52x32 inner track, `insetInlineStart` for knob travel, the per-state knob
// token, and a fill from the shared module's own exported `trackBackground` — so
// a re-hand-rolled copy fails even with the corrected colours pasted in.
// ============================================================================

import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackBackground } from '../../../ui/SettingsToggle';
import { Toggle } from '../SettingsPrimitives';

/** The switch — the only `role="switch"` a Toggle row renders. */
const switchOf = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('button[role="switch"]');
  if (!el) throw new Error('switch not found');
  return el;
};

/** The shared component's inner visual: [0] = track, [1] = knob. */
const partsOf = (container: HTMLElement): { track: HTMLElement; knob: HTMLElement } => {
  const visual = switchOf(container).querySelector<HTMLElement>('span[aria-hidden="true"]');
  if (!visual) throw new Error('visual track wrapper not found — switch is not SettingsToggle');
  const [track, knob] = Array.from(visual.children) as HTMLElement[];
  if (!track || !knob) throw new Error('track/knob not found');
  return { track, knob };
};

/** jsdom may expose an inline fill as shorthand, longhand, or only on the style
 *  attribute — and normalizes hex to rgb(). Accept any form. */
const fillOf = (el: HTMLElement): string =>
  `${el.style.background} ${el.style.backgroundColor} ${el.getAttribute('style') ?? ''}`;

const renderToggle = (value: boolean, onChange = vi.fn()) => ({
  ...render(
    <Toggle
      label="רטט"
      description="משוב רטט בלחיצות ובסיום סט/מנוחה"
      value={value}
      onChange={onChange}
    />
  ),
  onChange,
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('SettingsPrimitives Toggle uses the shared SettingsToggle', () => {
  it('renders the shared 44x44 box around a 52x32 track (the copy was 50x30)', () => {
    const { container } = renderToggle(false);
    const button = switchOf(container);

    // Read the CSS box, not the painted track: the shared button adds no border
    // width and no padding, so the 44px minima ARE the target. jsdom drops
    // `border: 'none'` from the shorthand, so assert zero WIDTH instead.
    expect(button.style.minWidth).toBe('44px');
    expect(button.style.minHeight).toBe('44px');
    expect(Number.parseFloat(button.style.borderWidth || '0')).toBe(0);
    expect(Number.parseFloat(button.style.padding || '0')).toBe(0);

    const visual = button.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(visual?.style.width).toBe('52px');
    expect(visual?.style.height).toBe('32px');
    // The copy was a 50x30 div with a 1px --fs-steel outline and no inner track.
    expect(partsOf(container).track.style.border).toBe('2px solid var(--fs-ink)');
    expect(fillOf(partsOf(container).track)).not.toContain('--fs-steel');
  });

  it('travels on insetInlineStart, never on physical left or an x transform (D1)', () => {
    const { container: off } = renderToggle(false);
    const offKnob = partsOf(off).knob;

    expect(offKnob.style.insetInlineStart).toBe('4px');
    // The copy pinned `left: 2` and animated `x: 21` — both physical, so in RTL
    // the knob started on the wrong edge and moved the wrong way.
    expect(offKnob.style.left).toBe('');
    expect(offKnob.style.transform).toBe('');

    const { container: on } = renderToggle(true);
    const onKnob = partsOf(on).knob;
    expect(onKnob.style.insetInlineStart).toBe('24px');
    expect(onKnob.style.left).toBe('');
    expect(onKnob.style.transform).toBe('');
    // The transition animates the logical property, not a transform.
    expect(onKnob.style.transition).toContain('inset-inline-start');
  });

  it('uses the canonical OFF knob --fs-ink — the copy stayed --fs-surface (D2)', () => {
    const { container } = renderToggle(false);

    const knob = fillOf(partsOf(container).knob);
    expect(knob).toContain('var(--fs-ink)');
    // --fs-surface on the OFF fill was 1.25:1 in dark.
    expect(knob).not.toContain('var(--fs-surface)');
  });

  it('uses the canonical ON knob --fs-surface on the mint fill', () => {
    const { container } = renderToggle(true);

    expect(fillOf(partsOf(container).knob)).toContain('var(--fs-surface)');
  });

  it('takes its track fill from the shared module\u2019s trackBackground', () => {
    const { container: off } = renderToggle(false);
    expect(fillOf(partsOf(off).track)).toContain(trackBackground(false, false));

    const { container: on } = renderToggle(true);
    expect(fillOf(partsOf(on).track)).toContain(trackBackground(true, false));
  });

  it('follows the shared dark ON fill when html.dark is set', () => {
    document.documentElement.classList.add('dark');
    const { container } = renderToggle(true);

    // A copy hardcoding var(--fs-accent) would paint the bright #4ddcbb here.
    const fill = fillOf(partsOf(container).track);
    expect(fill.includes(trackBackground(true, true)) || fill.includes('rgb(49, 141, 120)')).toBe(
      true
    );
  });

  it('keeps the whole row as the tap target, firing exactly once per tap', () => {
    const onChange = vi.fn();
    const { container } = renderToggle(false, onChange);

    const row = container.querySelector('label');
    if (!row) throw new Error('row is not a <label> — the full-row tap target is gone');

    // A tap on the row's text: label activation forwards it to the switch.
    fireEvent.click(row.querySelector('span') as HTMLElement);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    // A tap on the switch itself must NOT also re-trigger via the label.
    fireEvent.click(switchOf(container));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the row\u2019s own label, description and switch state', () => {
    const { container } = renderToggle(true);

    expect(container.textContent).toContain('רטט');
    expect(container.textContent).toContain('משוב רטט בלחיצות ובסיום סט/מנוחה');

    const button = switchOf(container);
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('רטט');
  });
});
