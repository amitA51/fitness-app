// ============================================================================
// SettingsRow — icon tile shape regression tests
// ============================================================================
// SettingsRow paints its OWN 32x32 icon tile around whatever `icon` it is
// given: same size, same --fs-surface-2 fill and --fs-heading ink as
// settings/components/IconBox — but it shipped with NO borderRadius, i.e. a
// square.
//
// The symptom was NOT a two-tone corner: both boxes paint the same fill, so
// their union is just the square. The actual damage is that a nested IconBox's
// 12px rounding was entirely defeated — every row routed through SettingsRow
// rendered a square tile, whether the caller wrapped its icon or not. Five
// settings sections forked the row's whole class string purely to get a
// rounded tile back.
//
// The fix is one line: borderRadius: 12 on SettingsRow's own tile. With the
// radii matching, a nested IconBox paints pixel-identically to the outer tile
// (same size, fill, ink AND radius) so the nesting is harmless, and a caller
// passing a BARE icon finally gets a correctly rounded tile.
//
// These tests pin the radius so the square cannot come back, and pin the rest
// of the row so the fix stayed a one-liner.
// ============================================================================

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// Imported deliberately: the defect WAS a divergence between these two radii,
// so the test compares them rather than hardcoding 12 in one place only.
import { IconBox } from '../../../pages/settings/components/IconBox';
import { SettingsRow } from '../SettingsRow';

/** SettingsRow's own icon tile — the outer 32x32 box, first in document order. */
const tileOf = (container: HTMLElement): HTMLElement => {
  const tile = container.querySelector<HTMLElement>('.w-8.h-8');
  if (!tile) throw new Error('icon tile not found');
  return tile;
};

/** The horizontal padded row that carries the 52px min-height. */
const barOf = (container: HTMLElement): HTMLElement => {
  const bar = container.querySelector<HTMLElement>('.min-h-\\[52px\\]');
  if (!bar) throw new Error('row bar not found');
  return bar;
};

describe('SettingsRow icon tile radius (the defect)', () => {
  it('rounds its own tile to 12px — it used to be an unrounded square', () => {
    const { container } = render(
      <SettingsRow icon={<span data-testid="glyph" />} label="מצב כהה">
        <span />
      </SettingsRow>
    );

    expect(tileOf(container).style.borderRadius).toBe('12px');
  });

  it('never leaves the tile radius unset or zero', () => {
    const { container } = render(
      <SettingsRow icon={<span />} label="גיל">
        <span />
      </SettingsRow>
    );

    const { borderRadius } = tileOf(container).style;
    expect(borderRadius).not.toBe('');
    expect(borderRadius).not.toBe('0px');
  });

  it('matches IconBox exactly, so a nested IconBox is redundant not visible', () => {
    const { container: boxOnly } = render(
      <IconBox>
        <span />
      </IconBox>
    );
    const iconBoxRadius = tileOf(boxOnly).style.borderRadius;

    const { container } = render(
      <SettingsRow icon={<span />} label="טקסט גדול">
        <span />
      </SettingsRow>
    );

    expect(tileOf(container).style.borderRadius).toBe(iconBoxRadius);
  });

  it('gives a BARE icon the same rounded tile an IconBox caller gets', () => {
    const bare = render(
      <SettingsRow icon={<span />} label="התראות">
        <span />
      </SettingsRow>
    );
    const wrapped = render(
      <SettingsRow
        icon={
          <IconBox>
            <span />
          </IconBox>
        }
        label="לוח מאמן"
      >
        <span />
      </SettingsRow>
    );

    expect(tileOf(bare.container).style.borderRadius).toBe(
      tileOf(wrapped.container).style.borderRadius
    );
  });

  it('renders an IconBox nested inside a tile of identical geometry', () => {
    const { container } = render(
      <SettingsRow
        icon={
          <IconBox>
            <span />
          </IconBox>
        }
        label="ניגודיות גבוהה"
      >
        <span />
      </SettingsRow>
    );

    const [outer, inner] = Array.from(container.querySelectorAll<HTMLElement>('.w-8.h-8'));
    expect(inner).toBeTruthy();
    expect(outer?.style.borderRadius).toBe(inner?.style.borderRadius);
    expect(outer?.style.background).toBe(inner?.style.background);
    expect(outer?.style.color).toBe(inner?.style.color);
  });
});

describe('SettingsRow — everything else is unchanged', () => {
  it('keeps the 32px tile and its tokens', () => {
    const { container } = render(
      <SettingsRow icon={<span />} label="משקל">
        <span />
      </SettingsRow>
    );

    const tile = tileOf(container);
    for (const cls of ['w-8', 'h-8', 'shrink-0', 'flex', 'items-center', 'justify-center']) {
      expect(tile.classList.contains(cls)).toBe(true);
    }
    expect(tile.style.background).toBe('var(--fs-surface-2)');
    expect(tile.style.color).toBe('var(--fs-heading)');
  });

  it('keeps the 52px min-height row with logical inline padding', () => {
    const { container } = render(
      <SettingsRow icon={<span />} label="גובה">
        <span />
      </SettingsRow>
    );

    const bar = barOf(container);
    for (const cls of ['min-h-[52px]', 'ps-4', 'pe-4', 'py-3.5', 'gap-3']) {
      expect(bar.classList.contains(cls)).toBe(true);
    }
    // RTL: physical-side padding utilities would break the Hebrew layout.
    for (const cls of Array.from(bar.classList)) {
      expect(cls).not.toMatch(/^p[lr]-/);
    }
  });

  it('draws the divider by default, with a logical inline margin', () => {
    const { container } = render(
      <SettingsRow icon={<span />} label="הדרכה">
        <span />
      </SettingsRow>
    );

    const divider = container.querySelector<HTMLElement>('div[style*="height"]');
    expect(divider?.style.height).toBe('1px');
    expect(divider?.style.background).toBe('var(--fs-surface-2)');
    expect(divider?.getAttribute('style')).toContain('margin-inline');
  });

  it('omits the divider when divider={false}', () => {
    const { container } = render(
      <SettingsRow icon={<span />} label="הדרכה" divider={false}>
        <span />
      </SettingsRow>
    );

    expect(container.querySelector('div[style*="height"]')).toBeNull();
  });

  it('holds the prop contract: optional icon, rendered label and children', () => {
    const { container, getByText } = render(
      <SettingsRow label="אימייל">
        <span>value</span>
      </SettingsRow>
    );

    // No icon passed -> no tile at all, callers are not forced to wrap.
    expect(container.querySelector('.w-8.h-8')).toBeNull();
    expect(getByText('אימייל')).toBeTruthy();
    expect(getByText('value')).toBeTruthy();
  });
});
