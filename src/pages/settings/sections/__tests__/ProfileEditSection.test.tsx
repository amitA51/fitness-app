// ============================================================================
// ProfileEditSection — the פרופיל ציבורי row's switch IS the shared component
// ============================================================================
// This row rendered a bespoke `role="switch"` copy of SettingsToggle. Three
// defects, all of them consequences of the copy rather than of the design:
//
//   D1  the knob tokens were INVERTED against the canonical switch. The copy's
//       ON knob was --color-ink-on-accent (#071412); the shared switch paints
//       --fs-ink (#132327) when OFF. Those two are 1.16:1 apart — one near-black
//       to the eye — so on the Settings screen a dark knob meant OFF on the rows
//       above and ON on this one.
//   D2  52x30. The 30px height was 14px under the 44px touch floor; the shared
//       component wraps the same 52px track in an explicit 44x44 button.
//   D3  `border: 'none'`, so the OFF track fill was its own boundary against the
//       card: --fs-surface-2 #262626 on --fs-surface #111111 = 1.25:1 in dark,
//       under the 3:1 WCAG 1.4.11 asks of a component boundary. The shared
//       component carries a 2px --fs-ink edge (13.28:1 on that same fill).
//
// The assertions below pin the shared component's SIGNATURE at this call site —
// the 44x44 box with no border and no padding, the 52x32 inner track, the
// per-state knob token, and a track fill taken from the shared module's own
// exported `trackBackground` — so a re-hand-rolled copy fails even if someone
// copies the corrected colours into it.
// ============================================================================

import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackBackground } from '../../../../components/ui/SettingsToggle';
import type { ProfilePatch, ProfilePublic } from '../../../../services/profile/types';
import { ProfileEditSection } from '../ProfileEditSection';

const profile = (isPublic: boolean): ProfilePublic => ({
  id: 'u1',
  displayName: 'עמית',
  bio: null,
  avatarUrl: null,
  isPublic,
});

const getMyProfile = vi.fn<[], Promise<ProfilePublic | null>>();
const updateProfile = vi.fn((_patch: ProfilePatch) =>
  Promise.resolve({ error: null as string | null })
);

vi.mock('../../../../services/profile/profileService', () => ({
  getMyProfile: () => getMyProfile(),
  updateProfile: (patch: ProfilePatch) => updateProfile(patch),
  uploadAvatar: vi.fn(async () => ({ url: null, error: 'not used' })),
}));

/** Mount and wait for the async profile load to settle into the ready state. */
const renderSection = async (isPublic: boolean) => {
  getMyProfile.mockResolvedValue(profile(isPublic));
  const view = render(<ProfileEditSection />);
  await waitFor(() => expect(view.container.querySelector('button[role="switch"]')).not.toBeNull());
  return view;
};

/** The visibility switch — the only `role="switch"` in this section. */
const switchOf = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('button[role="switch"]');
  if (!el) throw new Error('visibility switch not found');
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

beforeEach(() => {
  getMyProfile.mockReset();
  updateProfile.mockClear();
  updateProfile.mockResolvedValue({ error: null });
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ProfileEditSection visibility switch uses the shared SettingsToggle', () => {
  it('renders the shared 44x44 box around a 52x32 track (D2 — the copy was 52x30)', async () => {
    const { container } = await renderSection(false);
    const button = switchOf(container);

    // Read the CSS box, not the painted track: the shared button adds no border
    // width and no padding, so the 44px minima ARE the target. jsdom drops
    // `border: 'none'` from the shorthand, so assert zero WIDTH instead.
    expect(button.style.minWidth).toBe('44px');
    expect(button.style.minHeight).toBe('44px');
    expect(Number.parseFloat(button.style.borderWidth || '0')).toBe(0);
    expect(Number.parseFloat(button.style.padding || '0')).toBe(0);
    // The copy set its own 52x30 box on the switch element itself.
    expect(button.style.height).not.toBe('30px');

    const visual = button.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(visual?.style.width).toBe('52px');
    expect(visual?.style.height).toBe('32px');
    // The copy had no inner track element at all — the button WAS the track.
    expect(partsOf(container).track.style.borderRadius).toBe('12px');
  });

  it('carries the shared 2px --fs-ink track edge the copy had no border for (D3)', async () => {
    const { container } = await renderSection(false);

    expect(partsOf(container).track.style.border).toBe('2px solid var(--fs-ink)');
  });

  it('uses the canonical OFF knob --fs-ink, not the copy\u2019s --fs-muted (D1)', async () => {
    const { container } = await renderSection(false);

    const knob = fillOf(partsOf(container).knob);
    expect(knob).toContain('var(--fs-ink)');
    expect(knob).not.toContain('--fs-muted');
  });

  it('uses the canonical ON knob --fs-surface, not the near-black copy (D1)', async () => {
    const { container } = await renderSection(true);

    const knob = fillOf(partsOf(container).knob);
    expect(knob).toContain('var(--fs-surface)');
    // The copy painted #071412 here — 1.16:1 from the shared OFF knob, so a dark
    // knob meant ON on this row and OFF on every other row of the same screen.
    expect(knob).not.toContain('--color-ink-on-accent');
  });

  it('takes its track fill from the shared module\u2019s trackBackground', async () => {
    const { container: off } = await renderSection(false);
    expect(fillOf(partsOf(off).track)).toContain(trackBackground(false, false));

    const { container: on } = await renderSection(true);
    expect(fillOf(partsOf(on).track)).toContain(trackBackground(true, false));
  });

  it('follows the shared dark ON fill when html.dark is set', async () => {
    document.documentElement.classList.add('dark');
    const { container } = await renderSection(true);

    // trackBackground(true, true) is the deeper mint the shared module owns; a
    // copy hardcoding var(--fs-accent) would paint the bright #4ddcbb here.
    const fill = fillOf(partsOf(container).track);
    const expected = trackBackground(true, true);
    expect(fill.includes(expected) || fill.includes('rgb(49, 141, 120)')).toBe(true);
  });

  it('moves the knob with insetInlineStart so it flips under dir="rtl"', async () => {
    const { container: off } = await renderSection(false);
    const offKnob = partsOf(off).knob;
    expect(offKnob.style.insetInlineStart).toBe('4px');
    expect(offKnob.style.left).toBe('');

    const { container: on } = await renderSection(true);
    expect(partsOf(on).knob.style.insetInlineStart).toBe('24px');
  });

  it('keeps the row\u2019s own label, description and state wiring', async () => {
    const { container } = await renderSection(false);

    // Scoped to the row: `פרופיל ציבורי` is also this section's heading.
    const row = switchOf(container).parentElement as HTMLElement;
    expect(row.textContent).toContain('פרופיל ציבורי');
    expect(row.textContent).toContain('כשמופעל, אחרים יכולים לצפות בפרופיל שלך.');

    const button = switchOf(container);
    expect(button.getAttribute('aria-label')).toBe('פרופיל ציבורי');
    expect(button.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      button.click();
    });

    expect(updateProfile).toHaveBeenCalledWith({ isPublic: true });
    expect(switchOf(container).getAttribute('aria-checked')).toBe('true');
  });
});
