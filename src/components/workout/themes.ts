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
  { id: 'deepCosmos', name: 'Deep Cosmos', colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#22d3ee' } },
  { id: 'fireEnergy', name: 'Fire Energy', colors: { primary: '#f97316', secondary: '#ef4444', accent: '#fbbf24' } },
  { id: 'neonPulse', name: 'Neon Pulse', colors: { primary: '#22d3ee', secondary: '#a855f7', accent: '#f472b6' } },
  { id: 'oceanWave', name: 'Ocean Wave', colors: { primary: '#0ea5e9', secondary: '#06b6d4', accent: '#14b8a6' } },
  { id: 'forestGrove', name: 'Forest Grove', colors: { primary: '#22c55e', secondary: '#16a34a', accent: '#eab308' } },
];

export function getThemeVariables(_themeName: string): Record<string, string> {
  return {};
}
