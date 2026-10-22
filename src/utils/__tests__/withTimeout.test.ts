import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, isTimeoutError, withTimeout } from '../withTimeout';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('settles with the value when the promise answers in time', async () => {
    const result = withTimeout(Promise.resolve(7), 1_000);
    await expect(result).resolves.toBe(7);
  });

  it('passes a rejection through unchanged', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(Promise.reject(boom), 1_000)).rejects.toBe(boom);
  });

  it('rejects with a TimeoutError once the cap passes', async () => {
    const result = withTimeout(new Promise(() => {}), 1_000, 'slowRead');
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
    await result.catch((err) => expect(isTimeoutError(err)).toBe(true));
  });

  it('accepts a thenable (a Supabase query builder is one)', async () => {
    const thenable: PromiseLike<string> = {
      // biome-ignore lint/suspicious/noThenProperty: the point is a non-Promise thenable
      then: (resolve, reject) => Promise.resolve('row').then(resolve, reject),
    };
    await expect(withTimeout(thenable, 1_000)).resolves.toBe('row');
  });

  it('leaves no timer behind after settling', async () => {
    await withTimeout(Promise.resolve(1), 1_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
