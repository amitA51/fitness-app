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

  it('formats a volume into a non-empty label', () => {
    expect(formatVolume(12500)).toMatch(/\d/);
  });
});
