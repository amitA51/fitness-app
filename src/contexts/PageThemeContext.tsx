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
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'energetic',
  },
  workout: {
    accent: 'workout',
    colors: {
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'focused',
  },
  nutrition: {
    accent: 'nutrition',
    colors: {
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'calm',
  },
  history: {
    accent: 'history',
    colors: {
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'calm',
  },
  progress: {
    accent: 'progress',
    colors: {
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'energetic',
  },
  templates: {
    accent: 'templates',
    colors: {
      primary: '#43C7A5', // Fresh Steel Mint Teal
      primaryHover: '#3AB595',
      primaryGlow: 'rgba(67, 199, 165, 0.35)',
      gradient: {
        from: '#43C7A5',
        to: '#2C7F91',
      },
    },
    mood: 'focused',
  },
  settings: {
    accent: 'settings',
    colors: {
      primary: '#16292D', // Fresh Steel Dark Primary
      primaryHover: '#0F1C1F',
      primaryGlow: 'rgba(22, 41, 45, 0.35)',
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
  isDark: false,
  getGradientClass: () => '',
  getGlowClass: () => '0 0 20px rgba(67, 199, 165, 0.35)',
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
      isDark: false, // Fresh Steel light mode default
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
