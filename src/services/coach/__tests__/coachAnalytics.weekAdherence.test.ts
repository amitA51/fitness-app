import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Reader mocks — getClientWeekAdherence composes these four sources ────────
const mockGetClientSessions = vi.fn();
const mockGetClientNutrition = vi.fn();
const mockListCoachAssignments = vi.fn();
const mockGetClientSchedule = vi.fn();

vi.mock('../coachApi', () => ({
  getClientSessions: (...args: unknown[]) => mockGetClientSessions(...args),
  getClientNutrition: (...args: unknown[]) => mockGetClientNutrition(...args),
  getClientsActivity: vi.fn(),
}));
vi.mock('../assignmentService', () => ({
  listCoachAssignments: (...args: unknown[]) => mockListCoachAssignments(...args),
}));
vi.mock('../scheduleService', () => ({
  getClientSchedule: (...args: unknown[]) => mockGetClientSchedule(...args),
}));

import { getClientWeekAdherence } from '../coachAnalytics';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClientSessions.mockResolvedValue([]);
  mockGetClientNutrition.mockResolvedValue([]);
  mockListCoachAssignments.mockResolvedValue([]);
  mockGetClientSchedule.mockResolvedValue([]);
});

describe('getClientWeekAdherence — failure is NOT an empty week', () => {
  it('requests all four sources in strict (throwOnError) mode', async () => {
    await getClientWeekAdherence('c-1');

    expect(mockGetClientSessions).toHaveBeenCalledWith('c-1', 30, { throwOnError: true });
    expect(mockGetClientNutrition).toHaveBeenCalledWith('c-1', 10, { throwOnError: true });
    expect(mockListCoachAssignments).toHaveBeenCalledWith('c-1', { throwOnError: true });
    expect(mockGetClientSchedule).toHaveBeenCalledWith(
      'c-1',
      expect.any(String),
      expect.any(String),
      { throwOnError: true }
    );
  });

  it('returns 7 days when all sources resolve (genuinely empty week)', async () => {
    const days = await getClientWeekAdherence('c-1');

    expect(days).toHaveLength(7);
    expect(days.every((d) => d.sessions === 0)).toBe(true);
  });

  it('THROWS when a source fails, instead of returning a fake all-zero week', async () => {
    mockGetClientSessions.mockRejectedValueOnce(new Error('network down'));

    await expect(getClientWeekAdherence('c-1')).rejects.toThrow('network down');
  });

  it('wraps non-Error rejections so callers always get an Error', async () => {
    mockGetClientSchedule.mockRejectedValueOnce('weird string failure');

    await expect(getClientWeekAdherence('c-1')).rejects.toThrow('week_adherence_failed');
  });
});
