import { describe, expect, it, vi } from 'vitest';

const mockOnCLS = vi.fn();
const mockOnLCP = vi.fn();
const mockOnFCP = vi.fn();
const mockOnTTFB = vi.fn();
const mockOnINP = vi.fn();

vi.mock('web-vitals', () => ({
  onCLS: (cb: unknown) => mockOnCLS(cb),
  onLCP: (cb: unknown) => mockOnLCP(cb),
  onFCP: (cb: unknown) => mockOnFCP(cb),
  onTTFB: (cb: unknown) => mockOnTTFB(cb),
  onINP: (cb: unknown) => mockOnINP(cb),
}));

describe('webVitals', () => {
  it('initializes all web vitals metrics', async () => {
    const { initWebVitals } = await import('../services/webVitals');

    initWebVitals();

    expect(mockOnCLS).toHaveBeenCalled();
    expect(mockOnLCP).toHaveBeenCalled();
    expect(mockOnFCP).toHaveBeenCalled();
    expect(mockOnTTFB).toHaveBeenCalled();
    expect(mockOnINP).toHaveBeenCalled();
  });

  it('accepts custom metric handler', async () => {
    const customHandler = vi.fn();
    const { initWebVitals } = await import('../services/webVitals');

    initWebVitals(customHandler);

    expect(mockOnCLS).toHaveBeenCalledWith(customHandler);
    expect(mockOnLCP).toHaveBeenCalledWith(customHandler);
    expect(mockOnFCP).toHaveBeenCalledWith(customHandler);
    expect(mockOnTTFB).toHaveBeenCalledWith(customHandler);
    expect(mockOnINP).toHaveBeenCalledWith(customHandler);
  });
});
