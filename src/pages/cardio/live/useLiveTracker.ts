// ============================================================================
// useLiveTracker — the live cardio session: clock, GPS, splits, auto-pause.
// ============================================================================
// Time is always derived from timestamps (never by counting ticks), so a
// throttled background tab or a dropped interval cannot lose seconds. The whole
// session is written to localStorage as it goes: a reload, a crash or a killed
// app reopens on the same run instead of losing it.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardioActivity, CardioSplit } from '../../../types';
import { cardioActivityConfig } from '../../../utils/cardio';
import { logger } from '../../../utils/logger';
import {
  EMPTY_TRACK,
  type GeoFix,
  type PaceSample,
  type TrackState,
  applyFix,
  finalSplit,
  rollingPaceSecPerKm,
} from './geo';
import { type GeoWatch, startGeoWatch } from './geoSource';

export type LivePhase = 'ready' | 'running' | 'paused' | 'finished';
export type GpsStatus = 'off' | 'searching' | 'good' | 'weak' | 'denied' | 'unavailable';

/** No accepted movement for this long while running → auto-pause. */
const AUTO_PAUSE_IDLE_MS = 12_000;
/** Persist at most this often while running (phase changes save at once). */
const PERSIST_EVERY_MS = 3_000;
const STORAGE_KEY = 'cardio_live_v1';

interface LiveSnapshot {
  version: 1;
  activity: CardioActivity;
  phase: LivePhase;
  useGps: boolean;
  autoPause: boolean;
  /** Epoch ms of the first start. */
  startedAt: number | null;
  /** Epoch ms of finish. */
  finishedAt: number | null;
  /** Moving ms of closed segments. */
  movingMs: number;
  /** Epoch ms the current moving segment started; null while (auto-)paused. */
  segmentStart: number | null;
  /** True while stopped by auto-pause (phase stays 'running'). */
  autoPaused: boolean;
  /** Epoch ms of the last accepted GPS step. */
  lastMoveAt: number | null;
  track: TrackState;
}

function freshSnapshot(activity: CardioActivity, useGps: boolean): LiveSnapshot {
  return {
    version: 1,
    activity,
    phase: 'ready',
    useGps,
    autoPause: useGps,
    startedAt: null,
    finishedAt: null,
    movingMs: 0,
    segmentStart: null,
    autoPaused: false,
    lastMoveAt: null,
    track: EMPTY_TRACK,
  };
}

function readSnapshot(): LiveSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveSnapshot;
    if (parsed?.version !== 1 || !parsed.track || parsed.phase === 'ready') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(s: LiveSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (err) {
    logger.workout.warn('cardio live: could not persist the session', err);
  }
}

export function clearLiveSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/** An unfinished live session left on this device, if any. */
export function pendingLiveActivity(): CardioActivity | null {
  return readSnapshot()?.activity ?? null;
}

const movingMsAt = (s: LiveSnapshot, now: number) =>
  s.movingMs + (s.segmentStart !== null ? Math.max(0, now - s.segmentStart) : 0);

export interface LiveTracker {
  activity: CardioActivity;
  phase: LivePhase;
  gps: GpsStatus;
  usesGps: boolean;
  autoPause: boolean;
  autoPaused: boolean;
  /** Moving time, seconds. */
  movingSec: number;
  distanceKm: number;
  elevationGainM: number;
  /** Current pace over the last 30 s, s/km. */
  currentPaceSecPerKm: number | null;
  splits: CardioSplit[];
  startedAt: number | null;
  finishedAt: number | null;
  /** True when this session was restored from a previous visit. */
  restored: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  /** Back from the finish form to the running session. */
  reopen: () => void;
  setAutoPause: (on: boolean) => void;
  discard: () => void;
  /** Call after the session is saved — clears it from the device for good. */
  complete: () => void;
  /** Splits including the partial last one, and the route — for saving. */
  result: () => { splits: CardioSplit[]; points: [number, number][] };
}

export function useLiveTracker(
  requestedActivity: CardioActivity,
  onSplit?: (split: CardioSplit) => void
): LiveTracker {
  const restoredRef = useRef<LiveSnapshot | null>(readSnapshot());
  const [snap, setSnap] = useState<LiveSnapshot>(
    () =>
      restoredRef.current ??
      freshSnapshot(requestedActivity, cardioActivityConfig(requestedActivity).gps)
  );
  const [gps, setGps] = useState<GpsStatus>('off');
  const [now, setNow] = useState(() => Date.now());

  const snapRef = useRef(snap);
  snapRef.current = snap;
  // The track is folded synchronously per fix (two fixes can land before a
  // re-render), so it lives in a ref and is mirrored into the snapshot.
  const trackRef = useRef<TrackState>(snap.track);
  const samplesRef = useRef<PaceSample[]>([]);
  // Set once the session is saved or discarded: from then on nothing may write
  // it back (the unmount flush used to resurrect a saved run as "still active").
  const endedRef = useRef(false);
  const lastPersistRef = useRef(0);
  const onSplitRef = useRef(onSplit);
  onSplitRef.current = onSplit;

  /** Apply an update, persisting immediately on phase changes. */
  const update = useCallback((fn: (s: LiveSnapshot) => LiveSnapshot) => {
    setSnap((prev) => {
      const next = fn(prev);
      const t = Date.now();
      if (endedRef.current) return next;
      if (next.phase !== prev.phase || t - lastPersistRef.current >= PERSIST_EVERY_MS) {
        lastPersistRef.current = t;
        writeSnapshot(next);
      }
      return next;
    });
  }, []);

  // Clock: re-render every second while the session is live.
  useEffect(() => {
    if (snap.phase !== 'running' && snap.phase !== 'paused') return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [snap.phase]);

  // Auto-pause: no accepted movement for a while → close the moving segment
  // at the moment movement stopped.
  useEffect(() => {
    const s = snapRef.current;
    if (s.phase !== 'running' || !s.useGps || !s.autoPause || s.autoPaused) return;
    if (s.lastMoveAt === null || s.segmentStart === null) return;
    if (now - s.lastMoveAt < AUTO_PAUSE_IDLE_MS) return;
    update((prev) => {
      if (prev.segmentStart === null || prev.lastMoveAt === null) return prev;
      const stopAt = Math.max(prev.segmentStart, prev.lastMoveAt);
      return {
        ...prev,
        movingMs: prev.movingMs + (stopAt - prev.segmentStart),
        segmentStart: null,
        autoPaused: true,
      };
    });
  }, [now, update]);

  // GPS: watch while running (also while auto-paused, to resume on movement).
  const watchRef = useRef<GeoWatch | null>(null);
  useEffect(() => {
    if (snap.phase !== 'running' || !snap.useGps) {
      watchRef.current?.stop();
      watchRef.current = null;
      setGps('off');
      return undefined;
    }
    setGps('searching');
    const onFix = (fix: GeoFix) => {
      setGps(fix.accuracy <= 30 ? 'good' : 'weak');
      const s = snapRef.current;
      if (s.phase !== 'running') return;
      const movingSec = movingMsAt(s, fix.t) / 1000;
      const before = trackRef.current;
      const { state: track, verdict } = applyFix(before, fix, s.activity, movingSec);
      if (verdict !== 'accepted' && verdict !== 'start') return;
      trackRef.current = track;
      const newSplits = track.splits.slice(before.splits.length);
      update((prev) => {
        const resume = prev.autoPaused && verdict === 'accepted';
        return {
          ...prev,
          track,
          lastMoveAt: verdict === 'accepted' ? fix.t : (prev.lastMoveAt ?? fix.t),
          autoPaused: resume ? false : prev.autoPaused,
          segmentStart: resume ? fix.t : prev.segmentStart,
        };
      });
      samplesRef.current = [
        ...samplesRef.current,
        { sec: movingSec, distanceM: track.distanceM },
      ].slice(-60);
      for (const split of newSplits) onSplitRef.current?.(split);
    };
    const onError = (kind: 'denied' | 'unavailable') => setGps(kind);
    watchRef.current = startGeoWatch(onFix, onError);
    return () => {
      watchRef.current?.stop();
      watchRef.current = null;
    };
  }, [snap.phase, snap.useGps, update]);

  // Persist on unmount / tab hide so the last seconds are never lost.
  useEffect(() => {
    const flush = () => {
      const s = snapRef.current;
      if (!endedRef.current && s.phase !== 'ready') writeSnapshot(s);
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const start = useCallback(() => {
    const t = Date.now();
    samplesRef.current = [];
    update((prev) => ({
      ...prev,
      phase: 'running',
      startedAt: t,
      segmentStart: t,
      lastMoveAt: null,
    }));
    setNow(t);
  }, [update]);

  const pause = useCallback(() => {
    const t = Date.now();
    update((prev) => ({
      ...prev,
      phase: 'paused',
      movingMs: movingMsAt(prev, t),
      segmentStart: null,
      autoPaused: false,
    }));
    setNow(t);
  }, [update]);

  const resume = useCallback(() => {
    const t = Date.now();
    update((prev) => ({
      ...prev,
      phase: 'running',
      segmentStart: t,
      lastMoveAt: null,
      autoPaused: false,
    }));
    setNow(t);
  }, [update]);

  const finish = useCallback(() => {
    const t = Date.now();
    update((prev) => ({
      ...prev,
      phase: 'finished',
      movingMs: movingMsAt(prev, t),
      segmentStart: null,
      autoPaused: false,
      finishedAt: t,
    }));
    setNow(t);
  }, [update]);

  const reopen = useCallback(() => {
    update((prev) => ({ ...prev, phase: 'paused', finishedAt: null }));
  }, [update]);

  const setAutoPause = useCallback(
    (on: boolean) => {
      const t = Date.now();
      update((prev) => {
        // Turning auto-pause off while auto-paused resumes the clock now.
        if (!on && prev.autoPaused) {
          return { ...prev, autoPause: false, autoPaused: false, segmentStart: t };
        }
        return { ...prev, autoPause: on };
      });
    },
    [update]
  );

  const discard = useCallback(() => {
    endedRef.current = true;
    clearLiveSnapshot();
    samplesRef.current = [];
    trackRef.current = EMPTY_TRACK;
    setSnap(freshSnapshot(requestedActivity, cardioActivityConfig(requestedActivity).gps));
  }, [requestedActivity]);

  /** The session was saved: forget it for good (no flush may bring it back). */
  const complete = useCallback(() => {
    endedRef.current = true;
    clearLiveSnapshot();
  }, []);

  const result = useCallback(() => {
    const s = snapRef.current;
    const movingSec = s.movingMs / 1000;
    const last = finalSplit(s.track, movingSec);
    return { splits: last ? [...s.track.splits, last] : s.track.splits, points: s.track.points };
  }, []);

  const movingSec = Math.floor(
    movingMsAt(snap, snap.phase === 'finished' ? (snap.finishedAt ?? now) : now) / 1000
  );
  // Cheap enough to recompute on each (per-second) render.
  const currentPace =
    snap.phase === 'running' && !snap.autoPaused ? rollingPaceSecPerKm(samplesRef.current) : null;

  return {
    activity: snap.activity,
    phase: snap.phase,
    gps,
    usesGps: snap.useGps,
    autoPause: snap.autoPause,
    autoPaused: snap.autoPaused,
    movingSec,
    distanceKm: snap.track.distanceM / 1000,
    elevationGainM: snap.track.elevationGainM,
    currentPaceSecPerKm: currentPace,
    splits: snap.track.splits,
    startedAt: snap.startedAt,
    finishedAt: snap.finishedAt,
    restored: restoredRef.current !== null,
    start,
    pause,
    resume,
    finish,
    reopen,
    setAutoPause,
    discard,
    complete,
    result,
  };
}
