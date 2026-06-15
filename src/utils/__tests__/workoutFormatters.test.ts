import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDuration, formatVolume } from '../workoutFormatters';

// Manual-run target for the test-coverage loop (see plans/loop-state/test-coverage.md).
// workoutFormatters had no direct test file; formatDate carries the only real logic
// in the module (relative he-IL labels), so "now" is pinned with fake timers to keep
// the היום/אתמול branches deterministic.
describe('workoutFormatters', () => {
  describe('formatDate', () => {
    beforeEach(() => {
      // Tue 12 May 2026, 10:00 local — fixed so relative labels never depend on the
      // wall clock the suite happens to run at.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 12, 10, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('labels the current calendar day as "היום"', () => {
      // Arrange / Act
      const label = formatDate(new Date(2026, 4, 12, 8, 0, 0));
      // Assert
      expect(label).toBe('היום');
    });

    it('labels the previous calendar day as "אתמול" even late at night', () => {
      const label = formatDate(new Date(2026, 4, 11, 23, 30, 0));
      expect(label).toBe('אתמול');
    });

    it('formats older dates as a short he-IL day/month label', () => {
      const label = formatDate(new Date(2026, 0, 15)); // 15 Jan 2026
      expect(label).not.toBe('');
      expect(label).toContain('15');
    });

    it('returns an empty string for unparseable input instead of "Invalid Date"', () => {
      expect(formatDate('not-a-real-date')).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('renders sub-hour durations in whole minutes', () => {
      expect(formatDuration(1500)).toBe('25 דקות');
    });

    it('renders hour-plus durations with hours and minutes', () => {
      expect(formatDuration(5400)).toBe('1 שעה ו-30 דקות');
    });
  });

  describe('formatVolume', () => {
    it('compacts thousands to one decimal with a "k" suffix', () => {
      expect(formatVolume(12500)).toBe('12.5k');
    });

    it('renders sub-thousand volumes as a plain localized number', () => {
      expect(formatVolume(800)).toBe('800');
    });
  });
});
