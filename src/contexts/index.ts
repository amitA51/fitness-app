// Contexts barrel export
export {
  SettingsProvider,
  useSettings,
  loadStoredSettings,
  DEFAULT_SETTINGS,
  DEFAULT_WORKOUT_SETTINGS,
} from './SettingsContext';
export { DataProvider, useData } from './DataContext';
export {
  PageThemeProvider,
  usePageTheme,
  useAccentColor,
  useAccentGradient,
  useIsEnergetic,
  useIsCalm,
  PAGE_THEMES,
} from './PageThemeContext';
export type { PageTheme, ThemeColors, PageAccent } from './PageThemeContext';
