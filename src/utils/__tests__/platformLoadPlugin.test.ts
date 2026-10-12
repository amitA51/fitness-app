// loadCapacitorPlugin — since Capacitor 3 the APK injects only plugin HEADERS;
// the proxy exists after registerPlugin(). Without this, every native plugin
// lookup in the app shell returned undefined (reminders, browser, live GPS).
import { afterEach, describe, expect, it, vi } from 'vitest';

const registerPlugin = vi.fn((name: string) => ({ __proxyFor: name }));
vi.mock('@capacitor/core', () => ({ registerPlugin }));

import { hasNativePlugin, loadCapacitorPlugin } from '../platform';

type CapWindow = Window & { Capacitor?: unknown };

function setCapacitor(value: unknown) {
  (window as CapWindow).Capacitor = value;
}

afterEach(() => {
  setCapacitor(undefined);
  registerPlugin.mockClear();
});

describe('loadCapacitorPlugin', () => {
  it('is undefined on the web', async () => {
    expect(await loadCapacitorPlugin('LocalNotifications')).toBeUndefined();
    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it('registers a plugin the APK ships but nothing has registered yet', async () => {
    setCapacitor({
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      PluginHeaders: [{ name: 'BackgroundGeolocation' }],
    });
    expect(hasNativePlugin('BackgroundGeolocation')).toBe(true);
    expect((await loadCapacitorPlugin('BackgroundGeolocation'))?.plugin).toEqual({
      __proxyFor: 'BackgroundGeolocation',
    });
    expect(registerPlugin).toHaveBeenCalledWith('BackgroundGeolocation');
  });

  it('returns an already-registered plugin without registering again', async () => {
    const plugin = { schedule: vi.fn() };
    setCapacitor({
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: { LocalNotifications: plugin },
      PluginHeaders: [{ name: 'LocalNotifications' }],
    });
    expect((await loadCapacitorPlugin('LocalNotifications'))?.plugin).toBe(plugin);
    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it('resolves even though a real plugin proxy answers `then` (it is boxed, never awaited bare)', async () => {
    // A Capacitor proxy returns a method for ANY property — including `then`,
    // which makes a bare proxy thenable and an `await` on it hang forever.
    const thenableProxy = new Proxy({}, { get: () => () => new Promise(() => undefined) });
    setCapacitor({
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: { LocalNotifications: thenableProxy },
    });
    const box = await loadCapacitorPlugin('LocalNotifications');
    expect(box?.plugin).toBe(thenableProxy);
  });

  it('never registers a plugin the APK does not ship (calls would reject)', async () => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'android', PluginHeaders: [] });
    expect(hasNativePlugin('Browser')).toBe(false);
    expect(await loadCapacitorPlugin('Browser')).toBeUndefined();
    expect(registerPlugin).not.toHaveBeenCalled();
  });
});
