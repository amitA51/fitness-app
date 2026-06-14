import { describe, expect, it } from 'vitest';
import type { ClientAnalytics } from '../../../../services/coach';
import type { BodyWeightEntry } from '../../../../types';
import { computeVerdict } from '../tabs/OverviewTab';

// ---- helpers ----------------------------------------------------------------

const analytics = (
  level: ClientAnalytics['level'],
  overrides: Partial<ClientAnalytics> = {}
): ClientAnalytics => ({
  lastActivity: null,
  daysSinceActivity: null,
  sessionsLast7: 0,
  sessionsPrev7: 0,
  volumeByWeek: [0, 0, 0, 0],
  level,
  ...overrides,
});

const weight = (date: string, w: number): BodyWeightEntry => ({
  id: `w-${date}`,
  date,
  weight: w,
  createdAt: `${date}T00:00:00.000Z`,
});

// ---- tests --------------------------------------------------------------------

describe('computeVerdict', () => {
  it('falls back to a neutral line when there are no analytics', () => {
    const v = computeVerdict(null, []);
    expect(v.action).toBe('none');
    expect(v.tone).toBe('var(--fs-muted)');
  });

  it('prompts an opening message for a brand-new client', () => {
    const v = computeVerdict(analytics('new'), []);
    expect(v.action).toBe('message');
    expect(v.sentence).toContain('עדיין לא נרשם אימון');
  });

  it('flags inactivity with the day count and a message action (warn tone)', () => {
    const v = computeVerdict(analytics('inactive', { daysSinceActivity: 9 }), []);
    expect(v.sentence).toContain('9');
    expect(v.action).toBe('message');
    expect(v.tone).toBe('var(--fs-warn)');
  });

  it('flags an at_risk client with a reminder action', () => {
    const v = computeVerdict(analytics('at_risk', { daysSinceActivity: 3 }), []);
    expect(v.action).toBe('message');
    expect(v.tone).toBe('var(--fs-warn)');
  });

  it('leads with weight momentum when an active client moved past the threshold', () => {
    // newest-first: current 68, oldest 71 → lost 3 kg
    const v = computeVerdict(analytics('active', { sessionsLast7: 4 }), [
      weight('2026-06-10', 68),
      weight('2026-06-01', 71),
    ]);
    expect(v.action).toBe('none');
    expect(v.tone).toBe('var(--fs-accent)');
    expect(v.sentence).toContain('ירד');
    expect(v.sentence).toContain('4 אימונים');
  });

  it('shows a steady affirmation for an active client with a sub-threshold weight move', () => {
    const v = computeVerdict(analytics('active', { sessionsLast7: 3 }), [
      weight('2026-06-10', 70),
      weight('2026-06-01', 70.3),
    ]);
    expect(v.action).toBe('none');
    expect(v.sentence).toContain('על המסלול');
  });

  it('agrees the noun for a single session (אימון אחד, not 1 אימונים)', () => {
    // sessionsLast7 === 1 is reachable (active = the else of at_risk's ===0).
    const v = computeVerdict(analytics('active', { sessionsLast7: 1 }), []);
    expect(v.sentence).toContain('אימון אחד');
    expect(v.sentence).not.toContain('1 אימונים');
  });
});
