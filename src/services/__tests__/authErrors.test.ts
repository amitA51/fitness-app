import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  classifyAuthError,
  isUnreachableAuthError,
  settlesWithin,
} from '../authErrors';

// The login screens used to match English substrings of error.message and turn
// everything else — a timeout, a 429, an overloaded database — into "unexpected
// error". These pin the mapping the screens now rely on, using the shapes
// auth-js actually produces (lib/fetch.js, lib/errors.js).

const apiError = (status: number, code?: string, message = 'x') => ({
  name: 'AuthApiError',
  status,
  code,
  message,
});

const setOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('classifyAuthError', () => {
  it('maps the server error codes', () => {
    expect(classifyAuthError(apiError(400, 'invalid_credentials'))).toBe('invalid_credentials');
    expect(classifyAuthError(apiError(400, 'email_not_confirmed'))).toBe('email_not_confirmed');
    expect(classifyAuthError(apiError(422, 'user_already_exists'))).toBe('already_registered');
    expect(classifyAuthError(apiError(422, 'email_exists'))).toBe('already_registered');
    expect(classifyAuthError(apiError(422, 'weak_password'))).toBe('weak_password');
    expect(classifyAuthError(apiError(422, 'same_password'))).toBe('same_password');
  });

  it('tells an email-sending limit from a request limit', () => {
    expect(classifyAuthError(apiError(429, 'over_email_send_rate_limit'))).toBe(
      'email_rate_limited'
    );
    expect(classifyAuthError(apiError(429, 'over_request_rate_limit'))).toBe('rate_limited');
    // A 429 with no code at all is still a rate limit, not "the server is down".
    expect(classifyAuthError(apiError(429))).toBe('rate_limited');
  });

  it('calls every no-answer shape "unreachable"', () => {
    // fetch threw (network down, CORS, our own timeout) → auth-js status 0
    expect(
      classifyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })
    ).toBe('unreachable');
    // gateway errors auth-js already treats as retryable
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 503 })).toBe('unreachable');
    // a plain 500 / 504 from an overloaded database
    expect(classifyAuthError(apiError(500, 'unexpected_failure'))).toBe('unreachable');
    expect(classifyAuthError(apiError(504))).toBe('unreachable');
    expect(classifyAuthError(apiError(504, 'request_timeout'))).toBe('unreachable');
    // our timedFetch abort and a bare browser network error
    expect(classifyAuthError(new DOMException('slow', 'TimeoutError'))).toBe('unreachable');
    expect(classifyAuthError(new TypeError('Failed to fetch'))).toBe('unreachable');
    expect(classifyAuthError(new TypeError('Load failed'))).toBe('unreachable');
  });

  it('treats any failure while the device is offline as unreachable', () => {
    setOnline(false);
    expect(classifyAuthError(new Error('something odd'))).toBe('unreachable');
  });

  it('does not mistake a client-side redirect error for a server outage', () => {
    // auth-js gives these a 500 although the server was never asked.
    expect(
      isUnreachableAuthError({ name: 'AuthPKCEGrantCodeExchangeError', status: 500, message: 'x' })
    ).toBe(false);
  });

  it('falls back to the stable English messages of servers without codes', () => {
    expect(classifyAuthError({ status: 400, message: 'Invalid login credentials' })).toBe(
      'invalid_credentials'
    );
    expect(classifyAuthError({ status: 400, message: 'Email not confirmed' })).toBe(
      'email_not_confirmed'
    );
    expect(classifyAuthError({ status: 400, message: 'User already registered' })).toBe(
      'already_registered'
    );
    expect(classifyAuthError({ status: 400, message: 'Email rate limit exceeded' })).toBe(
      'email_rate_limited'
    );
    // A bare string, as older call sites passed around.
    expect(classifyAuthError('Invalid login credentials')).toBe('invalid_credentials');
  });

  it('returns "unknown" for nothing recognisable', () => {
    expect(classifyAuthError(apiError(400, 'validation_failed', 'bad input'))).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
  });
});

describe('authErrorMessage', () => {
  it('has Hebrew text for every kind and falls back to "unknown"', () => {
    for (const text of Object.values(AUTH_ERROR_MESSAGES)) {
      expect(text).toMatch(/[֐-׿]/);
    }
    expect(authErrorMessage(null)).toBe(AUTH_ERROR_MESSAGES.unknown);
    expect(authErrorMessage('unreachable')).toBe(
      'השרת לא עונה כרגע. בדקו את החיבור לאינטרנט ונסו שוב בעוד דקה.'
    );
  });
});

describe('settlesWithin', () => {
  it('reports a task that settles in time, even by rejecting', async () => {
    await expect(settlesWithin(Promise.resolve(1), 1000)).resolves.toBe(true);
    await expect(settlesWithin(Promise.reject(new Error('no')), 1000)).resolves.toBe(true);
  });

  it('stops waiting on a task that hangs', async () => {
    vi.useFakeTimers();
    const outcome = settlesWithin(new Promise(() => {}), 4000);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(outcome).resolves.toBe(false);
  });
});
