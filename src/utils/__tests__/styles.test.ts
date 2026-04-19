import { describe, expect, it } from 'vitest';
import { cn } from '../styles';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values (false, null, undefined)', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('filters out empty strings', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('solo')).toBe('solo');
  });
});
