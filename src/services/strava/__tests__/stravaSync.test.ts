import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../../types';
import { buildCardioSession } from '../../../utils/cardio';
import type { StravaActivitySummary } from '../stravaMapping';
import { stravaSessionFrom } from '../stravaMapping';

const api = vi.hoisted(() => ({
  fetchNewStravaActivities: vi.fn(),
  fetchStravaDetails: vi.fn(),
  ackStravaActivities: vi.fn(),
}));
const db = vi.hoisted(() => ({
  getAllWorkoutSessions: vi.fn(),
  getWorkoutSession: vi.fn(),
  saveImportedWorkoutSessions: vi.fn(),
}));

vi.mock('../stravaApi', () => api);
vi.mock('../../sessionDb', () => db);
vi.mock('../../bodyWeightDb', () => ({ getLatestBodyWeight: vi.fn().mockResolvedValue(75) }));
vi.mock('../../intelligence/profile', () => ({ readAthleteProfile: () => ({ weightKg: null }) }));

import {
  STRAVA_LINKED_KEY,
  backfillStravaDetails,
  isStravaLinkedHere,
  lastStravaSyncAt,
  syncStrava,
} from '../stravaSync';

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

let nextId = 1000;
const activity = (
  daysAgo: number,
  over: Partial<StravaActivitySummary> = {}
): StravaActivitySummary => {
  const start = NOW - daysAgo * DAY;
  const id = nextId++;
  return {
    id,
    sessionId: `00000000-0000-5000-8000-${String(id).padStart(12, '0')}`,
    name: 'Run',
    sportType: 'Run',
    startDate: new Date(start).toISOString(),
    startEpoch: Math.floor(start / 1000),
    distanceM: 5000,
    movingSec: 1500,
    elapsedSec: 1550,
    elevationGainM: 0,
    avgHr: 150,
    maxHr: 170,
    trainer: false,
    workoutType: null,
    kilojoules: null,
    polyline: null,
    ...over,
  };
};

const page = (activities: StravaActivitySummary[], hasMore = false) => ({
  ok: true,
  connected: true,
  activities,
  hasMore,
  newestEpoch: activities.reduce((m, a) => Math.max(m, a.startEpoch), 0),
});

const savedSessions = (): WorkoutSession[] =>
  db.saveImportedWorkoutSessions.mock.calls.flatMap((c) => c[0] as WorkoutSession[]);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  db.getAllWorkoutSessions.mockResolvedValue([]);
  db.getWorkoutSession.mockImplementation(async (id: string) => {
    const all = (await db.getAllWorkoutSessions()) as WorkoutSession[];
    return all.find((s) => s.id === id) ?? null;
  });
  db.saveImportedWorkoutSessions.mockResolvedValue(undefined);
  api.ackStravaActivities.mockResolvedValue({ ok: true });
  api.fetchStravaDetails.mockImplementation(async (ids: number[]) => ({
    ok: true,
    connected: true,
    details: ids.map((id) => ({ id, calories: 400, splits: [] })),
  }));
});

describe('syncStrava', () => {
  it('imports cardio, skips strength, and moves the cursor', async () => {
    const run = activity(2);
    const lift = activity(1, { sportType: 'WeightTraining' });
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([run, lift]));

    const result = await syncStrava();

    expect(result).toEqual({ imported: 1, connected: true });
    expect(savedSessions().map((s) => s.id)).toEqual([run.sessionId]);
    // The cursor passes the skipped lift too, so it is not offered again.
    expect(api.ackStravaActivities).toHaveBeenCalledWith(lift.startEpoch, [run.id, lift.id]);
    expect(isStravaLinkedHere()).toBe(true);
    expect(lastStravaSyncAt()).not.toBeNull();
  });

  it('asks for the detail of recent activities only', async () => {
    const recent = activity(3);
    const old = activity(400);
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([old, recent]));

    await syncStrava();

    expect(api.fetchStravaDetails).toHaveBeenCalledTimes(1);
    expect(api.fetchStravaDetails).toHaveBeenCalledWith([recent.id]);
    const byId = new Map(savedSessions().map((s) => [s.id, s]));
    expect(byId.get(recent.sessionId)?.exercises[0]?.external?.detailed).toBe(true);
    expect(byId.get(old.sessionId)?.exercises[0]?.external?.detailed).toBe(false);
  });

  it('keeps asking while Strava has more history', async () => {
    const first = activity(900);
    const second = activity(10);
    api.fetchNewStravaActivities
      .mockResolvedValueOnce(page([first], true))
      .mockResolvedValueOnce(page([second], false));

    const result = await syncStrava();

    expect(result.imported).toBe(2);
    expect(api.fetchNewStravaActivities).toHaveBeenCalledTimes(2);
    expect(api.ackStravaActivities).toHaveBeenNthCalledWith(1, first.startEpoch, [first.id]);
    expect(api.ackStravaActivities).toHaveBeenNthCalledWith(2, second.startEpoch, [second.id]);
  });

  it('never saves an activity that is already in the app', async () => {
    const run = activity(2);
    const already = stravaSessionFrom(run, null, 75, NOW);
    db.getAllWorkoutSessions.mockResolvedValue([already]);
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([run]));

    const result = await syncStrava();

    expect(result.imported).toBe(0);
    expect(savedSessions()).toEqual([]);
  });

  it('skips a run the user already recorded in the app at the same time', async () => {
    const run = activity(1);
    const recordedHere = buildCardioSession({
      activity: 'run',
      startTime: new Date(run.startEpoch * 1000 + 3 * 60 * 1000).toISOString(),
      durationSec: 1500,
      distanceKm: 5,
    });
    const ride = activity(1, { sportType: 'Ride', distanceM: 20_000, movingSec: 2400 });
    db.getAllWorkoutSessions.mockResolvedValue([recordedHere]);
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([run, ride]));

    await syncStrava();

    // The run is a duplicate; the ride at the same moment is a different discipline.
    expect(savedSessions().map((s) => s.id)).toEqual([ride.sessionId]);
  });

  it('imports a run that merely happened during a gym session', async () => {
    const gymStart = NOW - DAY;
    const gym: WorkoutSession = {
      ...buildCardioSession({
        activity: 'treadmill',
        startTime: new Date(gymStart).toISOString(),
        endTime: new Date(gymStart + 90 * 60_000).toISOString(),
        durationSec: 600,
        distanceKm: 1.5,
      }),
      exercises: [
        ...buildCardioSession({
          activity: 'treadmill',
          startTime: new Date(gymStart).toISOString(),
          durationSec: 600,
          distanceKm: 1.5,
        }).exercises,
        {
          id: 'bench',
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          targetMuscle: 'Chest',
          notes: '',
          restSeconds: 90,
          isCompleted: true,
          order: 1,
          sets: [
            {
              id: 'b1',
              setNumber: 1,
              reps: 8,
              weight: 80,
              rpe: 8,
              isWarmup: false,
              isCompleted: true,
              notes: '',
              completedAt: new Date(gymStart).toISOString(),
            },
          ],
        },
      ],
    };
    // A real run 40 minutes into that gym hour (e.g. a club run after the warm-up).
    const run = activity(1, {
      startDate: new Date(gymStart + 40 * 60_000).toISOString(),
      startEpoch: Math.floor((gymStart + 40 * 60_000) / 1000),
    });
    db.getAllWorkoutSessions.mockResolvedValue([gym]);
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([run]));

    await syncStrava();

    expect(savedSessions().map((s) => s.id)).toEqual([run.sessionId]);
  });

  it('forgets the link when the server says it is gone', async () => {
    localStorage.setItem(STRAVA_LINKED_KEY, '1');
    api.fetchNewStravaActivities.mockResolvedValueOnce({ ok: true, connected: false });

    const result = await syncStrava();

    expect(result).toEqual({ imported: 0, connected: false });
    expect(isStravaLinkedHere()).toBe(false);
  });

  it('stops when the cursor cannot be saved, keeping what was imported', async () => {
    api.fetchNewStravaActivities.mockResolvedValueOnce(page([activity(2)], true));
    api.ackStravaActivities.mockResolvedValueOnce({ ok: false, error: 'failed' });

    const result = await syncStrava();

    expect(result).toEqual({ imported: 1, connected: true, error: 'failed' });
    expect(api.fetchNewStravaActivities).toHaveBeenCalledTimes(1);
  });

  it('shares one run between concurrent callers', async () => {
    api.fetchNewStravaActivities.mockResolvedValue(page([]));
    const [a, b] = await Promise.all([syncStrava(), syncStrava()]);
    expect(a).toBe(b);
    expect(api.fetchNewStravaActivities).toHaveBeenCalledTimes(1);
  });
});

describe('backfillStravaDetails', () => {
  const imported = (daysAgo: number) => {
    const s = stravaSessionFrom(activity(daysAgo), null, 75, NOW);
    if (!s) throw new Error('expected a session');
    return s;
  };

  it('fills in sessions imported without their detail, then pauses', async () => {
    const sessions = [imported(100), imported(200)];
    db.getAllWorkoutSessions.mockResolvedValue(sessions);

    expect(await backfillStravaDetails(NOW)).toBe(2);
    const saved = savedSessions();
    expect(saved.every((s) => s.exercises[0]?.external?.detailed)).toBe(true);
    expect(saved[0]?.caloriesBurned).toBe(400);

    // Paused for 15 minutes.
    expect(await backfillStravaDetails(NOW + 60_000)).toBe(0);
    expect(api.fetchStravaDetails).toHaveBeenCalledTimes(1);
  });

  it('does not bring back a session deleted while Strava was answering', async () => {
    const kept = imported(100);
    const deleted = imported(200);
    db.getAllWorkoutSessions.mockResolvedValue([kept, deleted]);
    db.getWorkoutSession.mockImplementation(async (id: string) => (id === kept.id ? kept : null));

    expect(await backfillStravaDetails(NOW)).toBe(1);
    expect(savedSessions().map((s) => s.id)).toEqual([kept.id]);
  });

  it('backs off for an hour when Strava says too many requests', async () => {
    db.getAllWorkoutSessions.mockResolvedValue([imported(100)]);
    api.fetchStravaDetails.mockResolvedValueOnce({ ok: false, error: 'strava_rate_limited' });

    expect(await backfillStravaDetails(NOW)).toBe(0);
    expect(await backfillStravaDetails(NOW + 30 * 60_000)).toBe(0);
    expect(api.fetchStravaDetails).toHaveBeenCalledTimes(1);
  });

  it('does nothing when every imported session already has its detail', async () => {
    db.getAllWorkoutSessions.mockResolvedValue([
      buildCardioSession({
        activity: 'run',
        startTime: new Date(NOW).toISOString(),
        durationSec: 60,
      }),
    ]);
    expect(await backfillStravaDetails(NOW)).toBe(0);
    expect(api.fetchStravaDetails).not.toHaveBeenCalled();
  });
});
