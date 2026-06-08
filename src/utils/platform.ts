// ============================================================================
// PLATFORM DETECTION — web vs native (Capacitor) without a build-time dep.
//
// Detects the Capacitor runtime via the injected `window.Capacitor` global, so
// the web PWA build needs NO @capacitor/* package installed. Once the app is
// wrapped with Capacitor (ios/ + android/ projects, built on macOS/CI), these
// return the real platform and expose native plugins. On the web they are inert.
// ============================================================================

export type AppPlatform = 'ios' | 'android' | 'web';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside a Capacitor native shell (iOS/Android). False on the web. */
export function isNativePlatform(): boolean {
  return capacitor()?.isNativePlatform?.() ?? false;
}

export function getPlatform(): AppPlatform {
  const p = capacitor()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/** Returns a registered Capacitor plugin by name, or undefined on the web. */
export function getCapacitorPlugin<T>(name: string): T | undefined {
  const plugins = capacitor()?.Plugins as Record<string, T> | undefined;
  return plugins?.[name];
}
