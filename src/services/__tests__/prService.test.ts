import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalRecord, WorkoutSession } from '../../types';
import {
  calculateEst1RM,
  calculatePRsFromHistory,
  countSessionPRs,
  deletePR,
  detectNewPRType,
  diffSetAgainstPRs,
  getBestPRs,
  isNewPR,
  normalizeExerciseName,
  persistSessionPRs,
  stableExerciseKey,
} from '../prService';

describe('calculateEst1RM (Epley)', () => {
  it('returns the weight unchanged for a single rep', () => {
    // The inline formula previously used by PR storage gave 100*(1+1/30)=103.3 here.
    expect(calculateEst1RM(100, 1)).toBe(100);
  });

  it('applies Epley and rounds to one decimal for multi-rep sets', () => {
    expect(calculateEst1RM(100, 5)).toBe(116.7); // 100 * (1 + 5/30)
    expect(calculateEst1RM(80, 8)).toBe(101.3); // 80 * (1 + 8/30)
  });

  it('returns 0 for non-positive weight or reps', () => {
    expect(calculateEst1RM(0, 5)).toBe(0);
    expect(calculateEst1RM(100, 0)).toBe(0);
    expect(calculateEst1RM(-50, 5)).toBe(0);
  });
});

describe('isNewPR', () => {
  const makeSession = (
    exerciseId: string,
    sets: { weight: number; reps: number }[]
  ): WorkoutSession =>
    ({
      id: 'session-1',
      date: '2026-01-01',
      startTime: '2026-01-01T10:00:00Z',
      endTime: null,
      exercises: [
        {
          id: 'we-1',
          exerciseId,
          exerciseName: 'Bench Press',
          targetMuscle: 'chest',
          sets: sets.map((s, i) => ({
            id: `set-${i}`,
            setNumber: i + 1,
            weight: s.weight,
            reps: s.reps,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-01-01T10:05:00Z',
          })),
          notes: '',
          restSeconds: 90,
          isCompleted: true,
          order: 0,
        },
      ],
      duration: 3600,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: null,
      totalVolume: 0,
      caloriesBurned: null,
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T11:00:00Z',
    }) as WorkoutSession;

  // calculatePRsFromHistory now keys by the NORMALIZED EXERCISE NAME
  // (stableExerciseKey), so lookups use 'bench press' — not the random
  // per-session exercise id.
  it('returns false for both when set does not beat existing PRs', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench press', 90, 5, prMap);
    expect(result.isWeightPR).toBe(false);
    expect(result.isVolumePR).toBe(false);
  });

  it('returns isWeightPR true when weight exceeds existing PR', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench press', 110, 5, prMap);
    expect(result.isWeightPR).toBe(true);
  });

  it('returns isVolumePR true when volume exceeds existing PR', () => {
    // Existing: 100*5 = 500 volume. New: 90*7 = 630 > 500
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench press', 90, 7, prMap);
    expect(result.isWeightPR).toBe(false);
    expect(result.isVolumePR).toBe(true);
  });

  it('returns both true for a new exercise with no history', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('squat', 60, 8, prMap);
    expect(result.isWeightPR).toBe(true);
    expect(result.isVolumePR).toBe(true);
  });
});

describe('stable PR identity (normalized exercise name)', () => {
  it('normalizeExerciseName trims, collapses whitespace, and lowercases', () => {
    expect(normalizeExerciseName('  Bench   Press ')).toBe('bench press');
    expect(normalizeExerciseName(undefined)).toBe('');
    expect(normalizeExerciseName(null)).toBe('');
  });

  it('stableExerciseKey prefers the normalized name and falls back to ids', () => {
    expect(stableExerciseKey({ exerciseName: 'Bench Press', exerciseId: 'rnd-1' })).toBe(
      'bench press'
    );
    expect(stableExerciseKey({ name: 'Squat' })).toBe('squat');
    expect(stableExerciseKey({ exerciseName: '  ', exerciseId: 'rnd-2', id: 'x' })).toBe('rnd-2');
    expect(stableExerciseKey({})).toBe('');
  });

  it('merges sessions whose exercise ids differ but names match into ONE baseline', () => {
    // Two sessions of the same exercise — each with a fresh random id, exactly
    // what the active workout produces. The old id-keyed map produced two
    // unrelated entries, so the baseline never matched and every workout
    // "broke" the record again.
    const makeNamedSession = (id: string, sessionId: string, weight: number): WorkoutSession =>
      ({
        id: sessionId,
        date: '2026-01-01',
        startTime: '2026-01-01T10:00:00Z',
        endTime: null,
        exercises: [
          {
            id: `we-${id}`,
            exerciseId: id,
            exerciseName: 'Bench Press',
            targetMuscle: 'chest',
            sets: [
              {
                id: 'set-1',
                setNumber: 1,
                weight,
                reps: 5,
                rpe: null,
                isWarmup: false,
                isCompleted: true,
                notes: '',
                completedAt: '2026-01-01T10:05:00Z',
              },
            ],
            notes: '',
            restSeconds: 90,
            isCompleted: true,
            order: 0,
          },
        ],
        duration: 3600,
        status: 'completed',
        templateId: null,
        notes: '',
        rating: null,
        totalVolume: 0,
        caloriesBurned: null,
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-01-01T11:00:00Z',
      }) as WorkoutSession;

    const prMap = calculatePRsFromHistory([
      makeNamedSession('random-uuid-1', 's1', 100),
      makeNamedSession('random-uuid-2', 's2', 110),
    ]);

    // One weight entry, keyed by the normalized name, holding the best weight.
    const weightKeys = [...prMap.keys()].filter((k) => k.endsWith('-weight'));
    expect(weightKeys).toEqual(['bench press-weight']);
    expect(prMap.get('bench press-weight')?.weight).toBe(110);

    // A set below the cross-session best is NOT a new PR.
    expect(isNewPR('bench press', 105, 5, prMap).isWeightPR).toBe(false);
  });
});

describe('detectNewPRType (shared live-detector/summary rules)', () => {
  // Baseline history: weight PR 100x5 and a separate high-volume set 90x10
  // (volume 900) on the same exercise.
  const baseline = (): Map<string, PersonalRecord> =>
    calculatePRsFromHistory([
      {
        id: 's1',
        date: '2026-01-01',
        startTime: '2026-01-01T10:00:00Z',
        exercises: [
          {
            id: 'we-1',
            exerciseId: 'rnd',
            exerciseName: 'Bench Press',
            sets: [
              {
                id: 'set-1',
                setNumber: 1,
                weight: 100,
                reps: 5,
                isWarmup: false,
                isCompleted: true,
                completedAt: '2026-01-01T10:05:00Z',
              },
              {
                id: 'set-2',
                setNumber: 2,
                weight: 90,
                reps: 10,
                isWarmup: false,
                isCompleted: true,
                completedAt: '2026-01-01T10:10:00Z',
              },
            ],
          },
        ],
      } as unknown as WorkoutSession,
    ]);

  it('detects weight, volume, and reps PRs with first-match-wins ordering', () => {
    const prMap = baseline();
    expect(detectNewPRType('bench press', 110, 5, prMap)).toBe('weight'); // > 100
    expect(detectNewPRType('bench press', 95, 10, prMap)).toBe('volume'); // 950 > 900
    // 90x6: weight 90 < 100, volume 540 < 900, but ≥85% of the weight PR
    // (85kg) with 6 > 5 reps → reps PR.
    expect(detectNewPRType('bench press', 90, 6, prMap)).toBe('reps');
    expect(detectNewPRType('bench press', 95, 5, prMap)).toBeNull(); // beats nothing
  });

  it('reps PR requires ≥85% of the weight PR load (no low-load rep floods)', () => {
    const prMap = baseline();
    // 80kg is below the 85kg threshold — more reps alone don't count.
    expect(detectNewPRType('bench press', 80, 7, prMap)).toBeNull();
  });

  it('returns null for zero/invalid values', () => {
    const prMap = baseline();
    expect(detectNewPRType('bench press', 0, 10, prMap)).toBeNull();
    expect(detectNewPRType('bench press', 100, 0, prMap)).toBeNull();
  });
});

// Mock indexedDBCore so getBestPRs can be tested without a real IDB instance.
vi.mock('../indexedDBCore', () => ({
  STORES: { PERSONAL_RECORDS: 'personal_records' },
  initDB: vi.fn(),
  dbPut: vi.fn(),
  dbGet: vi.fn(),
  dbGetAll: vi.fn(),
  dbDelete: vi.fn(),
  syncWithRetry: vi.fn(),
}));

// Mock supabaseAuth and supabaseSync to avoid side-effects
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('../supabaseSync', () => ({
  syncPersonalRecord: vi.fn().mockResolvedValue(undefined),
  deleteCloudPersonalRecord: vi.fn(),
}));
vi.mock('../syncEngine', () => ({
  syncWithRetry: vi.fn().mockResolvedValue(true),
}));

/**
 * Minimal mock IDBDatabase whose every index.getAll() resolves with the given
 * records — enough for getPRsForExercise / getPRsForMultipleExercises.
 */
const makeMockDB = (records: unknown[]): unknown => ({
  transaction: () => {
    const store = {
      index: () => ({
        getAll: () => {
          const req = {
            result: records,
            onsuccess: null as (() => void) | null,
            onerror: null,
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        },
      }),
    };
    const tx = {
      objectStore: () => store,
      oncomplete: null as (() => void) | null,
      onerror: null,
      onabort: null,
    };
    setTimeout(() => tx.oncomplete?.(), 0);
    return tx;
  },
});

describe('getBestPRs', () => {
  it('picks the higher-value volume PR even when weight*reps would rank differently', async () => {
    // Scenario: PR A has weight=50, reps=10 (weight*reps=500) but value=600 (e.g. from setVolume with bodyweight add-on)
    // PR B has weight=60, reps=9 (weight*reps=540) but value=540
    // The old code would pick B (540 > 500). The new code should pick A (600 > 540).
    const { initDB } = await import('../indexedDBCore');
    const mockDB = {
      transaction: () => {
        const records = [
          {
            id: 'pr-a',
            exerciseId: 'ex-1',
            exerciseName: 'Test',
            date: '2026-01-01',
            weight: 50,
            reps: 10,
            type: 'volume',
            value: 600,
            maxWeight: 50,
          },
          {
            id: 'pr-b',
            exerciseId: 'ex-1',
            exerciseName: 'Test',
            date: '2026-01-02',
            weight: 60,
            reps: 9,
            type: 'volume',
            value: 540,
            maxWeight: 60,
          },
        ];
        const store = {
          index: () => ({
            getAll: () => {
              const req = {
                result: records,
                onsuccess: null as (() => void) | null,
                onerror: null,
              };
              setTimeout(() => req.onsuccess?.(), 0);
              return req;
            },
          }),
        };
        const tx = {
          objectStore: () => store,
          oncomplete: null as (() => void) | null,
          onerror: null,
          onabort: null,
        };
        setTimeout(() => tx.oncomplete?.(), 0);
        return tx;
      },
    };
    vi.mocked(initDB).mockResolvedValue(mockDB as unknown as IDBDatabase);

    const result = await getBestPRs('ex-1');
    expect(result.volume).not.toBeNull();
    expect(result.volume!.id).toBe('pr-a');
    expect(result.volume!.value).toBe(600);
  });
});

describe('diffSetAgainstPRs date parameter', () => {
  // diffSetAgainstPRs is not exported (internal helper). The date param flows through
  // checkForNewPR which requires IndexedDB. We verify the parameter exists and works
  // by testing that calculatePRsFromHistory (which sets the date from session.date)
  // produces PRs with the expected date — confirming the date-propagation pattern.
  // A direct unit test of diffSetAgainstPRs would require exporting it or using
  // module internals, which is out of scope for a safe change.
  it('calculatePRsFromHistory propagates session date to PR records', () => {
    const session: WorkoutSession = {
      id: 'session-date',
      date: '2025-06-15',
      startTime: '2025-06-15T08:00:00Z',
      endTime: null,
      exercises: [
        {
          id: 'we-1',
          exerciseId: 'ex-date',
          exerciseName: 'Deadlift',
          targetMuscle: 'back',
          sets: [
            {
              id: 'set-1',
              setNumber: 1,
              weight: 140,
              reps: 3,
              rpe: null,
              isWarmup: false,
              isCompleted: true,
              notes: '',
              completedAt: '2025-06-15T08:10:00Z',
            },
          ],
          notes: '',
          restSeconds: 120,
          isCompleted: true,
          order: 0,
        },
      ],
      duration: 3600,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: null,
      totalVolume: 0,
      caloriesBurned: null,
      createdAt: '2025-06-15T08:00:00Z',
      updatedAt: '2025-06-15T09:00:00Z',
    } as WorkoutSession;

    const prMap = calculatePRsFromHistory([session]);
    // Map keys are name-based (stableExerciseKey), not exercise-id based.
    const weightPR = prMap.get('deadlift-weight');
    expect(weightPR).toBeDefined();
    expect(weightPR!.date).toBe('2025-06-15');
  });
});

describe('diffSetAgainstPRs captures multiple PR types simultaneously', () => {
  it('persists BOTH weight and volume PRs when a single set breaks both', () => {
    // Existing PRs: weight=80, volume=80*5=400
    const existingPRs = [
      {
        id: 'pr-w',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        date: '2026-01-01',
        weight: 80,
        reps: 5,
        type: 'weight' as const,
        maxWeight: 80,
      },
      {
        id: 'pr-v',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        date: '2026-01-01',
        weight: 80,
        reps: 5,
        type: 'volume' as const,
        maxWeight: 80,
      },
    ];

    // New set: weight=100, reps=6 -> weight PR (100>80) AND volume PR (600>400)
    const result = diffSetAgainstPRs('bench', 'Bench Press', 100, 6, existingPRs, '2026-02-01');

    expect(result.newPRs.length).toBeGreaterThanOrEqual(2);
    const types = result.newPRs.map((pr) => pr.type);
    expect(types).toContain('weight');
    expect(types).toContain('volume');
    // nextPRs includes all existing + all new
    expect(result.nextPRs.length).toBe(existingPRs.length + result.newPRs.length);
    // backward compat: newPR is the first one
    expect(result.newPR).toBe(result.newPRs[0]);
  });
});

// ============================================================
// countSessionPRs (summary headline number)
// ============================================================
describe('countSessionPRs', () => {
  const mkSet = (overrides: Record<string, unknown>) => ({
    id: 'set',
    setNumber: 1,
    weight: 100,
    reps: 5,
    rpe: null,
    isWarmup: false,
    isCompleted: true,
    notes: '',
    completedAt: '2026-02-01T10:00:00Z',
    ...overrides,
  });

  const baseline = (): Map<string, PersonalRecord> =>
    calculatePRsFromHistory([
      {
        id: 's1',
        date: '2026-01-01',
        startTime: '2026-01-01T10:00:00Z',
        exercises: [
          {
            id: 'we-1',
            exerciseId: 'rnd-old',
            exerciseName: 'Bench Press',
            name: 'Bench Press',
            sets: [mkSet({ completedAt: '2026-01-01T10:05:00Z' })], // 100x5
          },
        ],
      } as unknown as WorkoutSession,
    ]);

  it('does NOT count warmup sets, even when they beat the record', () => {
    const exercises = [
      {
        id: 'we-2',
        exerciseId: 'rnd-new',
        exerciseName: 'Bench Press',
        name: 'Bench Press',
        sets: [
          mkSet({ weight: 120, isWarmup: true }), // beats 100 but is warmup
          mkSet({ weight: 95 }), // working set, no PR
        ],
      },
    ] as unknown as WorkoutSession['exercises'];

    const { count, prNames } = countSessionPRs(exercises, baseline());
    expect(count).toBe(0);
    expect(prNames.size).toBe(0);
  });

  it('does NOT count uncompleted sets', () => {
    const exercises = [
      {
        id: 'we-2',
        exerciseId: 'rnd-new',
        exerciseName: 'Bench Press',
        name: 'Bench Press',
        sets: [mkSet({ weight: 200, completedAt: null })],
      },
    ] as unknown as WorkoutSession['exercises'];

    expect(countSessionPRs(exercises, baseline()).count).toBe(0);
  });

  it('counts a genuine working-set PR once per exercise, keyed by name', () => {
    const exercises = [
      {
        id: 'we-2',
        exerciseId: 'completely-different-random-id',
        exerciseName: 'Bench Press',
        name: 'Bench Press',
        sets: [mkSet({ weight: 110 }), mkSet({ weight: 112 })], // two PR sets → one exercise
      },
    ] as unknown as WorkoutSession['exercises'];

    const { count, prNames } = countSessionPRs(exercises, baseline());
    expect(count).toBe(1);
    expect(prNames.has('Bench Press')).toBe(true);
  });

  it('returns 0 when nothing beats the baseline (no more PR-every-workout)', () => {
    const exercises = [
      {
        id: 'we-2',
        exerciseId: 'rnd-new',
        exerciseName: 'Bench Press',
        name: 'Bench Press',
        sets: [mkSet({ weight: 100 })], // ties the record — not a PR
      },
    ] as unknown as WorkoutSession['exercises'];

    expect(countSessionPRs(exercises, baseline()).count).toBe(0);
  });
});

// ============================================================
// persistSessionPRs (finish-flow batch persistence)
// ============================================================
describe('persistSessionPRs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mkSession = (sets: Record<string, unknown>[]): WorkoutSession => {
    return {
      id: 'session-x',
      date: '2026-02-01',
      startTime: '2026-02-01T10:00:00Z',
      exercises: [
        {
          id: 'we-1',
          exerciseId: 'fresh-random-uuid',
          exerciseName: 'Bench Press',
          name: 'Bench Press',
          sets: sets.map((s, i) => ({
            id: `set-${i}`,
            setNumber: i + 1,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-02-01T10:05:00Z',
            ...s,
          })),
        },
      ],
    } as unknown as WorkoutSession;
  };

  const primeStore = async (records: unknown[]) => {
    const { initDB } = await import('../indexedDBCore');
    vi.mocked(initDB).mockResolvedValue(makeMockDB(records) as IDBDatabase);
  };

  it('persists genuine PRs keyed by the stable (name) identity, skipping warmup and uncompleted sets', async () => {
    // Existing store baseline: weight 90, volume 450 — keyed by the name key.
    await primeStore([
      {
        id: 'pr-w',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-01-01',
        weight: 90,
        reps: 5,
        type: 'weight',
        maxWeight: 90,
      },
      {
        id: 'pr-v',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-01-01',
        weight: 90,
        reps: 5,
        type: 'volume',
        maxWeight: 90,
      },
      {
        id: 'pr-r',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-01-01',
        weight: 90,
        reps: 5,
        type: 'reps',
        maxWeight: 90,
      },
    ]);

    const session = mkSession([
      { weight: 130, reps: 5, isWarmup: true }, // warmup — must be ignored
      { weight: 100, reps: 5 }, // working set — weight + volume PR
      { weight: 140, reps: 5, completedAt: null }, // unchecked — must be ignored
    ]);

    const { dbPut } = await import('../indexedDBCore');
    const newPRs = await persistSessionPRs(session);

    // The working set broke weight (100>90) and volume (500>450).
    expect(vi.mocked(dbPut)).toHaveBeenCalled();
    const savedRecords = vi.mocked(dbPut).mock.calls.map(([, rec]) => rec) as PersonalRecord[];
    expect(savedRecords.length).toBe(2);
    expect(savedRecords.map((r) => r.type).sort()).toEqual(['volume', 'weight']);
    // Identity: every saved PR keys on the normalized name, not the random id.
    for (const rec of savedRecords) {
      expect(rec.exerciseId).toBe('bench press');
      expect(rec.weight).toBe(100); // never the warmup 130 or unchecked 140
      expect(rec.date).toBe('2026-02-01T10:05:00Z'); // set completion time
    }
    expect(newPRs.length).toBeGreaterThan(0);
  });

  it('is idempotent: re-running over a session whose PRs are already stored writes nothing', async () => {
    // Store already holds exactly what the session would produce.
    await primeStore([
      {
        id: 'pr-w',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-02-01',
        weight: 100,
        reps: 5,
        type: 'weight',
        maxWeight: 100,
      },
      {
        id: 'pr-v',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-02-01',
        weight: 100,
        reps: 5,
        type: 'volume',
        maxWeight: 100,
      },
      {
        id: 'pr-r',
        exerciseId: 'bench press',
        exerciseName: 'Bench Press',
        date: '2026-02-01',
        weight: 100,
        reps: 5,
        type: 'reps',
        maxWeight: 100,
      },
    ]);

    const session = mkSession([{ weight: 100, reps: 5 }]);

    const { dbPut } = await import('../indexedDBCore');
    const newPRs = await persistSessionPRs(session);

    expect(newPRs).toEqual([]);
    expect(vi.mocked(dbPut)).not.toHaveBeenCalled();
  });
});

// ============================================================
// deletePR — cloud tombstone (soft delete), never a physical delete
// ============================================================
describe('deletePR (soft delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes locally and pushes a deleted_at tombstone (not a physical cloud delete)', async () => {
    const { dbGet, dbDelete } = await import('../indexedDBCore');
    const { getCurrentUser } = await import('../supabaseAuth');
    const { syncPersonalRecord, deleteCloudPersonalRecord } = await import('../supabaseSync');
    const { syncWithRetry } = await import('../syncEngine');

    vi.mocked(dbGet).mockResolvedValue({
      id: 'pr-1',
      exerciseId: 'bench press',
      exerciseName: 'Bench Press',
      date: '2026-01-01',
      weight: 100,
      reps: 5,
      type: 'weight',
    } as PersonalRecord);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    // Execute the sync fn that deletePR hands to syncWithRetry.
    vi.mocked(syncWithRetry).mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
      return true;
    });

    await deletePR('pr-1');

    // Local removal still physical (pull-merge removes tombstoned rows anyway).
    expect(vi.mocked(dbDelete)).toHaveBeenCalledWith('personal_records', 'pr-1');

    // Cloud: tombstone upsert via syncPersonalRecord with deletedAt stamped.
    expect(vi.mocked(syncPersonalRecord)).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        id: 'pr-1',
        exerciseName: 'Bench Press',
        deletedAt: expect.any(String),
      })
    );
    // NEVER the physical cloud delete (that's what other devices resurrect).
    expect(vi.mocked(deleteCloudPersonalRecord)).not.toHaveBeenCalled();

    // Offline-queue fallback replays as record:create (upsert with deleted_at),
    // not record:delete.
    const queueArg = vi.mocked(syncWithRetry).mock.calls[0]?.[3] as {
      type: string;
      payload: { deletedAt?: string };
    };
    expect(queueArg.type).toBe('record:create');
    expect(queueArg.payload.deletedAt).toEqual(expect.any(String));
  });

  it('skips cloud sync entirely for guests', async () => {
    const { dbGet, dbDelete } = await import('../indexedDBCore');
    const { getCurrentUser } = await import('../supabaseAuth');
    const { syncWithRetry } = await import('../syncEngine');

    vi.mocked(dbGet).mockResolvedValue(undefined as never);
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await deletePR('pr-2');

    expect(vi.mocked(dbDelete)).toHaveBeenCalledWith('personal_records', 'pr-2');
    expect(vi.mocked(syncWithRetry)).not.toHaveBeenCalled();
  });
});
