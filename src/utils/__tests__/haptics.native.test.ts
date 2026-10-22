import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Inside the native apps the iOS WebView has no Vibration API, so every
// pattern must be played on @capacitor/haptics, pulse by pulse.

const impact = vi.fn(async (_options: { style: string }) => undefined);
let native = false;

vi.mock('../platform', () => ({
  hasNativePlugin: (name: string) => native && name === 'Haptics',
  loadCapacitorPlugin: async () => (native ? { plugin: { impact } } : undefined),
}));

const load = async () => {
  vi.resetModules();
  return import('../haptics');
};

describe('haptics in the native apps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    impact.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    native = false;
  });

  it('plays each pulse as an impact at its offset, heavier for longer pulses', async () => {
    native = true;
    const { haptics } = await load();

    haptics.prStamp(); // [80, 60, 40]
    await vi.advanceTimersByTimeAsync(0);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenLastCalledWith({ style: 'HEAVY' });

    await vi.advanceTimersByTimeAsync(140);
    expect(impact).toHaveBeenCalledTimes(2);
    expect(impact).toHaveBeenLastCalledWith({ style: 'MEDIUM' });
  });

  it('plays effects on iOS when the native plugin is there', async () => {
    native = true;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'
    );
    const { triggerHapticEffect } = await load();

    triggerHapticEffect('tap');
    await vi.advanceTimersByTimeAsync(0);
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('stays silent when the user turned haptics off', async () => {
    native = true;
    const { haptics, setHapticsEnabled } = await load();
    setHapticsEnabled(false);

    haptics.thump();
    await vi.advanceTimersByTimeAsync(200);
    expect(impact).not.toHaveBeenCalled();
  });

  it('uses the Vibration API on the web', async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { haptics } = await load();

    haptics.tick();
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(impact).not.toHaveBeenCalled();
  });
});
