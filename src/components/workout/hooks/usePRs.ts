import { useState, useEffect } from 'react';
import { PersonalRecord } from '../../../services/prService';
import { getWorkoutSessions } from '../../../services/dataService';
import { calculatePRsFromHistory, getPRDisplayText } from '../../../services/prService';

export function usePRs() {
    const [prs, setPrs] = useState<Map<string, PersonalRecord>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isCancelled = false;

        const loadPRs = async () => {
            try {
                const sessions = await getWorkoutSessions();
                if (isCancelled) return;

                const calculatedPRs = calculatePRsFromHistory(sessions);
                setPrs(calculatedPRs);
            } catch (err) {
                console.error("Failed to load PRs", err);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        loadPRs();

        return () => { isCancelled = true; };
    }, []);

    const getPR = (exerciseName: string): PersonalRecord | undefined => {
        return prs.get(exerciseName);
    };

    const getPRText = (exerciseName: string) => {
        const pr = prs.get(exerciseName);
        if (!pr) return 'No PR yet';
        return getPRDisplayText(pr); // Returns formatted string
    };

    return { prs, isLoading, getPR, getPRText };
}
