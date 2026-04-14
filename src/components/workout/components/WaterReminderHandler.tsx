// Extracted from ActiveWorkoutNew.tsx
// Contains water reminder logic and toast management

import { useState, useEffect, useCallback } from 'react';
import { WorkoutSettings } from '../../../types';
import WaterReminderToast from '../WaterReminderToast';

export interface WaterReminderHandlerProps {
    workoutSettings: Partial<WorkoutSettings>;
}

export interface UseWaterReminderReturn {
    showWaterReminder: boolean;
    setShowWaterReminder: (show: boolean) => void;
}

export const useWaterReminder = (workoutSettings: Partial<WorkoutSettings>): UseWaterReminderReturn => {
    const [showWaterReminder, setShowWaterReminder] = useState(false);

    useEffect(() => {
        if (!workoutSettings.waterReminderEnabled) return;

        const minutes = ((workoutSettings.waterReminderInterval as number) || 15);
        const WATER_INTERVAL = minutes * 60 * 1000;
        const interval = setInterval(() => {
            setShowWaterReminder(true);
        }, WATER_INTERVAL);

        return () => clearInterval(interval);
    }, [workoutSettings.waterReminderEnabled, workoutSettings.waterReminderInterval]);

    return {
        showWaterReminder,
        setShowWaterReminder,
    };
};

export const WaterReminderHandler: React.FC<WaterReminderHandlerProps> = ({ workoutSettings }) => {
    const { showWaterReminder, setShowWaterReminder } = useWaterReminder(workoutSettings);

    return (
        <WaterReminderToast
            isVisible={showWaterReminder}
            onDismiss={() => setShowWaterReminder(false)}
        />
    );
};

export default WaterReminderHandler;
