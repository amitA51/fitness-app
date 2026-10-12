import { describe, expect, it } from 'vitest';
import type { CardioActivity, WorkoutSession } from '../../../../types';
import { buildCardioSession } from '../../../../utils/cardio';
import {
  buildShareSummary,
  cardioTotalParts,
  cardioTotalText,
  computeCardioSummary,
  computeTrainingSummary,
} from '../reportMetrics';

const RANGE = { from: '2026-09-12', to: '2026-10-11' };

const cardio = (
  activity: CardioActivity,
  day: number,
  durationSec: number,
  distanceKm?: number
): WorkoutSession =>
  buildCardioSession({
    activity,
    startTime: new Date(2026, 9, day, 7).toISOString(),
    durationSec,
    distanceKm,
  });

describe('computeCardioSummary', () => {
  it('sums only the efforts dated inside the window', () => {
    const sessions = [
      cardio('run', 1, 1720, 5.2),
      cardio('run', 5, 2100, 6),
      cardio('run', 9, 2700, 7.2),
      buildCardioSession({
        activity: 'run',
        startTime: new Date(2026, 8, 1, 7).toISOString(),
        durationSec: 1800,
        distanceKm: 5,
      }),
    ];
    const totals = computeCardioSummary(sessions, RANGE);
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ discipline: 'running', count: 3, durationSec: 6520 });
    expect(totals[0]?.distanceKm).toBeCloseTo(18.4, 6);
  });

  it('leaves the lifting summary untouched — a run adds a session and no volume', () => {
    const run = cardio('run', 3, 1800, 5);
    expect(computeTrainingSummary([run], RANGE)).toEqual({ sessionCount: 1, totalVolume: 0 });
  });
});

describe('cardioTotalText', () => {
  it('reads "ריצה: 18.4 ק״מ ב־3 ריצות · 1:48:40"', () => {
    expect(
      cardioTotalText({ discipline: 'running', count: 3, distanceKm: 18.4, durationSec: 6520 })
    ).toBe('ריצה: 18.4 ק״מ ב־3 ריצות · 1:48:40');
  });

  it('agrees in the singular (feminine "אחת", prefix joined to the word)', () => {
    expect(
      cardioTotalText({ discipline: 'walking', count: 1, distanceKm: 3, durationSec: 2400 })
    ).toBe('הליכה: 3 ק״מ בהליכה אחת · 40:00');
  });

  it('writes pool distance in metres and counts swims as workouts', () => {
    expect(
      cardioTotalText({ discipline: 'swimming', count: 2, distanceKm: 1.5, durationSec: 2700 })
    ).toBe('שחייה: 1,500 מ׳ ב־2 אימונים · 45:00');
  });

  it('falls back to time first when no distance was logged', () => {
    expect(
      cardioTotalText({ discipline: 'other', count: 1, distanceKm: 0, durationSec: 1200 })
    ).toBe('אירובי אחר: 20:00 באימון אחד');
  });

  it('drops the clock when only a distance was logged', () => {
    const parts = cardioTotalParts({
      discipline: 'cycling',
      count: 2,
      distanceKm: 40,
      durationSec: 0,
    });
    expect(parts.clock).toBeNull();
    expect(
      cardioTotalText({ discipline: 'cycling', count: 2, distanceKm: 40, durationSec: 0 })
    ).toBe('רכיבה: 40 ק״מ ב־2 רכיבות');
  });
});

describe('buildShareSummary with cardio', () => {
  const base = {
    clientName: 'דנה',
    days: 30,
    weightTrend: null,
    prCount: 0,
    nutrition: { daysLogged: 0, avgCalories: null, targetCalories: null },
  };

  it('adds one line per discipline and no zero-volume line for a runner', () => {
    const text = buildShareSummary({
      ...base,
      training: { sessionCount: 3, totalVolume: 0 },
      cardio: [{ discipline: 'running', count: 3, distanceKm: 18.4, durationSec: 6520 }],
    });
    expect(text.split('\n')).toEqual([
      'סיכום 30 ימים — דנה',
      'אימונים: 3',
      'ריצה: 18.4 ק״מ ב־3 ריצות · 1:48:40',
    ]);
  });

  it('is unchanged when there is no cardio', () => {
    const withEmpty = buildShareSummary({
      ...base,
      training: { sessionCount: 2, totalVolume: 1000 },
      cardio: [],
    });
    const without = buildShareSummary({
      ...base,
      training: { sessionCount: 2, totalVolume: 1000 },
    });
    expect(withEmpty).toBe(without);
  });
});
