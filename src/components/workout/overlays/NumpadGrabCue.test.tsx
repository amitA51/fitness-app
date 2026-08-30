// T-086: the only cue that a bottom sheet can be dragged was near-invisible.
//
// Two halves, one defect:
//   1. --color-drag-handle (the shared Sheet's 36x4 pill, ui/Sheet.tsx) sat at 0.2
//      alpha and was DECLARED IN ONLY TWO of the three theme blocks. The missing
//      html.high-contrast declaration let light+HC inherit the :root near-black pill
//      onto a black sheet (1.04:1) — which is why this defect spanned four states.
//   2. NumpadOverlay does not use the shared Sheet. Its masthead IS the drag handle
//      (data-sheet-drag-handle) and the gesture works, but nothing advertised it: no
//      pill, and in dark its --fs-primary edge was 1.06:1 on a #000 page.
//
// This file pins both halves. It reads tokens.css as text on purpose: jsdom does not
// resolve cascaded custom properties across html.dark / html.high-contrast, so parsing
// the source is the only way to prove a declaration EXISTS in each block.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';
import { describe, expect, it, vi } from 'vitest';
import NumpadOverlay from './NumpadOverlay';

vi.mock('../../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
}));

vi.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
  useMotionConfigMode: () => 'user',
}));

const TOKENS = readFileSync(join(__dirname, '../../../styles/tokens.css'), 'utf8');

/** Every declaration body belonging to `selector`, joined. tokens.css opens `:root`
 *  several times, so picking one by index would be a coin flip. */
function themeBlock(selector: string): string {
  const bodies: string[] = [];
  const open = `${selector} {`;
  for (let at = TOKENS.indexOf(open); at !== -1; at = TOKENS.indexOf(open, at + 1)) {
    const end = TOKENS.indexOf('\n}', at);
    bodies.push(TOKENS.slice(at + open.length, end === -1 ? undefined : end));
  }
  expect(bodies.length, `no ${selector} block in tokens.css`).toBeGreaterThan(0);
  return bodies.join('\n');
}

function declaration(block: string, token: string): string | null {
  const match = new RegExp(`${token}:\\s*([^;]+);`).exec(block);
  return match?.[1]?.trim() ?? null;
}

function grabber(selector: string): string {
  const value = declaration(themeBlock(selector), '--color-drag-handle');
  expect(value, `--color-drag-handle is not declared in ${selector}`).not.toBeNull();
  return value as string;
}

type Rgba = [number, number, number, number];

/** #rrggbb or rgb()/rgba(). */
function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const fn = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(value);
  expect(fn, `not a colour literal: ${value}`).not.toBeNull();
  const parts = fn as RegExpExecArray;
  return [
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
    parts[4] === undefined ? 1 : Number(parts[4]),
  ];
}

/** Follow `var(--x)` inside the SAME block. A token whose HC value is an alias can
 *  resolve differently in light+HC vs dark+HC when the target is undeclared here, so
 *  a missing target is a failure, not a fallback. */
function resolveInBlock(selector: string, value: string): string {
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  const name = alias?.[1];
  if (!name) return value;
  const target = declaration(themeBlock(selector), name);
  expect(
    target,
    `${value} points at ${name}, which ${selector} does not declare — it would resolve differently in light+HC and dark+HC`
  ).not.toBeNull();
  return target as string;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Composite an rgba over an opaque backdrop, then measure against that backdrop. */
function contrastOn(fg: Rgba, bg: [number, number, number]): number {
  const [r, g, b, a] = fg;
  const flat: [number, number, number] = [
    r * a + bg[0] * (1 - a),
    g * a + bg[1] * (1 - a),
    b * a + bg[2] * (1 - a),
  ];
  const l1 = luminance(flat);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// --fs-surface per state: the SHEET's own fill, which is what the pill sits on.
// Measuring against the page background gives a wrong number in both directions.
const SHEET_FILL_LIGHT: [number, number, number] = [255, 255, 255];
const SHEET_FILL_DARK: [number, number, number] = [17, 17, 17];
// html.high-contrast repaints --fs-surface black in BOTH themes.
const SHEET_FILL_HC: [number, number, number] = [0, 0, 0];

const FLOOR = 3; // WCAG 1.4.11, non-text contrast

describe('T-086 sheet grab cue: --color-drag-handle', () => {
  it('is declared in all THREE theme blocks, not just :root and html.dark', () => {
    expect(grabber(':root')).toBeTruthy();
    expect(grabber('html.dark')).toBeTruthy();
    // The load-bearing one: without it light+HC inherits the :root pill onto black.
    expect(grabber('html.high-contrast')).toBeTruthy();
  });

  it('clears 3:1 on the sheet fill in light', () => {
    expect(contrastOn(parseColor(grabber(':root')), SHEET_FILL_LIGHT)).toBeGreaterThanOrEqual(
      FLOOR
    );
  });

  it('clears 3:1 on the sheet fill in dark', () => {
    expect(contrastOn(parseColor(grabber('html.dark')), SHEET_FILL_DARK)).toBeGreaterThanOrEqual(
      FLOOR
    );
  });

  it('clears 3:1 on the black sheet fill in BOTH high-contrast states', () => {
    // One assertion covers light+HC and dark+HC only because the value resolves
    // inside this block; resolveInBlock fails loudly if that stops being true.
    const value = resolveInBlock('html.high-contrast', grabber('html.high-contrast'));
    expect(contrastOn(parseColor(value), SHEET_FILL_HC)).toBeGreaterThanOrEqual(FLOOR);
  });
});

describe('T-086 numpad grab cue', () => {
  const renderNumpad = (props: Record<string, unknown> = {}) =>
    render(
      <LazyMotion features={domMax}>
        <NumpadOverlay
          isOpen
          target="weight"
          value="60"
          onInput={vi.fn()}
          onSetValue={vi.fn()}
          onDelete={vi.fn()}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />
      </LazyMotion>
    );

  it('renders the shared Sheet 36x4 pill inside the region the gesture listens on', () => {
    renderNumpad({ exerciseName: 'לחיצת חזה' });

    const pill = document.querySelector('[data-numpad-grabber]') as HTMLElement | null;
    expect(pill, 'the numpad renders no grab cue').not.toBeNull();
    expect((pill as HTMLElement).style.width).toBe('36px');
    expect((pill as HTMLElement).style.height).toBe('4px');

    // A cue outside the handle would point at the wrong place.
    const handle = (pill as HTMLElement).closest('[data-sheet-drag-handle]') as HTMLElement | null;
    expect(handle, 'the cue is not inside the drag handle region').not.toBeNull();

    // Part C: both --fs-primary call sites on this surface were invisible in dark
    // (#0a0a0a on a #000 page).
    const sheet = screen.getByRole('dialog').querySelector('.glass-surface-dark') as HTMLElement;
    expect(sheet.style.borderTop).toContain('var(--fs-edge)');
    expect((handle as HTMLElement).style.backgroundColor).toBe('var(--fs-panel)');
  });

  it('leaves the masthead as the drag handle and the keypad intact', () => {
    renderNumpad({ target: 'reps', value: '8' });

    const handle = document.querySelector('[data-sheet-drag-handle]') as HTMLElement;
    expect(handle.style.touchAction).toBe('none');
    expect(handle.style.cursor).toBe('grab');
    // The pill is decorative: the masthead, not the pill, is what you grab.
    expect(
      document.querySelector('[data-numpad-grabber]')?.closest('[aria-hidden="true"]')
    ).not.toBeNull();
    for (const key of ['7', '8', '9', '0']) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument();
    }
  });
});
