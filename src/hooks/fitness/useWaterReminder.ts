import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useHaptics } from '../useHaptics';
import { showNotification } from '../../services/notificationService';

/**
 * Hook for water reminder during workouts.
 * Shows a reminder notification/vibration at the configured interval.
 * 
 * @param isActive - Whether workout is currently active
 */
export const useWaterReminder = (isActive: boolean) => {
    const { settings } = useSettings();
    const { triggerHaptic } = useHaptics();
    const intervalRef = useRef<number | null>(null);
    const lastReminderRef = useRef<number>(0);

    const workoutSettings = settings.workoutSettings || {
        waterReminderEnabled: false,
        waterReminderInterval: 15,
    };

    const showReminder = useCallback(() => {
        // Haptic feedback
        triggerHaptic('medium');

        // Show notification
        showNotification('💧 זמן לשתות מים!', 'הישאר מאוזן במהלך האימון');

        lastReminderRef.current = Date.now();
    }, [triggerHaptic]);

    useEffect(() => {
        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Only run if workout is active and reminder is enabled
        if (!isActive || !workoutSettings.waterReminderEnabled) {
            return;
        }

        const intervalMinutes = workoutSettings.waterReminderInterval || 15;
        const intervalMs = intervalMinutes * 60 * 1000;

        // Set up interval
        intervalRef.current = window.setInterval(() => {
            showReminder();
        }, intervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, workoutSettings.waterReminderEnabled, workoutSettings.waterReminderInterval, showReminder]);

    return {
        triggerManualReminder: showReminder,
        lastReminderTime: lastReminderRef.current,
    };
};

export default useWaterReminder;
