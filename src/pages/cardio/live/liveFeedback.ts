// Screen-awake + spoken km updates for the live tracker.

import { useEffect } from 'react';
import type { CardioSplit } from '../../../types';
import { logger } from '../../../utils/logger';

const VOICE_KEY = 'cardio_voice_cues';

export function readVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeVoicePref(on: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // preference only
  }
}

/** "קילומטר 3. קצב 5 דקות ו־31 שניות לקילומטר" — words, not "5:31", so TTS reads it right. */
export function splitAnnouncement(split: CardioSplit): string {
  // Round the total first: 5:59.6 must be "6 דקות", never "5 דקות ו־60 שניות".
  const perKm = Math.round(split.seconds / split.distanceKm);
  const m = Math.floor(perKm / 60);
  const s = perKm % 60;
  const minutes = m === 1 ? 'דקה' : `${m} דקות`;
  const seconds = s === 0 ? '' : s === 1 ? ' ושנייה' : ` ו־${s} שניות`;
  return `קילומטר ${split.index}. קצב ${minutes}${seconds} לקילומטר`;
}

/** Speak a short line in Hebrew; vibrate as well (and instead, where TTS is missing). */
export function announce(text: string): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
      navigator.vibrate([120, 60, 120]);
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('he'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    logger.workout.warn('cardio live: announcement failed', err);
  }
}

/** Keep the screen on while `active` — re-acquired when the tab returns. */
export function useScreenAwake(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) void sentinel.release();
      } catch (err) {
        logger.workout.warn('cardio live: wake lock refused', err);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
