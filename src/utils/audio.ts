// ============================================================================
// SPARKOS FITNESS - Audio Utilities
// ============================================================================

import { logger } from './logger';

// Single lazy module-level AudioContext — reused across all beeps.
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (_audioCtx) {
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  }
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  _audioCtx = new AudioContextClass();
  return _audioCtx;
}

// Play a beep sound
export const playBeep = (frequency = 800, duration = 200): void => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (e) {
    logger.app.warn('Audio playback failed', e);
  }
};

// Play rest timer end sound
export const playRestEndSound = (): void => {
  playBeep(1000, 300);
  setTimeout(() => playBeep(1200, 200), 150);
};

// Play set complete sound
export const playSetCompleteSound = (): void => {
  playBeep(600, 150);
};

// Play workout complete sound
export const playWorkoutCompleteSound = (): void => {
  playBeep(800, 200);
  setTimeout(() => playBeep(1000, 200), 200);
  setTimeout(() => playBeep(1200, 300), 400);
};

// Voice countdown
export const speakCountdown = (number: number): void => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(number.toString());
    utterance.lang = 'he-IL';
    utterance.rate = 1.2;
    speechSynthesis.speak(utterance);
  }
};

// Play success sound (for celebrations, PRs)
export const playSuccess = (): void => {
  playBeep(800, 200);
  setTimeout(() => playBeep(1000, 200), 150);
};

// Play ding sound (for timer countdown)
export const playDing = (): void => {
  playBeep(1000, 150);
};

// Speak text (for voice feedback)
export const speak = (text: string, lang = 'he-IL'): void => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);
  }
};

// Play heartbeat sound (for rest timer)
export const playHeartbeat = (): void => {
  playBeep(60, 100);
  setTimeout(() => playBeep(60, 100), 150);
};
