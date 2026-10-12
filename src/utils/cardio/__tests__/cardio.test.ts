import { describe, expect, it } from 'vitest';
import {
  buildCardioSession,
  cardioDiscipline,
  cardioDistance,
  cardioEffortOf,
  cardioMet,
  cardioPace,
  cardioSnapshot,
  estimateCardioCalories,
  formatClock,
  formatKm,
  formatPace,
  hrMaxFromAge,
  hrZoneOf,
  hrZones,
  isCardioSession,
  longRunSpike,
  paceSecPerKm,
  parseClock,
  parseDecimal,
  predictRaceSec,
  resolveCardioActivity,
  sessionCardioTotals,
  speedKmh,
  workoutCalories,
} from '..';
import type { WorkoutExercise, WorkoutSet } from '../../../types';

const cardioSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's1',
  setNumber: 1,
  reps: 0,
  weight: 0,
  rpe: null,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-10-11T07:00:00.000Z',
  ...overrides,
});

const exercise = (overrides: Partial<WorkoutExercise>): WorkoutExercise => ({
  id: 'e1',
  exerciseId: 'x',
  exerciseName: 'ריצה | Running',
  targetMuscle: 'Cardio',
  sets: [],
  notes: '',
  restSeconds: 0,
  isCompleted: true,
  order: 0,
  ...overrides,
});

describe('pace and speed', () => {
  it('derives seconds per km and km/h from distance and time', () => {
    expect(paceSecPerKm(5, 1500)).toBe(300);
    expect(speedKmh(10, 3600)).toBe(10);
  });

  it('returns null when either side is missing', () => {
    expect(paceSecPerKm(0, 1500)).toBeNull();
    expect(speedKmh(5, null)).toBeNull();
  });
});

describe('cardioMet', () => {
  it('uses the ACSM running equation for a run (10 km/h flat ≈ 10.5 MET)', () => {
    expect(cardioMet('run', { speedKmh: 10 })).toBeCloseTo(10.52, 1);
  });

  it('treats a slow treadmill as walking and adds the incline cost', () => {
    // 5 km/h at 10% grade: VO2 = 3.5 + 8.33 + 15.0 = 26.83 → 7.67 MET
    expect(cardioMet('treadmill', { speedKmh: 5, inclinePct: 10 })).toBeCloseTo(7.67, 1);
    expect(cardioMet('treadmill', { speedKmh: 5 })).toBeLessThan(
      cardioMet('treadmill', { speedKmh: 5, inclinePct: 10 })
    );
  });

  it('grades machines by perceived effort', () => {
    expect(cardioMet('elliptical', { effort: 9 })).toBeGreaterThan(
      cardioMet('elliptical', { effort: 2 })
    );
    expect(cardioMet('row')).toBe(6.0);
  });

  it('grades road cycling by speed', () => {
    expect(cardioMet('cycle', { speedKmh: 27 })).toBe(12.0);
    expect(cardioMet('cycle', { speedKmh: 12 })).toBe(4.0);
  });
});

describe('estimateCardioCalories', () => {
  it('is MET × kg × hours', () => {
    // 10 km in an hour, 70 kg → 10.52 × 70 × 1 ≈ 737
    expect(
      estimateCardioCalories({ activity: 'run', durationSec: 3600, distanceKm: 10, weightKg: 70 })
    ).toBe(737);
  });

  it('shows nothing rather than guessing a body weight', () => {
    expect(
      estimateCardioCalories({ activity: 'run', durationSec: 3600, distanceKm: 10, weightKg: null })
    ).toBeNull();
  });
});

describe('heart rate', () => {
  it('predicts HRmax with Tanaka, not 220 − age', () => {
    expect(hrMaxFromAge(30)).toBe(187);
    expect(hrMaxFromAge(5)).toBeNull();
  });

  it('builds five %HRmax zones', () => {
    const zones = hrZones(200);
    expect(zones).toHaveLength(5);
    expect(zones[1]).toEqual({ zone: 2, min: 120, max: 140 });
  });

  it('uses heart-rate reserve when a resting rate is known (Karvonen)', () => {
    // rest 60, max 200 → zone 2 lower bound = 60 + 0.6 × 140 = 144
    expect(hrZones(200, 60)[1]?.min).toBe(144);
  });

  it('finds the zone of a heart rate', () => {
    const zones = hrZones(200);
    expect(hrZoneOf(150, zones)).toBe(3);
    expect(hrZoneOf(195, zones)).toBe(5);
    expect(hrZoneOf(80, zones)).toBeNull();
  });
});

describe('race estimate and long-run spike', () => {
  it('applies Riegel inside 1.5–21.1 km', () => {
    // 5K in 25:00 → 10K ≈ 1500 × 2^1.06 ≈ 3127 s
    expect(Math.round(predictRaceSec(1500, 5, 10) ?? 0)).toBe(3127);
  });

  it('does not offer a marathon estimate (Riegel is optimistic there)', () => {
    expect(predictRaceSec(1500, 5, 42.195)).toBeNull();
  });

  it('flags a single run >10% longer than the 30-day longest', () => {
    expect(longRunSpike(11.5, 10)).toBeCloseTo(0.15);
    expect(longRunSpike(10.5, 10)).toBeNull();
    expect(longRunSpike(15, null)).toBeNull();
  });
});

describe('formatting', () => {
  it('writes clock times', () => {
    expect(formatClock(1720)).toBe('28:40');
    expect(formatClock(3735)).toBe('1:02:15');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('writes pace and distance', () => {
    expect(formatPace(331)).toBe('5:31');
    expect(formatPace(4000)).toBeNull();
    expect(formatKm(5.2)).toBe('5.2');
    expect(formatKm(5.214)).toBe('5.21');
    expect(formatKm(12)).toBe('12');
  });

  it('writes speed the activity way', () => {
    expect(cardioPace('run', 5, 1655)).toEqual({ value: '5:31', unit: 'דק׳/ק״מ' });
    expect(cardioPace('cycle', 30, 3600)).toEqual({ value: '30.0', unit: 'קמ״ש' });
    expect(cardioPace('row', 2, 480)).toEqual({ value: '2:00', unit: 'ל־500 מ׳' });
    expect(cardioPace('swim', 1.5, 1800)).toEqual({ value: '2:00', unit: 'ל־100 מ׳' });
    expect(cardioPace('elliptical', 5, 1800)).toBeNull();
  });

  it('writes pool and rower distance in metres', () => {
    expect(cardioDistance('swim', 1.5)).toEqual({ value: '1,500', unit: 'מ׳' });
    expect(cardioDistance('run', 5.21)).toEqual({ value: '5.21', unit: 'ק״מ' });
  });

  it('parses typed times and decimals', () => {
    expect(parseClock('28:40')).toBe(1720);
    expect(parseClock('45')).toBe(2700);
    expect(parseClock('1:02:15')).toBe(3735);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseDecimal('5,2')).toBe(5.2);
    expect(parseDecimal('')).toBeNull();
  });
});

describe('resolveCardioActivity', () => {
  it('maps built-in names, including older catalog entries', () => {
    expect(resolveCardioActivity({ name: 'ריצה על מסילה | Treadmill Run' })).toBe('treadmill');
    expect(resolveCardioActivity({ exerciseName: 'הליכה בשיפוע | Incline Walk' })).toBe(
      'treadmill'
    );
    expect(resolveCardioActivity({ name: 'מכונת חתירה | Rowing Machine' })).toBe('row');
  });

  it('never makes a lift cardio from its name', () => {
    expect(resolveCardioActivity({ name: 'חתירה עם מוט | Barbell Row' })).toBeNull();
  });

  it('honours an explicit tracking type', () => {
    expect(
      resolveCardioActivity({ name: 'ריצה | Running', trackingType: 'weight_reps' })
    ).toBeNull();
    expect(resolveCardioActivity({ name: 'ספינינג', trackingType: 'cardio' })).toBe('other');
    expect(resolveCardioActivity({ name: 'ספינינג', cardioActivity: 'indoor_cycle' })).toBe(
      'indoor_cycle'
    );
  });
});

describe('cardio efforts in a session', () => {
  it('sums intervals and weights the average heart rate by time', () => {
    const ex = exercise({
      sets: [
        cardioSet({ id: 'a', duration: 600, distanceKm: 2, avgHr: 150 }),
        cardioSet({ id: 'b', duration: 300, distanceKm: 1, avgHr: 180, maxHr: 190 }),
        cardioSet({ id: 'c', duration: 0, completedAt: null }),
      ],
    });
    const effort = cardioEffortOf(ex);
    expect(effort?.distanceKm).toBe(3);
    expect(effort?.durationSec).toBe(900);
    expect(effort?.avgHr).toBe(160);
    expect(effort?.maxHr).toBe(190);
    expect(effort?.sets).toBe(2);
  });

  it('is null for a cardio exercise logged the old way (0 kg × reps)', () => {
    const ex = exercise({
      exerciseName: 'ריצה על מסילה | Treadmill Run',
      sets: [cardioSet({ reps: 10 })],
    });
    expect(cardioEffortOf(ex)).toBeNull();
  });

  it('calls a cardio-only session a cardio session, and a gym day with a warm-up not', () => {
    const run = exercise({ sets: [cardioSet({ duration: 1800, distanceKm: 5 })] });
    const bench = exercise({
      id: 'e2',
      exerciseName: 'לחיצת חזה | Bench Press',
      sets: [cardioSet({ id: 'b1', weight: 60, reps: 8 })],
    });
    expect(isCardioSession({ exercises: [run] })).toBe(true);
    expect(isCardioSession({ exercises: [run, bench] })).toBe(false);
    expect(sessionCardioTotals({ exercises: [run, bench] })).toEqual({
      distanceKm: 5,
      durationSec: 1800,
    });
  });

  it('counts a slow treadmill effort as walking', () => {
    expect(cardioDiscipline('treadmill', 5.5)).toBe('walking');
    expect(cardioDiscipline('treadmill', 10)).toBe('running');
    expect(cardioDiscipline('treadmill', null)).toBe('running');
  });
});

describe('buildCardioSession', () => {
  it('builds a completed session that every existing screen can read', () => {
    const session = buildCardioSession(
      {
        activity: 'run',
        startTime: new Date(2026, 9, 11, 6, 30).toISOString(),
        durationSec: 1655,
        distanceKm: 5,
        avgHr: 152,
        effort: 6,
        runType: 'easy',
        notes: '  בוקר  ',
        weightKg: 70,
      },
      Date.UTC(2026, 9, 11, 8)
    );
    const ex = session.exercises[0];
    expect(session.status).toBe('completed');
    expect(session.date).toBe('2026-10-11');
    expect(session.duration).toBe(1655);
    expect(session.totalVolume).toBe(0);
    expect(session.notes).toBe('בוקר');
    expect(session.caloriesBurned).toBeGreaterThan(300);
    expect(ex?.trackingType).toBe('cardio');
    expect(ex?.cardioActivity).toBe('run');
    expect(ex?.runType).toBe('easy');
    expect(ex?.exerciseName).toBe('ריצה | Running');
    expect(ex?.sets[0]).toMatchObject({
      duration: 1655,
      distanceKm: 5,
      avgHr: 152,
      rpe: 6,
      isCompleted: true,
    });
    expect(new Date(session.endTime ?? '').getTime() - new Date(session.startTime).getTime()).toBe(
      1655 * 1000
    );
    expect(isCardioSession(session)).toBe(true);
  });

  it('prefers the calories from the user’s watch and drops empty fields', () => {
    const session = buildCardioSession({
      activity: 'elliptical',
      startTime: new Date().toISOString(),
      durationSec: 1200,
      distanceKm: 0,
      calories: 210,
      runType: 'tempo',
      weightKg: 80,
    });
    const set = session.exercises[0]?.sets[0];
    expect(session.caloriesBurned).toBe(210);
    expect(set?.distanceKm).toBeUndefined();
    // run types belong to runs only
    expect(session.exercises[0]?.runType).toBeUndefined();
  });
});

describe('cardio inside a strength workout', () => {
  const treadmill = exercise({
    exerciseName: 'ריצה על מסילה | Treadmill Run',
    sets: [cardioSet({ duration: 600, distanceKm: 1.6 })],
  });
  const bench = exercise({
    id: 'e2',
    exerciseName: 'לחיצת חזה | Bench Press',
    sets: [cardioSet({ id: 'b1', weight: 60, reps: 8 })],
  });

  it('stamps the cardio activity onto a saved built-in exercise', () => {
    expect(cardioSnapshot({ name: 'ריצה על מסילה | Treadmill Run' })).toEqual({
      trackingType: 'cardio',
      cardioActivity: 'treadmill',
    });
    expect(cardioSnapshot({ name: 'לחיצת חזה | Bench Press' })).toEqual({});
  });

  it('adds cardio calories and does not double-count the cardio minutes as lifting', () => {
    const strength = (volume: number, minutes: number) => Math.round(volume * 0.04 + minutes * 5);
    const mixed = workoutCalories({
      exercises: [treadmill, bench],
      durationSec: 3600,
      volumeKg: 480,
      weightKg: 70,
      strength,
    });
    // lifting: 50 min → 19 + 250 = 269; treadmill 1.6 km in 10 min (9.6 km/h) ≈ 119
    expect(mixed).toBeGreaterThan(269 + 100);
    expect(mixed).toBeLessThan(269 + 140);
  });

  it('is just the cardio for a cardio-only workout', () => {
    const only = workoutCalories({
      exercises: [treadmill],
      durationSec: 900,
      volumeKg: 0,
      weightKg: null,
      strength: () => 999,
    });
    expect(only).toBeNull();
  });
});
