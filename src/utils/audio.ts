// ============================================================================
// SPARKOS FITNESS - Audio Utilities
// ============================================================================

// Play a beep sound
export const playBeep = (frequency: number = 800, duration: number = 200): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    // Audio not supported
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
export const speak = (text: string, lang: string = 'he-IL'): void => {
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
