// Unit tests for the pure route-shell helpers added to AppRouter:
//   • pageLoaderVariant — maps a path to its lazy-fallback silhouette family
//   • routeSlideOffset   — RTL- and direction-aware route-transition offset
// These are pure functions (no React), so they're tested directly.

import { afterEach, describe, expect, it } from 'vitest';
import { pageLoaderVariant, routeSlideOffset } from '../AppRouter';

describe('pageLoaderVariant', () => {
  it('maps detail/thread routes to the detail silhouette', () => {
    expect(pageLoaderVariant('/detail/abc')).toBe('detail');
    expect(pageLoaderVariant('/workout/template-1')).toBe('detail');
    expect(pageLoaderVariant('/coach/clients/123')).toBe('detail');
    expect(pageLoaderVariant('/u/some-user')).toBe('detail');
  });

  it('maps list/roster routes to the list silhouette', () => {
    expect(pageLoaderVariant('/progress')).toBe('list');
    expect(pageLoaderVariant('/templates')).toBe('list');
    expect(pageLoaderVariant('/community')).toBe('list');
    expect(pageLoaderVariant('/coach/clients')).toBe('list');
    expect(pageLoaderVariant('/my-coach')).toBe('list');
  });

  it('prefers the more-specific detail shape over its list parent', () => {
    // /coach/clients is a list, but /coach/clients/:id is a detail — the detail
    // prefix is checked first so a client detail opens with a hero block.
    expect(pageLoaderVariant('/coach/clients/42')).toBe('detail');
  });

  it('falls back to the default silhouette for everything else', () => {
    expect(pageLoaderVariant('/')).toBe('default');
    expect(pageLoaderVariant('/nutrition')).toBe('default');
    expect(pageLoaderVariant('/settings')).toBe('default');
  });
});

describe('routeSlideOffset', () => {
  const originalDir = document.dir;
  afterEach(() => {
    document.dir = originalDir;
  });

  it('enters from the inline-end on forward nav, inline-start on back (LTR)', () => {
    document.dir = 'ltr';
    expect(routeSlideOffset(false)).toBeGreaterThan(0); // forward → from the right
    expect(routeSlideOffset(true)).toBeLessThan(0); // back → from the left
  });

  it('mirrors the sign for RTL so the gesture reads the same physically', () => {
    document.dir = 'rtl';
    expect(routeSlideOffset(false)).toBeLessThan(0); // forward → from the (RTL) inline-end
    expect(routeSlideOffset(true)).toBeGreaterThan(0); // back → inverted
  });

  it('back is always the exact inverse of forward', () => {
    document.dir = 'rtl';
    expect(routeSlideOffset(true)).toBe(-routeSlideOffset(false));
    document.dir = 'ltr';
    expect(routeSlideOffset(true)).toBe(-routeSlideOffset(false));
  });
});
