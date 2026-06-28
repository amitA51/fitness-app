import { describe, expect, it } from 'vitest';
import { addBreadcrumb, captureException, isSentryLoaded } from '../sentryLazy';

// These guard the privacy + safety contract of the lazy Sentry facade:
// before loadSentry() runs (i.e. before analytics consent), the SDK is never
// downloaded and every reporting call must be a silent no-op — exactly matching
// the old "captureException on an un-initialised client" behaviour. This test
// deliberately never calls loadSentry(), so the real SDK is never imported.
describe('sentryLazy facade — no-op until loaded', () => {
  it('reports the SDK as not loaded before loadSentry() is called', () => {
    expect(isSentryLoaded()).toBe(false);
  });

  it('captureException is a safe no-op (never throws) before the SDK loads', () => {
    expect(() => captureException(new Error('boom'), { level: 'error' })).not.toThrow();
    expect(() => captureException('a non-error value')).not.toThrow();
  });

  it('addBreadcrumb is a safe no-op (never throws) before the SDK loads', () => {
    expect(() => addBreadcrumb({ category: 'test', message: 'hello' })).not.toThrow();
  });
});
