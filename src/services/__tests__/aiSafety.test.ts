import { describe, expect, it } from 'vitest';
import { sanitizeForPrompt } from '../ai';

describe('sanitizeForPrompt', () => {
  it('truncates input exceeding maxLength', () => {
    const long = 'a'.repeat(5000);
    const result = sanitizeForPrompt(long, 500);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it('strips control characters', () => {
    const input = 'hello\x00\x01\x02\x03world';
    const result = sanitizeForPrompt(input, 500);
    const hasControlChar = result.split('').some((ch) => ch.charCodeAt(0) <= 0x1f);
    expect(hasControlChar).toBe(false);
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('replaces newlines and tabs with spaces', () => {
    const input = 'line1\nline2\ttab\rreturn';
    const result = sanitizeForPrompt(input, 500);
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\t');
    expect(result).not.toContain('\r');
  });

  it('preserves normal Hebrew and Latin text', () => {
    const input = 'איך לעשות סקווט נכון';
    const result = sanitizeForPrompt(input, 500);
    expect(result).toBe(input);
  });

  it('uses default maxLength of 100 when not specified', () => {
    const long = 'x'.repeat(200);
    const result = sanitizeForPrompt(long);
    expect(result.length).toBeLessThanOrEqual(100);
  });
});
