import { describe, expect, it } from 'vitest';
import type { CoachClient } from '../../../types/coach';
import { type ClientOverviewRow, computeClientAnalytics, summarizeRoster } from '../coachAnalytics';

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
