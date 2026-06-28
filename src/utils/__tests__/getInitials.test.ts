import { describe, expect, it } from 'vitest';
import { getInitials } from '../getInitials';

describe('getInitials', () => {
  it('takes the first letter of up to two Hebrew words', () => {
    expect(getInitials('דני כהן')).toBe('דכ');
  });

  it('uppercases Latin initials', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
  });

  it('collapses surrounding and inner whitespace', () => {
    expect(getInitials('  Ada   Lovelace ')).toBe('AL');
  });

  it('returns a single initial for a one-word name', () => {
    expect(getInitials('madonna')).toBe('M');
  });

  it('uses only the first two words when more are present', () => {
    expect(getInitials('a b c')).toBe('AB');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});
