// DEFAULT_WORKOUT_SETTINGS has exactly ONE definition - regression tests
//
// It used to be declared TWICE: once in contexts/SettingsContext.tsx and once in
// components/workout/hooks/useWorkoutSettings.ts. The two literals disagreed on
// seven values, so which defaults a brand-new user received depended on which
// store's fallback answered the read first - and the rest timer is on the hot
// path (longRestTime was 120 in one copy and 180 in the other).
//
// A test that compares two copies field-by-field would still pass with two
// copies present, so it cannot enforce the fix. These tests enforce it two ways
// that a second copy cannot satisfy:
//   1. both import paths must resolve to the SAME object (reference identity) -
//      two object literals are never reference-equal, however equal their values;
//   2. only one file under src/ may DECLARE the constant.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_WORKOUT_SETTINGS as fromWorkoutHook } from '../../components/workout/hooks/useWorkoutSettings';
import type { AppSettings } from '../../types';
import { DEFAULT_WORKOUT_SETTINGS as fromContext, loadStoredSettings } from '../SettingsContext';

const SRC = join(__dirname, '..', '..');

/** Every non-test .ts/.tsx file under src/. */
const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    acc.push(full);
  }
  return acc;
};

// Built from parts so this file's own source never matches the pattern it scans for.
const DECLARATION = new RegExp(`\\bconst\\s+${'DEFAULT_WORKOUT_SETTINGS'}\\b[^=\\n]*=\\s*\\{`);

describe('DEFAULT_WORKOUT_SETTINGS is defined exactly once', () => {
  it('resolves to the same object through both import paths', () => {
    // toBe, not toEqual: a reintroduced second literal would still be toEqual
    // on the day it was copied, and would drift silently afterwards.
    expect(fromWorkoutHook).toBe(fromContext);
  });

  it('is declared in exactly one source file, contexts/SettingsContext.tsx', () => {
    const declaring = collectSourceFiles(SRC)
      .filter((file) => DECLARATION.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1).replace(/\\/g, '/'));

    expect(declaring).toEqual(['contexts/SettingsContext.tsx']);
  });
});

describe('the collapsed object keeps the values that actually shipped', () => {
  // The seven keys the two copies disagreed on. SettingsProvider sits above the
  // whole tree and seeds a complete object from its defaults, which WorkoutProvider
  // then seeds state.appSettings from; every workout-side read falls back to its
  // own defaults only for an undefined key, which these never were. So the
  // context's value is the one a user met, and the workout copy's was unreachable.
  it.each([
    ['voiceVolume', 0.7],
    ['longRestTime', 120],
    ['extendRestAfterFailure', false],
    ['autoAdvanceExercise', true],
    ['confirmExerciseComplete', false],
    ['timerDisplayMode', 'countup'],
    ['showMuscleGroupBalance', true],
  ] as const)('%s stays %s', (key, value) => {
    expect(fromContext[key]).toBe(value);
  });

  // The seven keys only the workout copy had. Its fallback supplied them, so
  // these ARE their shipping values - dropping any would lose a setting.
  it('keeps every key that only the workout copy carried', () => {
    expect(fromContext.enableWarmup).toBe(true);
    expect(fromContext.enableCooldown).toBe(true);
    expect(fromContext.showSetHistory).toBe(true);
    expect(fromContext.workoutReminderTime).toBe('18:00');
    expect(fromContext.reminderDays).toEqual([1, 2, 3, 4, 5]);
    expect(fromContext.trackBodyWeight).toBe(false);
    expect(fromContext.autoAddSets).toBe(false);
  });
});

describe('this is a defaults-only change', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not rewrite a value the user already stored', () => {
    // Values a device could be holding today, including ones that came from the
    // old workout-side copy back when it also wrote the key.
    const stored: Partial<AppSettings> = {
      workoutSettings: {
        longRestTime: 180,
        extendRestAfterFailure: true,
        timerDisplayMode: 'countdown',
        voiceVolume: 0.8,
        autoAddSets: true,
      } as AppSettings['workoutSettings'],
    };
    localStorage.setItem('appSettings', JSON.stringify(stored));

    const loaded = loadStoredSettings().workoutSettings;

    expect(loaded.longRestTime).toBe(180);
    expect(loaded.extendRestAfterFailure).toBe(true);
    expect(loaded.timerDisplayMode).toBe('countdown');
    expect(loaded.voiceVolume).toBe(0.8);
    expect(loaded.autoAddSets).toBe(true);
    // A key the stored object never had still falls back to the default.
    expect(loaded.defaultRestTime).toBe(fromContext.defaultRestTime);
  });
});
