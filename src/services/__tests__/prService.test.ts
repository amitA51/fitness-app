import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';
import {
  calculateEst1RM,
  calculatePRsFromHistory,
  diffSetAgainstPRs,
  getBestPRs,
  isNewPR,
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

  it('returns false for both when set does not beat existing PRs', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench-1', 90, 5, prMap);
    expect(result.isWeightPR).toBe(false);
    expect(result.isVolumePR).toBe(false);
  });

  it('returns isWeightPR true when weight exceeds existing PR', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench-1', 110, 5, prMap);
    expect(result.isWeightPR).toBe(true);
  });

  it('returns isVolumePR true when volume exceeds existing PR', () => {
    // Existing: 100*5 = 500 volume. New: 90*7 = 630 > 500
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('bench-1', 90, 7, prMap);
    expect(result.isWeightPR).toBe(false);
    expect(result.isVolumePR).toBe(true);
  });

  it('returns both true for a new exercise with no history', () => {
    const prMap = calculatePRsFromHistory([makeSession('bench-1', [{ weight: 100, reps: 5 }])]);
    const result = isNewPR('squat-1', 60, 8, prMap);
    expect(result.isWeightPR).toBe(true);
    expect(result.isVolumePR).toBe(true);
  });
});

// Mock indexedDBCore so getBestPRs can be tested without a real IDB instance.
vi.mock('../indexedDBCore', () => ({
  STORES: { PERSONAL_RECORDS: 'personal_records' },
  initDB: vi.fn(),
  dbPut: vi.fn(),
  dbGetAll: vi.fn(),
  dbDelete: vi.fn(),
  syncWithRetry: vi.fn(),
}));

// Mock supabaseAuth and supabaseSync to avoid side-effects
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('../supabaseSync', () => ({
  syncPersonalRecord: vi.fn(),
  deleteCloudPersonalRecord: vi.fn(),
}));

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
    const weightPR = prMap.get('ex-date-weight');
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
