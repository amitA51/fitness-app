// useVoiceCountdown - Voice announcements for rest timer
// Uses Web Speech API for audio countdown
import { useCallback, useRef, useEffect, useState } from 'react';

// ============================================================
// TYPES
// ============================================================

interface VoiceSettings {
    enabled: boolean;
    language: 'he-IL' | 'en-US';
    volume: number; // 0-1
    rate: number; // 0.1-10
    pitch: number; // 0-2
    announceSeconds: number[]; // Which seconds to announce
    announceHalfway: boolean;
    announceReady: boolean;
    voiceName?: string; // Preferred voice name
}

interface UseVoiceCountdownOptions {
    settings?: Partial<VoiceSettings>;
    onSpeak?: (text: string) => void;
    onError?: (error: Error) => void;
}

interface UseVoiceCountdownReturn {
    speak: (text: string) => void;
    announceTime: (seconds: number, totalSeconds: number) => void;
    announceReady: () => void;
    announceExercise: (name: string) => void;
    stop: () => void;
    isSupported: boolean;
    isSpeaking: boolean;
    settings: VoiceSettings;
    updateSettings: (newSettings: Partial<VoiceSettings>) => void;
    availableVoices: SpeechSynthesisVoice[];
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_SETTINGS: VoiceSettings = {
    enabled: true,
    language: 'he-IL',
    volume: 0.8,
    rate: 1.0,
    pitch: 1.0,
    announceSeconds: [10, 5, 4, 3, 2, 1],
    announceHalfway: true,
    announceReady: true,
};

const HEBREW_NUMBERS: Record<number, string> = {
    1: 'אחת',
    2: 'שתיים',
    3: 'שלוש',
    4: 'ארבע',
    5: 'חמש',
    6: 'שש',
    7: 'שבע',
    8: 'שמונה',
    9: 'תשע',
    10: 'עשר',
    15: 'חמש עשרה',
    20: 'עשרים',
    30: 'שלושים',
    45: 'ארבעים וחמש',
    60: 'דקה',
    90: 'דקה וחצי',
    120: 'שתי דקות',
};

const ENGLISH_NUMBERS: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
};

// ============================================================
// HOOK
// ============================================================

/**
 * useVoiceCountdown - Voice announcements for rest timer
 * 
 * Features:
 * - Web Speech API integration
 * - Hebrew and English support
 * - Customizable announcement timing
 * - Halfway announcement
 * - "Get Ready" announcement
 * - Exercise name announcement
 */
export function useVoiceCountdown(options: UseVoiceCountdownOptions = {}): UseVoiceCountdownReturn {
    const { onSpeak, onError } = options;

    // State
    const [settings, setSettings] = useState<VoiceSettings>({
        ...DEFAULT_SETTINGS,
        ...options.settings
    });
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [isSupported, setIsSupported] = useState(false);

    // Refs
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const announcedSecondsRef = useRef<Set<number>>(new Set());

    // Initialize speech synthesis
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
            setIsSupported(true);

            // Load voices
            const loadVoices = () => {
                const voices = synthRef.current?.getVoices() || [];
                setAvailableVoices(voices);
            };

            loadVoices();
            synthRef.current.addEventListener('voiceschanged', loadVoices);

            return () => {
                synthRef.current?.removeEventListener('voiceschanged', loadVoices);
            };
        }
        return undefined;
    }, []);

    // Get preferred voice
    const getVoice = useCallback((): SpeechSynthesisVoice | null => {
        if (!availableVoices.length) return null;

        // Try to find preferred voice
        if (settings.voiceName) {
            const preferred = availableVoices.find(v => v.name === settings.voiceName);
            if (preferred) return preferred;
        }

        // Find voice for the language
        const langCode = settings.language.split('-')[0] || settings.language;
        const langVoice = availableVoices.find(v => v.lang.startsWith(langCode));
        if (langVoice) return langVoice;

        // Default to first available
        return availableVoices[0] || null;
    }, [availableVoices, settings.language, settings.voiceName]);

    // Speak text
    const speak = useCallback((text: string) => {
        if (!settings.enabled || !synthRef.current || !isSupported) return;

        try {
            // Cancel any ongoing speech
            synthRef.current.cancel();

            // Create utterance
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = settings.language;
            utterance.volume = settings.volume;
            utterance.rate = settings.rate;
            utterance.pitch = settings.pitch;

            const voice = getVoice();
            if (voice) {
                utterance.voice = voice;
            }

            // Event handlers
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = (event) => {
                setIsSpeaking(false);
                onError?.(new Error(event.error));
            };

            utteranceRef.current = utterance;
            synthRef.current.speak(utterance);

            onSpeak?.(text);
        } catch (error) {
            onError?.(error as Error);
        }
    }, [settings, isSupported, getVoice, onSpeak, onError]);

    // Stop speaking
    const stop = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    // Announce time
    const announceTime = useCallback((seconds: number, totalSeconds: number) => {
        if (!settings.enabled) return;

        // Check if already announced this second
        if (announcedSecondsRef.current.has(seconds)) return;
        announcedSecondsRef.current.add(seconds);

        // Halfway announcement
        if (settings.announceHalfway && seconds === Math.floor(totalSeconds / 2)) {
            speak(settings.language === 'he-IL' ? 'חצי' : 'halfway');
            return;
        }

        // Check if this second should be announced
        if (!settings.announceSeconds.includes(seconds)) return;

        // Get number text
        const numberText = settings.language === 'he-IL'
            ? HEBREW_NUMBERS[seconds] || String(seconds)
            : ENGLISH_NUMBERS[seconds] || String(seconds);

        speak(numberText);
    }, [settings, speak]);

    // Announce "Get Ready"
    const announceReady = useCallback(() => {
        if (!settings.enabled || !settings.announceReady) return;

        const text = settings.language === 'he-IL' ? 'להתכונן!' : 'Get Ready!';
        speak(text);
    }, [settings, speak]);

    // Announce exercise name
    const announceExercise = useCallback((name: string) => {
        if (!settings.enabled) return;

        const prefix = settings.language === 'he-IL' ? 'התרגיל הבא:' : 'Next exercise:';
        speak(`${prefix} ${name}`);
    }, [settings, speak]);

    // Reset announced seconds (call when timer restarts)
    useEffect(() => {
        return () => {
            announcedSecondsRef.current.clear();
        };
    }, []);

    // Update settings
    const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return {
        speak,
        announceTime,
        announceReady,
        announceExercise,
        stop,
        isSupported,
        isSpeaking,
        settings,
        updateSettings,
        availableVoices
    };
}

// ============================================================
// AUDIO BEEP ALTERNATIVE (for browsers without speech)
// ============================================================

interface UseAudioBeepOptions {
    enabled?: boolean;
    volume?: number;
}

/**
 * useAudioBeep - Fallback audio beeps for countdown
 */
export function useAudioBeep(options: UseAudioBeepOptions = {}) {
    const { enabled = true, volume = 0.5 } = options;
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (!enabled) return;
        if (typeof window !== 'undefined' && 'AudioContext' in window) {
            audioContextRef.current = new AudioContext();
        }

        return () => {
            audioContextRef.current?.close();
            audioContextRef.current = null;
        };
    }, [enabled]);

    const playBeep = useCallback((frequency: number = 800, duration: number = 100) => {
        if (!enabled || !audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
    }, [enabled, volume]);

    const playCountdown = useCallback((seconds: number) => {
        if (seconds <= 3) {
            // High beep for last 3 seconds
            playBeep(1000, 150);
        } else if (seconds === 5 || seconds === 10) {
            // Medium beep for 5 and 10
            playBeep(800, 100);
        }
    }, [playBeep]);

    const playReady = useCallback(() => {
        // Double beep for ready
        playBeep(1200, 100);
        setTimeout(() => playBeep(1400, 150), 150);
    }, [playBeep]);

    return {
        playBeep,
        playCountdown,
        playReady
    };
}

export default useVoiceCountdown;
