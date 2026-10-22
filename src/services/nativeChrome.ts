// ============================================================================
// Native status bar — follows the app's light / dark theme
// ============================================================================
// In the Capacitor shells the system status bar is drawn over the app. Its
// text must stay readable: light text on the dark theme, dark text on the
// light one. The theme is the `dark` class on <html> (ThemeProvider), so the
// bar is set once at boot and again whenever that class changes.
// ============================================================================

import { logger } from '../utils/logger';
import { isNativePlatform, loadCapacitorPlugin } from '../utils/platform';

/** @capacitor/status-bar's Style: DARK = light text, for dark backgrounds. */
type StatusBarStyle = 'DARK' | 'LIGHT';

interface StatusBarPlugin {
  setStyle(options: { style: StatusBarStyle }): Promise<void>;
}

export const statusBarStyleFor = (isDarkTheme: boolean): StatusBarStyle =>
  isDarkTheme ? 'DARK' : 'LIGHT';

let installed = false;

export async function installNativeChrome(): Promise<void> {
  if (installed || !isNativePlatform()) return;
  const statusBar = await loadCapacitorPlugin<StatusBarPlugin>('StatusBar');
  if (!statusBar) return;
  installed = true;

  const root = document.documentElement;
  let current: StatusBarStyle | null = null;
  const apply = () => {
    const style = statusBarStyleFor(root.classList.contains('dark'));
    if (style === current) return;
    current = style;
    statusBar.plugin.setStyle({ style }).catch((err: unknown) => {
      logger.ui.warn('Status bar style failed', err);
    });
  };

  apply();
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] });
}
