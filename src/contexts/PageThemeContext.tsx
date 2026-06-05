/**
 * ============================================================================
 * SPARKOS FITNESS - Page Theme
 * אקסנט צבע ייחודי לכל מסך
 * ============================================================================
 *
 * Applies a per-route accent palette as CSS custom properties (consumed by
 * AnimatedNumber, glow shadows, gradients, etc.) plus a `page-<name>` class on
 * <html>. Each route gets its own harmonious accent for subtle per-screen
 * identity while staying within the Fresh Steel design language.
 *
 * NOTE: dark mode is owned by SettingsContext (it toggles the `dark` class on
 * <html> from `settings.darkMode`); this module is accent-only.
 */

import React, { type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type PageAccent =
  | 'dashboard'
  | 'workout'
  | 'nutrition'
  | 'history'
  | 'progress'
  | 'templates'
  | 'settings';

interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryGlow: string;
  gradient?: {
    from: string;
    to: string;
  };
}

// ============================================================================
// ACCENT COLOR CONFIGURATIONS
// Per the two-accent system (DESIGN.md): every route resolves to the tokenized
// brand mint (--fs-accent) — never raw off-brand hex — so light (Fresh Steel)
// and dark (Obsidian) both adapt. `settings` keeps its neutral primary token.
// ============================================================================

const ACCENT_THEME: ThemeColors = {
  primary: 'var(--fs-accent)',
  primaryHover: 'var(--color-secondary-hover)',
  primaryGlow: 'var(--color-secondary-glow)',
  gradient: { from: 'var(--fs-accent)', to: 'var(--fs-accent-2)' },
};

const PAGE_THEMES: Record<PageAccent, ThemeColors> = {
  dashboard: ACCENT_THEME,
  workout: ACCENT_THEME,
  nutrition: ACCENT_THEME,
  history: ACCENT_THEME,
  progress: ACCENT_THEME,
  templates: ACCENT_THEME,
  // Neutral, calm — inherits the base brand token
  settings: {
    primary: 'var(--fs-primary)',
    primaryHover: 'var(--color-primary-hover)',
    primaryGlow: 'var(--color-primary-glow)',
  },
};

const PAGE_CLASSES: readonly string[] = [
  'page-dashboard',
  'page-workout',
  'page-nutrition',
  'page-history',
  'page-progress',
  'page-templates',
  'page-settings',
];

// ============================================================================
// PROVIDER
// ============================================================================

interface PageThemeProviderProps {
  children: ReactNode;
  page: PageAccent;
}

export function PageThemeProvider({ children, page }: PageThemeProviderProps) {
  // Apply CSS variables for this page's accent - batch DOM mutations
  React.useEffect(() => {
    const root = document.documentElement;
    const colors = PAGE_THEMES[page];

    const styles: [string, string][] = [
      ['--accent-current', colors.primary],
      ['--accent-current-hover', colors.primaryHover],
      ['--accent-current-glow', colors.primaryGlow],
      ['--dynamic-accent-start', colors.primary],
      ['--dynamic-accent-glow', colors.primaryGlow],
    ];

    if (colors.gradient) {
      styles.push(
        ['--accent-gradient-from', colors.gradient.from],
        ['--accent-gradient-to', colors.gradient.to],
        ['--dynamic-accent-end', colors.gradient.to]
      );
    }

    for (const [prop, val] of styles) {
      root.style.setProperty(prop, val);
    }

    const pageClass = `page-${page}`;
    if (!root.classList.contains(pageClass)) {
      root.classList.remove(...PAGE_CLASSES);
      root.classList.add(pageClass);
    }
  }, [page]);

  return <>{children}</>;
}
