/**
 * ============================================================================
 * SPARKOS FITNESS - Theme Context
 * מערכת נושאים עם Accent Colors לכל מסך
 * ============================================================================
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

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

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryGlow: string;
  gradient?: {
    from: string;
    to: string;
  };
}

export interface PageTheme {
  accent: PageAccent;
  colors: ThemeColors;
  mood: 'energetic' | 'calm' | 'focused';
}

// ============================================================================
// ACCENT COLOR CONFIGURATIONS
// ============================================================================

const PAGE_THEMES: Record<PageAccent, PageTheme> = {
  dashboard: {
    accent: 'dashboard',
    colors: {
      primary: '#3B82F6', // Electric Blue
      primaryHover: '#2563EB',
      primaryGlow: 'rgba(59, 130, 246, 0.35)',
      gradient: {
        from: '#3B82F6',
        to: '#6366F1',
      },
    },
    mood: 'energetic',
  },
  workout: {
    accent: 'workout',
    colors: {
      primary: '#8B5CF6', // Purple - Dramatic
      primaryHover: '#7C3AED',
      primaryGlow: 'rgba(139, 92, 246, 0.35)',
      gradient: {
        from: '#8B5CF6',
        to: '#EC4899', // Pink accent
      },
    },
    mood: 'focused',
  },
  nutrition: {
    accent: 'nutrition',
    colors: {
      primary: '#22C55E', // Green - Health
      primaryHover: '#16A34A',
      primaryGlow: 'rgba(34, 197, 94, 0.35)',
      gradient: {
        from: '#22C55E',
        to: '#4ADE80',
      },
    },
    mood: 'calm',
  },
  history: {
    accent: 'history',
    colors: {
      primary: '#06B6D4', // Cyan - Info
      primaryHover: '#0891B2',
      primaryGlow: 'rgba(6, 182, 212, 0.35)',
      gradient: {
        from: '#06B6D4',
        to: '#38BDF8',
      },
    },
    mood: 'calm',
  },
  progress: {
    accent: 'progress',
    colors: {
      primary: '#F59E0B', // Amber - Achievement
      primaryHover: '#D97706',
      primaryGlow: 'rgba(245, 158, 11, 0.35)',
      gradient: {
        from: '#F59E0B',
        to: '#FBBF24',
      },
    },
    mood: 'energetic',
  },
  templates: {
    accent: 'templates',
    colors: {
      primary: '#A855F7', // Purple - Creative
      primaryHover: '#9333EA',
      primaryGlow: 'rgba(168, 85, 247, 0.35)',
      gradient: {
        from: '#A855F7',
        to: '#C084FC',
      },
    },
    mood: 'focused',
  },
  settings: {
    accent: 'settings',
    colors: {
      primary: '#71717A', // Neutral - Minimal
      primaryHover: '#52525B',
      primaryGlow: 'rgba(113, 113, 122, 0.35)',
    },
    mood: 'calm',
  },
};

// ============================================================================
// CONTEXT
// ============================================================================

interface PageThemeContextValue {
  theme: PageTheme;
  accent: PageAccent;
  isDark: boolean;
  // Utility functions
  getGradientClass: () => string;
  getGlowClass: () => string;
}

const PageThemeContext = createContext<PageThemeContextValue | null>(null);

const PAGE_THEME_FALLBACK: PageThemeContextValue = {
  theme: PAGE_THEMES.dashboard,
  accent: 'dashboard',
  isDark: true,
  getGradientClass: () => '',
  getGlowClass: () => '0 0 20px rgba(59, 130, 246, 0.35)',
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface PageThemeProviderProps {
  children: ReactNode;
  page: PageAccent;
}

export function PageThemeProvider({ children, page }: PageThemeProviderProps) {
  const theme = PAGE_THEMES[page];

  const value = useMemo<PageThemeContextValue>(
    () => ({
      theme,
      accent: page,
      isDark: true, // Always dark for this app
      getGradientClass: () => '',
      getGlowClass: () => {
        return `0 0 20px ${theme.colors.primaryGlow}`;
      },
    }),
    [page, theme]
  );

  // Apply CSS variables for this page's accent - batch DOM mutations
  React.useEffect(() => {
    const root = document.documentElement;

    // Batch all style changes together
    const styles: [string, string][] = [
      ['--accent-current', theme.colors.primary],
      ['--accent-current-hover', theme.colors.primaryHover],
      ['--accent-current-glow', theme.colors.primaryGlow],
      ['--dynamic-accent-start', theme.colors.primary],
      ['--dynamic-accent-glow', theme.colors.primaryGlow],
      ['--bg-primary', theme.colors.primary],
    ];

    if (theme.colors.gradient) {
      styles.push(
        ['--accent-gradient-from', theme.colors.gradient.from],
        ['--accent-gradient-to', theme.colors.gradient.to],
        ['--dynamic-accent-end', theme.colors.gradient.to]
      );
    }

    // Use setProperty for individual vars to avoid cssText accumulation
    for (const [prop, val] of styles) {
      root.style.setProperty(prop, val);
    }

    // Update page class
    const pageClass = `page-${page}`;
    if (!root.classList.contains(pageClass)) {
      root.classList.remove(
        'page-dashboard',
        'page-workout',
        'page-nutrition',
        'page-history',
        'page-progress',
        'page-templates',
        'page-settings'
      );
      root.classList.add(pageClass);
    }
  }, [page, theme]);

  return <PageThemeContext.Provider value={value}>{children}</PageThemeContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePageTheme(): PageThemeContextValue {
  const context = useContext(PageThemeContext);
  return context ?? PAGE_THEME_FALLBACK;
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Get the current page's primary color
 */
export function useAccentColor(): string {
  const { theme } = usePageTheme();
  return theme.colors.primary;
}

/**
 * Get gradient class for the current page
 */
export function useAccentGradient(): string {
  const { theme } = usePageTheme();
  if (!theme.colors.gradient) {
    return `bg-[${theme.colors.primary}]`;
  }
  return `bg-gradient-to-r from-[${theme.colors.gradient.from}] to-[${theme.colors.gradient.to}]`;
}

/**
 * Check if current page mood is energetic
 */
export function useIsEnergetic(): boolean {
  const { theme } = usePageTheme();
  return theme.mood === 'energetic';
}

/**
 * Check if current page mood is calm
 */
export function useIsCalm(): boolean {
  const { theme } = usePageTheme();
  return theme.mood === 'calm';
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PAGE_THEMES };
