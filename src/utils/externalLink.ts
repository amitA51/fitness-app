// ============================================================================
// EXTERNAL LINK — open a URL correctly on web AND native.
//
// On the web: window.open in a new tab. On native (Capacitor): the in-app
// Browser plugin (so links like /legal/* or mailto open per store guidelines
// instead of being swallowed by the WebView). Dep-free — uses the runtime
// plugin registry, so no @capacitor/browser import is required for the web build.
// ============================================================================

import { getCapacitorPlugin, isNativePlatform } from './platform';

interface CapacitorBrowserPlugin {
  open(options: { url: string }): Promise<void>;
}

/** Open an external (or full-origin) URL appropriately for the platform. */
export async function openExternalLink(url: string): Promise<void> {
  if (isNativePlatform()) {
    const browser = getCapacitorPlugin<CapacitorBrowserPlugin>('Browser');
    if (browser?.open) {
      await browser.open({ url });
      return;
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
