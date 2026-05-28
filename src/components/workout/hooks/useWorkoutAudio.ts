import { useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';
import type { WorkoutAction, WorkoutState } from '../core/workoutTypes';

const playSound = (type: 'success' | 'timer_end' | 'tick' | 'start') => {
  // In a real app, these would be paths to actual sound files
  // For now, we can use base64 or placeholder URLs.
  // Since we don't have the assets, we'll try to use system beep or just log for now
  // BUT the user wants $100M feel. I should try to implement a simple oscillator beep if no files.

  // However, best practice is to expect files.
  // I will assume standard paths or use a synthesis fallback.

  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // High pitch "ding"
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'timer_end') {
      // Double beep
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(600, ctx.currentTime);
        gain2.gain.setValueAtTime(0.5, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.15);
      }, 200);
    } else if (type === 'tick') {
      // Soft click
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) {
    logger.workout.error('Audio playback failed', e);
  }
};

export const useWorkoutAudio = (state: WorkoutState, _dispatch: React.Dispatch<WorkoutAction>) => {
  const prevCompletedSets = useRef(0);

  // Count completed sets
  const completedSetsCount = state.exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).filter((s) => s.completedAt).length,
    0
  );

  // 1. Completion Sound
  useEffect(() => {
    if (completedSetsCount > prevCompletedSets.current) {
      playSound('success');
    }
    prevCompletedSets.current = completedSetsCount;
  }, [completedSetsCount]);

  // 2. Rest Timer Start/End
  useEffect(() => {
    // restTimer is now a RestTimerState object with .active property
    // Logic for rest timer sound can be implemented here
    // For now, the RestTimerOverlay handles the sound
    // This hook focuses on set completion sounds
  }, [state.restTimer.active]);

  // We can rely on a different approach:
  // The RestTimerOverlay might handle the sound, but we want central audio.
  // Let's keep it simple: ActiveWorkoutNew handles the 'tick'.

  // For now, Success Sound is the most important "Thumb First" feedback.
};
