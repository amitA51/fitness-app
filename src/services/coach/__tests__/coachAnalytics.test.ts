import { describe, expect, it } from 'vitest';
import type { CoachClient } from '../../../types/coach';
import {
  type ClientOverviewRow,
  computeClientAnalytics,
  computeWeekAdherence,
  summarizeRoster,
} from '../coachAnalytics';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 15);

function sessionAt(daysAgo: number, volume = 100) {
  return { startTime: new Date(NOW - daysAgo * DAY).toISOString(), totalVolume: volume };
}

describe('computeClientAnalytics', () => {
  it('marks a client with no sessions as new', () => {
    // Arrange
    const sessions: { startTime: string; totalVolume: number }[] = [];

    // Act
    const result = computeClientAnalytics(sessions, 7, NOW);

    // Assert
    expect(result.level).toBe('new');
    expect(result.lastActivity).toBeNull();
    expect(result.daysSinceActivity).toBeNull();
  });

  it('marks a client active when they trained within the last 7 days', () => {
    // Arrange
    const sessions = [sessionAt(1), sessionAt(3)];

    // Act
    const result = computeClientAnalytics(sessions, 7, NOW);

    // Assert
    expect(result.level).toBe('active');
    expect(result.sessionsLast7).toBe(2);
    expect(result.daysSinceActivity).toBe(1);
  });

  it('marks a client inactive once past the inactivity threshold', () => {
    // Arrange
    const sessions = [sessionAt(10)];

    // Act
    const result = computeClientAnalytics(sessions, 7, NOW);

    // Assert
    expect(result.level).toBe('inactive');
    expect(result.sessionsLast7).toBe(0);
  });

  it('marks a client at_risk when last activity is recent but none in last 7 days', () => {
    // Arrange: trained 8 days ago with a 5-day inactivity threshold
    const sessions = [sessionAt(8)];

    // Act
    const result = computeClientAnalytics(sessions, 14, NOW);

    // Assert
    expect(result.level).toBe('at_risk');
  });

  it('buckets volume into the correct trailing week', () => {
    // Arrange
    const sessions = [sessionAt(0, 50), sessionAt(8, 80)];

    // Act
    const result = computeClientAnalytics(sessions, 7, NOW);

    // Assert: index 3 = this week, index 2 = last week
    expect(result.volumeByWeek[3]).toBe(50);
    expect(result.volumeByWeek[2]).toBe(80);
  });
});

describe('computeWeekAdherence', () => {
  // Fixed "now" = 2026-01-15 (Thursday) in local time, constructed to avoid
  // any UTC/local ambiguity in the test itself.
  const NOW_DATE = new Date(2026, 0, 15); // Jan 15 2026 00:00:00 local

  it('returns exactly 7 entries ending today', () => {
    // Arrange / Act
    const result = computeWeekAdherence([], [], null, [], NOW_DATE);

    // Assert
    expect(result).toHaveLength(7);
    expect(result[6]!.date).toBe('2026-01-15');
    expect(result[0]!.date).toBe('2026-01-09');
  });

  it('counts a session at 23:30 local on the correct local date', () => {
    // Arrange — session at 23:30 local on Jan 13 (would be Jan 14 UTC+some zones)
    const localDt = new Date(2026, 0, 13, 23, 30, 0); // Jan 13 23:30 local
    const sessions = [{ startTime: localDt.toISOString() }];

    // Act
    const result = computeWeekAdherence(sessions, [], null, [], NOW_DATE);

    // Assert — Jan 13 is index 4 (Jan 9=0, 10=1, 11=2, 12=3, 13=4, 14=5, 15=6)
    const jan13 = result.find((d) => d.date === '2026-01-13');
    expect(jan13).toBeDefined();
    expect(jan13?.sessions).toBe(1);
    // Adjacent day must NOT be incremented
    const jan14 = result.find((d) => d.date === '2026-01-14');
    expect(jan14?.sessions).toBe(0);
  });

  it('maps calories from matching nutrition row; null when no row for that date', () => {
    // Arrange
    const nutrition = [
      { date: '2026-01-15', calories: 2000 },
      { date: '2026-01-12', calories: 1800 },
    ];

    // Act
    const result = computeWeekAdherence([], nutrition, 2200, [], NOW_DATE);

    // Assert
    const jan15 = result.find((d) => d.date === '2026-01-15');
    expect(jan15?.calories).toBe(2000);
    expect(jan15?.targetCalories).toBe(2200);

    const jan12 = result.find((d) => d.date === '2026-01-12');
    expect(jan12?.calories).toBe(1800);

    // Date without a nutrition row
    const jan11 = result.find((d) => d.date === '2026-01-11');
    expect(jan11?.calories).toBeNull();
  });

  it('returns 7 days with zero sessions and null calories when inputs are empty', () => {
    // Arrange / Act
    const result = computeWeekAdherence([], [], null, [], NOW_DATE);

    // Assert
    expect(result).toHaveLength(7);
    for (const day of result) {
      expect(day.sessions).toBe(0);
      expect(day.calories).toBeNull();
      expect(day.targetCalories).toBeNull();
      expect(day.scheduled).toBe(0);
      expect(day.completedScheduled).toBe(0);
    }
  });
});

describe('computeWeekAdherence — schedule counts', () => {
  const NOW_DATE = new Date(2026, 0, 15); // Jan 15 2026 00:00:00 local

  it('counts a planned-only scheduled workout as scheduled but not completed', () => {
    // Arrange
    const schedule = [{ scheduledDate: '2026-01-13', status: 'planned' }];

    // Act
    const result = computeWeekAdherence([], [], null, schedule, NOW_DATE);

    // Assert
    const jan13 = result.find((d) => d.date === '2026-01-13');
    expect(jan13?.scheduled).toBe(1);
    expect(jan13?.completedScheduled).toBe(0);
  });

  it('counts a done scheduled workout toward completedScheduled', () => {
    // Arrange
    const schedule = [
      { scheduledDate: '2026-01-14', status: 'done' },
      { scheduledDate: '2026-01-14', status: 'planned' },
    ];

    // Act
    const result = computeWeekAdherence([], [], null, schedule, NOW_DATE);

    // Assert — two scheduled, one completed on the same day.
    const jan14 = result.find((d) => d.date === '2026-01-14');
    expect(jan14?.scheduled).toBe(2);
    expect(jan14?.completedScheduled).toBe(1);
  });

  it('treats a skipped scheduled workout as scheduled but not completed', () => {
    // Arrange
    const schedule = [{ scheduledDate: '2026-01-12', status: 'skipped' }];

    // Act
    const result = computeWeekAdherence([], [], null, schedule, NOW_DATE);

    // Assert
    const jan12 = result.find((d) => d.date === '2026-01-12');
    expect(jan12?.scheduled).toBe(1);
    expect(jan12?.completedScheduled).toBe(0);
  });

  it('ignores scheduled rows that fall outside the 7-day window', () => {
    // Arrange — a date before the window start (Jan 09).
    const schedule = [{ scheduledDate: '2026-01-01', status: 'done' }];

    // Act
    const result = computeWeekAdherence([], [], null, schedule, NOW_DATE);

    // Assert — no day picked it up.
    const totalScheduled = result.reduce((sum, d) => sum + d.scheduled, 0);
    expect(totalScheduled).toBe(0);
  });

  it('attributes a scheduled workout to the correct local date at the window boundary', () => {
    // Arrange — the last day of the window (today, Jan 15).
    const schedule = [{ scheduledDate: '2026-01-15', status: 'done' }];

    // Act
    const result = computeWeekAdherence([], [], null, schedule, NOW_DATE);

    // Assert — index 6 is today; it carries the scheduled+completed count.
    expect(result[6]!.date).toBe('2026-01-15');
    expect(result[6]!.scheduled).toBe(1);
    expect(result[6]!.completedScheduled).toBe(1);
  });
});

describe('summarizeRoster', () => {
  const makeRow = (level: ClientOverviewRow['analytics']['level']): ClientOverviewRow => ({
    client: { id: 'l', clientId: 'c', coachId: 'x', status: 'active' } as CoachClient,
    analytics: {
      lastActivity: null,
      daysSinceActivity: null,
      sessionsLast7: 0,
      sessionsPrev7: 0,
      volumeByWeek: [0, 0, 0, 0],
      level,
    },
  });

  it('counts inactive and at_risk clients as needing attention', () => {
    // Arrange
    const rows = [makeRow('active'), makeRow('at_risk'), makeRow('inactive'), makeRow('new')];

    // Act
    const summary = summarizeRoster(rows);

    // Assert
    expect(summary.total).toBe(4);
    expect(summary.active).toBe(1);
    expect(summary.atRisk).toBe(1);
    expect(summary.inactive).toBe(1);
    expect(summary.awaitingFirst).toBe(1);
    expect(summary.needsAttention).toBe(2);
  });

  it('returns zeroed counts for an empty roster', () => {
    // Arrange / Act
    const summary = summarizeRoster([]);

    // Assert
    expect(summary).toEqual({
      total: 0,
      active: 0,
      atRisk: 0,
      inactive: 0,
      needsAttention: 0,
      awaitingFirst: 0,
    });
  });
});
