/**
 * ============================================================================
 * STUB - Theme system removed
 * ============================================================================
 */

export interface ThemeVariable {
  name: string;
  accentColor: string;
  backgroundColor: string;
}

export const THEME_PRESETS = ['dark', 'light'] as const;

export const WORKOUT_THEMES = [
  {
    id: 'deepCosmos',
    name: 'Deep Cosmos',
    colors: { primary: '#2C7F91', secondary: '#43C7A5', accent: '#16292D' },
  },
  {
    id: 'fireEnergy',
    name: 'Fire Energy',
    colors: { primary: '#E26E3F', secondary: '#D6453D', accent: '#fbbf24' },
  },
  {
    id: 'neonPulse',
    name: 'Neon Pulse',
    colors: { primary: '#16292D', secondary: '#43C7A5', accent: '#2C7F91' },
  },
  {
    id: 'oceanWave',
    name: 'Ocean Wave',
    colors: { primary: '#2C7F91', secondary: '#16292D', accent: '#B9C8C6' },
  },
  {
    id: 'forestGrove',
    name: 'Forest Grove',
    colors: { primary: '#43C7A5', secondary: '#16292D', accent: '#eab308' },
  },
];

export function getThemeVariables(_themeName: string): Record<string, string> {
  return {};
}
