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
  /** Injected by the native shell: one header per plugin compiled into the APK. */
  PluginHeaders?: { name: string }[];
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

/** True when the native shell ships a plugin with this name. */
export function hasNativePlugin(name: string): boolean {
  return isNativePlatform() && !!capacitor()?.PluginHeaders?.some((h) => h.name === name);
}

/**
 * The plugin's proxy, registering it on first use. Since Capacitor 3 the native
 * shell only injects plugin HEADERS: `Capacitor.Plugins.X` exists only after
 * `registerPlugin('X')` from @capacitor/core has run, which normally happens when
 * the plugin's JS package is imported. This app imports none, so without this
 * step every `Plugins.X` lookup is undefined inside the APK. @capacitor/core is
 * loaded lazily and only in the native shell — the web bundle stays free of it.
 */
export async function loadCapacitorPlugin<T>(name: string): Promise<{ plugin: T } | undefined> {
  // BOXED on purpose: a Capacitor plugin proxy answers EVERY property — `then`
  // included — so resolving a promise with the bare proxy makes the promise
  // machinery call `proxy.then(...)`, a native call that never settles. Awaiting
  // it would hang forever. `{ plugin }` is not thenable.
  const existing = getCapacitorPlugin<T>(name);
  if (existing) return { plugin: existing };
  if (!hasNativePlugin(name)) return undefined;
  const { registerPlugin } = await import('@capacitor/core');
  return { plugin: registerPlugin<Record<string, unknown>>(name) as unknown as T };
}
