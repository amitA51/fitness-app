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
// One distinct, harmonious jewel-tone accent per route.
// ============================================================================

const PAGE_THEMES: Record<PageAccent, ThemeColors> = {
  // Home / signature — Fresh Steel mint teal
  dashboard: {
    primary: '#43C7A5',
    primaryHover: '#3AB595',
    primaryGlow: 'rgba(67, 199, 165, 0.35)',
    gradient: { from: '#43C7A5', to: '#2C7F91' },
  },
  // Focused, intense — steel blue
  workout: {
    primary: '#4F8DF5',
    primaryHover: '#3D77DB',
    primaryGlow: 'rgba(79, 141, 245, 0.35)',
    gradient: { from: '#4F8DF5', to: '#3A5BD9' },
  },
  // Fresh, nourishing — leaf green
  nutrition: {
    primary: '#56C271',
    primaryHover: '#46A95F',
    primaryGlow: 'rgba(86, 194, 113, 0.35)',
    gradient: { from: '#56C271', to: '#2F8F6B' },
  },
  // Calm, retrospective — muted slate blue
  history: {
    primary: '#7E91B5',
    primaryHover: '#677CA0',
    primaryGlow: 'rgba(126, 145, 181, 0.35)',
    gradient: { from: '#7E91B5', to: '#56688A' },
  },
  // Energetic growth — violet
  progress: {
    primary: '#8A75E8',
    primaryHover: '#735ED4',
    primaryGlow: 'rgba(138, 117, 232, 0.35)',
    gradient: { from: '#8A75E8', to: '#6246C9' },
  },
  // Building blocks — warm amber
  templates: {
    primary: '#E2A23F',
    primaryHover: '#C9892A',
    primaryGlow: 'rgba(226, 162, 63, 0.35)',
    gradient: { from: '#E2A23F', to: '#C0791E' },
  },
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
