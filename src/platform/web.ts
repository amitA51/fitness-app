// Platform adapter for web. React Native will provide an alternative implementation.
// Abstracts: wake lock, document visibility, localStorage, audio, beforeunload.

export interface PlatformAdapter {
  // Storage
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;

  // Wake lock
  requestWakeLock(): Promise<{ release: () => void } | null>;

  // Visibility
  onVisibilityChange(cb: (hidden: boolean) => void): () => void;
  onBeforeUnload(cb: () => void): () => void;

  // Audio
  playRestEndSound(): void;
  setSoundEnabled(enabled: boolean): void;
}

export const webPlatform: PlatformAdapter = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* quota exceeded */
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        const sentinel = await navigator.wakeLock.request('screen');
        return {
          release: () => {
            sentinel.release();
          },
        };
      }
    } catch {
      /* not supported or denied */
    }
    return null;
  },

  onVisibilityChange(cb) {
    const handler = () => cb(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },

  onBeforeUnload(cb) {
    const handler = () => cb();
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  },

  playRestEndSound() {
    import('../utils/audio').then((m) => m.playRestEndSound()).catch(() => {});
  },

  setSoundEnabled(enabled) {
    import('../utils/audio').then((m) => m.setSoundEnabled(enabled)).catch(() => {});
  },
};
