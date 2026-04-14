// useWorkoutSettings - Hook for accessing and using workout settings
// Provides actual functionality connected to the settings

import { useCallback, useEffect, useRef } from 'react';
import { useWorkoutState, useWorkoutDispatch } from '../core/WorkoutContext';
import { WorkoutSettings } from '../../../types';
import { useVoiceCountdown, useAudioBeep } from './useVoiceCountdown';

// ============================================================
// DEFAULT SETTINGS
// ============================================================

export const DEFAULT_WORKOUT_SETTINGS: WorkoutSettings = {
    defaultRestTime: 90,
    defaultSets: 3,
    soundEnabled: true,
    hapticsEnabled: true,
    keepAwake: true,
    oledMode: false,
    
    defaultWorkoutGoal: 'general',
    enableWarmup: true,
    enableCooldown: true,
    warmupPreference: 'ask',
    cooldownPreference: 'ask',
    
    waterReminderEnabled: false,
    waterReminderInterval: 15,
    workoutRemindersEnabled: false,
    workoutReminderTime: '18:00',
    reminderDays: [1, 2, 3, 4, 5], // Mon-Fri
    
    selectedTheme: 'deepCosmos',
    trackBodyWeight: false,
    
    // Display settings
    showGhostValues: true,
    showVolumePreview: true,
    showIntensityMeter: false,
    compactMode: false,
    
    // Rest timer
    autoStartRest: true,
    restTimerVibrate: true,
    restTimerSound: true,
    
    // Voice & audio
    voiceCountdownEnabled: false,
    voiceLanguage: 'he-IL',
    voiceVolume: 0.8,
    countdownBeepEnabled: true,
    
    // Performance
    showPerformanceStats: false,
    showSetHistory: true,
    autoIncrementWeight: false,
    weightIncrementAmount: 2.5,
    
    // Accessibility
    reducedAnimations: false,
    largeText: false,
    highContrast: false,
    
    // === ADVANCED SETTINGS DEFAULTS ===
    
    // Progressive Overload & Smart Features
    enableProgressiveOverload: true,
    progressiveOverloadPercent: 2.5,
    enableOneRepMaxTracking: true,
    showExerciseNotes: true,
    
    // Smart Rest Timer
    smartRestEnabled: false,
    shortRestTime: 60,
    mediumRestTime: 90,
    longRestTime: 180,
    extendRestAfterFailure: true,
    
    // Workout Flow
    autoAdvanceExercise: false,
    confirmExerciseComplete: true,
    enableSupersets: false,
    showRestBetweenExercises: true,
    
    // Personal Records
    enablePRAlerts: true,
    prCelebrationIntensity: 'full',
    trackVolumeRecords: true,
    
    // Data & Analytics
    enableWorkoutAnalytics: true,
    showMuscleGroupBalance: false,
    enableExportToCSV: true,
    
    // Timer Display
    timerDisplayMode: 'countdown',
    showTimerInHeader: true,
    
    // Quick Actions
    enableQuickWeightButtons: true,
    quickWeightIncrement: 2.5,
    enableQuickRepsButtons: true,
    
    // Gym Mode
    gymModeEnabled: false,
    gymModeAutoLock: false,
    
    // Body Weight Tracking
    promptWeightBeforeWorkout: false,
    promptWeightAfterWorkout: false,
};

// ============================================================
// TYPES
// ============================================================

interface UseWorkoutSettingsReturn {
    // Settings values
    settings: Partial<WorkoutSettings>;
    
    // Update function
    updateSetting: <K extends keyof WorkoutSettings>(key: K, value: WorkoutSettings[K]) => void;
    
    // Convenience getters with defaults
    get: <K extends keyof WorkoutSettings>(key: K) => WorkoutSettings[K];
    
    // Action helpers
    triggerHaptic: (pattern?: number[]) => void;
    keepScreenAwake: () => (() => void) | undefined;
    
    // Voice/Sound helpers  
    announceCountdown: (seconds: number, totalSeconds: number) => void;
    announceReady: () => void;
    playRestEndSound: () => void;
    playSetCompleteSound: () => void;
}

// ============================================================
// MAIN HOOK
// ============================================================

export function useWorkoutSettings(): UseWorkoutSettingsReturn {
    const state = useWorkoutState();
    const dispatch = useWorkoutDispatch();
    
    // Get settings from state with fallback to defaults
    const settings = state.appSettings?.workoutSettings || {};
    
    // Merge with defaults
    const get = useCallback(<K extends keyof WorkoutSettings>(key: K): WorkoutSettings[K] => {
        const value = settings[key as keyof typeof settings];
        return (value !== undefined ? value : DEFAULT_WORKOUT_SETTINGS[key]) as WorkoutSettings[K];
    }, [settings]);
    
    // Update a setting
    const updateSetting = useCallback(<K extends keyof WorkoutSettings>(
        key: K, 
        value: WorkoutSettings[K]
    ) => {
        dispatch({ 
            type: 'UPDATE_SETTINGS', 
            payload: { [key]: value } 
        });
    }, [dispatch]);
    
    // Voice countdown hook
    const voiceCountdown = useVoiceCountdown({
        settings: {
            enabled: get('voiceCountdownEnabled'),
            language: get('voiceLanguage'),
            volume: get('voiceVolume'),
        }
    });
    
    // Audio beep hook
    const audioBeep = useAudioBeep({
        enabled: get('countdownBeepEnabled'),
        volume: get('voiceVolume')
    });
    
    // Haptic feedback
    const triggerHaptic = useCallback((pattern: number[] = [20]) => {
        if (!get('hapticsEnabled')) return;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }, [get]);
    
    // Keep screen awake
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    
    const keepScreenAwake = useCallback(() => {
        if (!get('keepAwake')) return undefined;
        
        // Request wake lock
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                }
            } catch (err) {
                console.warn('Wake lock failed:', err);
            }
        };
        
        requestWakeLock();
        
        // Return cleanup function
        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        };
    }, [get]);
    
    // Voice countdown announcements
    const announceCountdown = useCallback((seconds: number, totalSeconds: number) => {
        if (get('voiceCountdownEnabled')) {
            voiceCountdown.announceTime(seconds, totalSeconds);
        } else if (get('countdownBeepEnabled')) {
            audioBeep.playCountdown(seconds);
        }
    }, [get, voiceCountdown, audioBeep]);
    
    const announceReady = useCallback(() => {
        if (get('voiceCountdownEnabled')) {
            voiceCountdown.announceReady();
        } else if (get('countdownBeepEnabled')) {
            audioBeep.playReady();
        }
    }, [get, voiceCountdown, audioBeep]);
    
    // Sound effects
    const playRestEndSound = useCallback(() => {
        if (!get('restTimerSound')) return;
        
        // Vibrate if enabled
        if (get('restTimerVibrate')) {
            triggerHaptic([200, 100, 200]);
        }
        
        // Play sound
        if (get('soundEnabled')) {
            audioBeep.playReady();
        }
    }, [get, triggerHaptic, audioBeep]);
    
    const playSetCompleteSound = useCallback(() => {
        if (!get('soundEnabled')) return;
        
        // Vibrate
        if (get('hapticsEnabled')) {
            triggerHaptic([50, 50, 50]);
        }
        
        // Beep
        audioBeep.playBeep(800, 100);
    }, [get, triggerHaptic, audioBeep]);
    
    return {
        settings,
        updateSetting,
        get,
        triggerHaptic,
        keepScreenAwake,
        announceCountdown,
        announceReady,
        playRestEndSound,
        playSetCompleteSound,
    };
}

// ============================================================
// SPECIFIC SETTINGS HOOKS
// ============================================================

/**
 * Hook for theme settings
 */
export function useThemeSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        theme: get('selectedTheme'),
        oledMode: get('oledMode'),
        setTheme: (themeId: string) => updateSetting('selectedTheme', themeId as any),
        setOledMode: (enabled: boolean) => updateSetting('oledMode', enabled),
    };
}

/**
 * Hook for rest timer settings
 */
export function useRestTimerSettings() {
    const { get, updateSetting, announceCountdown, announceReady, playRestEndSound } = useWorkoutSettings();
    
    return {
        defaultTime: get('defaultRestTime'),
        autoStart: get('autoStartRest'),
        vibrate: get('restTimerVibrate'),
        sound: get('restTimerSound'),
        voiceEnabled: get('voiceCountdownEnabled'),
        
        setDefaultTime: (time: number) => updateSetting('defaultRestTime', time),
        setAutoStart: (enabled: boolean) => updateSetting('autoStartRest', enabled),
        
        // Action helpers
        announceCountdown,
        announceReady,
        playRestEndSound,
    };
}

/**
 * Hook for display settings
 */
export function useDisplaySettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        showGhostValues: get('showGhostValues'),
        showVolumePreview: get('showVolumePreview'),
        showIntensityMeter: get('showIntensityMeter'),
        showPerformanceStats: get('showPerformanceStats'),
        compactMode: get('compactMode'),
        reducedAnimations: get('reducedAnimations'),
        largeText: get('largeText'),
        
        setShowGhostValues: (enabled: boolean) => updateSetting('showGhostValues', enabled),
        setShowVolumePreview: (enabled: boolean) => updateSetting('showVolumePreview', enabled),
        setShowIntensityMeter: (enabled: boolean) => updateSetting('showIntensityMeter', enabled),
        setShowPerformanceStats: (enabled: boolean) => updateSetting('showPerformanceStats', enabled),
        setCompactMode: (enabled: boolean) => updateSetting('compactMode', enabled),
    };
}

/**
 * Hook for accessibility settings
 */
export function useAccessibilitySettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    useEffect(() => {
        // Apply reduced animations to document
        if (get('reducedAnimations')) {
            document.documentElement.classList.add('reduce-motion');
        } else {
            document.documentElement.classList.remove('reduce-motion');
        }
        
        // Apply large text
        if (get('largeText')) {
            document.documentElement.style.setProperty('--font-scale', '1.2');
        } else {
            document.documentElement.style.setProperty('--font-scale', '1');
        }
        
        // Apply high contrast
        if (get('highContrast')) {
            document.documentElement.classList.add('high-contrast');
        } else {
            document.documentElement.classList.remove('high-contrast');
        }
    }, [get]);
    
    return {
        reducedAnimations: get('reducedAnimations'),
        largeText: get('largeText'),
        highContrast: get('highContrast'),
        
        setReducedAnimations: (enabled: boolean) => updateSetting('reducedAnimations', enabled),
        setLargeText: (enabled: boolean) => updateSetting('largeText', enabled),
        setHighContrast: (enabled: boolean) => updateSetting('highContrast', enabled),
    };
}

/**
 * Hook for progressive overload settings
 */
export function useProgressiveOverloadSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        enabled: get('enableProgressiveOverload'),
        percent: get('progressiveOverloadPercent'),
        trackOneRepMax: get('enableOneRepMaxTracking'),
        showNotes: get('showExerciseNotes'),
        
        setEnabled: (enabled: boolean) => updateSetting('enableProgressiveOverload', enabled),
        setPercent: (percent: number) => updateSetting('progressiveOverloadPercent', percent),
        setTrackOneRepMax: (enabled: boolean) => updateSetting('enableOneRepMaxTracking', enabled),
        setShowNotes: (enabled: boolean) => updateSetting('showExerciseNotes', enabled),
    };
}

/**
 * Hook for smart rest timer settings
 */
export function useSmartRestSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    /**
     * Get rest time based on exercise type
     */
    const getRestTimeForExercise = useCallback((exerciseType: 'isolation' | 'compound' | 'heavy') => {
        if (!get('smartRestEnabled')) {
            return get('defaultRestTime');
        }
        
        switch (exerciseType) {
            case 'isolation':
                return get('shortRestTime');
            case 'compound':
                return get('mediumRestTime');
            case 'heavy':
                return get('longRestTime');
            default:
                return get('defaultRestTime');
        }
    }, [get]);
    
    return {
        enabled: get('smartRestEnabled'),
        shortTime: get('shortRestTime'),
        mediumTime: get('mediumRestTime'),
        longTime: get('longRestTime'),
        extendAfterFailure: get('extendRestAfterFailure'),
        
        getRestTimeForExercise,
        
        setEnabled: (enabled: boolean) => updateSetting('smartRestEnabled', enabled),
        setShortTime: (time: number) => updateSetting('shortRestTime', time),
        setMediumTime: (time: number) => updateSetting('mediumRestTime', time),
        setLongTime: (time: number) => updateSetting('longRestTime', time),
        setExtendAfterFailure: (enabled: boolean) => updateSetting('extendRestAfterFailure', enabled),
    };
}

/**
 * Hook for workout flow settings
 */
export function useWorkoutFlowSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        autoAdvance: get('autoAdvanceExercise'),
        confirmComplete: get('confirmExerciseComplete'),
        enableSupersets: get('enableSupersets'),
        showRestBetweenExercises: get('showRestBetweenExercises'),
        
        setAutoAdvance: (enabled: boolean) => updateSetting('autoAdvanceExercise', enabled),
        setConfirmComplete: (enabled: boolean) => updateSetting('confirmExerciseComplete', enabled),
        setEnableSupersets: (enabled: boolean) => updateSetting('enableSupersets', enabled),
        setShowRestBetweenExercises: (enabled: boolean) => updateSetting('showRestBetweenExercises', enabled),
    };
}

/**
 * Hook for PR (Personal Record) settings
 */
export function usePRSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        alertsEnabled: get('enablePRAlerts'),
        celebrationIntensity: get('prCelebrationIntensity'),
        trackVolumeRecords: get('trackVolumeRecords'),
        
        setAlertsEnabled: (enabled: boolean) => updateSetting('enablePRAlerts', enabled),
        setCelebrationIntensity: (intensity: 'off' | 'subtle' | 'full') => updateSetting('prCelebrationIntensity', intensity),
        setTrackVolumeRecords: (enabled: boolean) => updateSetting('trackVolumeRecords', enabled),
    };
}

/**
 * Hook for gym mode settings
 */
export function useGymModeSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        enabled: get('gymModeEnabled'),
        autoLock: get('gymModeAutoLock'),
        
        setEnabled: (enabled: boolean) => updateSetting('gymModeEnabled', enabled),
        setAutoLock: (enabled: boolean) => updateSetting('gymModeAutoLock', enabled),
    };
}

/**
 * Hook for quick action buttons settings
 */
export function useQuickActionsSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        weightButtonsEnabled: get('enableQuickWeightButtons'),
        weightIncrement: get('quickWeightIncrement'),
        repsButtonsEnabled: get('enableQuickRepsButtons'),
        
        setWeightButtonsEnabled: (enabled: boolean) => updateSetting('enableQuickWeightButtons', enabled),
        setWeightIncrement: (increment: number) => updateSetting('quickWeightIncrement', increment),
        setRepsButtonsEnabled: (enabled: boolean) => updateSetting('enableQuickRepsButtons', enabled),
    };
}

/**
 * Hook for timer display settings
 */
export function useTimerDisplaySettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        displayMode: get('timerDisplayMode'),
        showInHeader: get('showTimerInHeader'),
        
        setDisplayMode: (mode: 'countdown' | 'countup' | 'both') => updateSetting('timerDisplayMode', mode),
        setShowInHeader: (enabled: boolean) => updateSetting('showTimerInHeader', enabled),
    };
}

/**
 * Hook for body weight prompts
 */
export function useBodyWeightPromptSettings() {
    const { get, updateSetting } = useWorkoutSettings();
    
    return {
        promptBefore: get('promptWeightBeforeWorkout'),
        promptAfter: get('promptWeightAfterWorkout'),
        
        setPromptBefore: (enabled: boolean) => updateSetting('promptWeightBeforeWorkout', enabled),
        setPromptAfter: (enabled: boolean) => updateSetting('promptWeightAfterWorkout', enabled),
    };
}

export default useWorkoutSettings;

// ============================================================
// PRIMITIVE SELECTORS (Return single values - no object allocation)
// Use these for maximum performance when only one value is needed
// ============================================================

/**
 * Get a single setting value by key - no object allocation
 * Use when you only need one setting to avoid unnecessary re-renders
 */
export function useWorkoutSettingValue<K extends keyof WorkoutSettings>(key: K): WorkoutSettings[K] {
    const state = useWorkoutState();
    const settings = state.appSettings?.workoutSettings || {};
    const value = settings[key as keyof typeof settings];
    return (value !== undefined ? value : DEFAULT_WORKOUT_SETTINGS[key]) as WorkoutSettings[K];
}

// Commonly used primitive selectors for hot paths
export function useOledMode(): boolean {
    return useWorkoutSettingValue('oledMode');
}

export function useReducedAnimations(): boolean {
    return useWorkoutSettingValue('reducedAnimations');
}

export function useHapticsEnabled(): boolean {
    return useWorkoutSettingValue('hapticsEnabled');
}

export function useSoundEnabled(): boolean {
    return useWorkoutSettingValue('soundEnabled');
}

export function useDefaultRestTime(): number {
    return useWorkoutSettingValue('defaultRestTime');
}

export function useShowGhostValues(): boolean {
    return useWorkoutSettingValue('showGhostValues');
}

export function useCompactMode(): boolean {
    return useWorkoutSettingValue('compactMode');
}

export function useLargeText(): boolean {
    return useWorkoutSettingValue('largeText');
}

export function useAutoStartRest(): boolean {
    return useWorkoutSettingValue('autoStartRest');
}

export function useVoiceCountdownEnabled(): boolean {
    return useWorkoutSettingValue('voiceCountdownEnabled');
}

export function useEnablePRAlerts(): boolean {
    return useWorkoutSettingValue('enablePRAlerts');
}

export function usePRCelebrationIntensity(): 'off' | 'subtle' | 'full' {
    return useWorkoutSettingValue('prCelebrationIntensity');
}
