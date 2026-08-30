import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration, formatVolume } from '../workoutFormatters';

describe('workoutFormatters.formatDate', () => {
  it('labels today as היום', () => {
    expect(formatDate(new Date())).toBe('היום');
  });

  it('labels yesterday as אתמול', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDate(yesterday)).toBe('אתמול');
  });

  it('returns an empty string for unparseable input (never "Invalid Date")', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('renders an older date as a localized label', () => {
    const label = formatDate('2020-05-12');
    expect(label).not.toBe('');
    expect(label).not.toBe('היום');
    expect(label).not.toBe('אתמול');
  });
});

describe('workoutFormatters duration/volume (seconds-based contract)', () => {
  it('formats a SECONDS duration into a non-empty label', () => {
    // 1500s = 25 min — the contract is seconds in, not milliseconds.
    expect(formatDuration(1500)).toMatch(/\d/);
  });

  // The re-export must carry the canonical Hebrew agreement through unchanged —
  // WorkoutHistory reads its duration label from here, so a regression in the
  // delegation would ship "1 דקות" to the history list.
  it('carries the singular minute through the delegation, never "1 דקות"', () => {
    expect(formatDuration(69)).toBe('דקה אחת');
  });

  it('carries the bare singular hour and the dual through the delegation', () => {
    expect(formatDuration(3600)).toBe('שעה');
    expect(formatDuration(7200)).toBe('שעתיים');
  });

  it('carries both vav conjunction forms through the delegation', () => {
    expect(formatDuration(3660)).toBe('שעה ודקה');
    expect(formatDuration(5400)).toBe('שעה ו-30 דקות');
  });

  it('formats a volume into a non-empty label', () => {
    expect(formatVolume(12500)).toMatch(/\d/);
  });
});
