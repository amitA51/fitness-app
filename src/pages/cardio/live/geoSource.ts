// ============================================================================
// geoSource — one GPS stream, two engines.
// ============================================================================
// Android app: @capacitor-community/background-geolocation (MIT). It runs a
// foreground service with a visible notification, so tracking continues with
// the screen off — the only way a run survives a phone in a pocket.
// Web / PWA: navigator.geolocation.watchPosition. It stops when the screen
// locks (iOS and Android both), so the live screen keeps the screen awake and
// says so honestly.

import { logger } from '../../../utils/logger';
import { hasNativePlugin, loadCapacitorPlugin } from '../../../utils/platform';
import type { GeoFix } from './geo';

export interface GeoWatch {
  stop: () => void;
}

export type GeoErrorKind = 'denied' | 'unavailable';

/** The subset of @capacitor-community/background-geolocation used here. */
interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  time: number | null;
}

interface NativeWatcherError {
  code?: string;
  message?: string;
}

interface BackgroundGeolocationLike {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location?: NativeLocation, error?: NativeWatcherError) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

/** True when live tracking keeps running with the screen off. */
export function hasBackgroundGps(): boolean {
  return hasNativePlugin('BackgroundGeolocation');
}

function startNative(
  plugin: BackgroundGeolocationLike,
  onFix: (fix: GeoFix) => void,
  onError: (kind: GeoErrorKind) => void
): GeoWatch {
  let id: string | null = null;
  let stopped = false;
  plugin
    .addWatcher(
      {
        backgroundTitle: 'האימון שלך נמדד',
        backgroundMessage: 'המרחק והקצב נמדדים גם כשהמסך כבוי',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (location, error) => {
        if (error) {
          onError(error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable');
          return;
        }
        if (!location) return;
        onFix({
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude ?? null,
          t: location.time ?? Date.now(),
        });
      }
    )
    .then((watcherId) => {
      if (stopped) void plugin.removeWatcher({ id: watcherId });
      else id = watcherId;
    })
    .catch((err: unknown) => {
      logger.workout.warn('cardio live: native GPS watcher failed', err);
      onError('unavailable');
    });
  return {
    stop: () => {
      stopped = true;
      if (id) void plugin.removeWatcher({ id }).catch(() => undefined);
    },
  };
}

function startWeb(onFix: (fix: GeoFix) => void, onError: (kind: GeoErrorKind) => void): GeoWatch {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('unavailable');
    return { stop: () => undefined };
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        t: pos.timestamp || Date.now(),
      }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 }
  );
  return { stop: () => navigator.geolocation.clearWatch(id) };
}

/** Start the best available GPS stream. */
export function startGeoWatch(
  onFix: (fix: GeoFix) => void,
  onError: (kind: GeoErrorKind) => void
): GeoWatch {
  if (!hasNativePlugin('BackgroundGeolocation')) return startWeb(onFix, onError);
  // The native proxy is registered on first use (async); stop() may arrive first.
  let inner: GeoWatch | null = null;
  let stopped = false;
  loadCapacitorPlugin<BackgroundGeolocationLike>('BackgroundGeolocation')
    .then((box) => {
      if (stopped) return;
      inner = box ? startNative(box.plugin, onFix, onError) : startWeb(onFix, onError);
    })
    .catch((err: unknown) => {
      logger.workout.warn('cardio live: native GPS plugin failed to load, using the browser', err);
      if (!stopped) inner = startWeb(onFix, onError);
    });
  return {
    stop: () => {
      stopped = true;
      inner?.stop();
    },
  };
}
