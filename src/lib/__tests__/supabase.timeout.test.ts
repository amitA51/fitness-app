import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The guarded bug: fetch has no timeout, so when the database was overloaded a
 * login or sync request hung for minutes and the button spun forever. Requests
 * to auth, the REST API and edge functions now fail once the server has not
 * started answering within a bounded wait.
 */
const BASE = 'https://fake-project-ref.supabase.co';

const loadModule = async () => {
  vi.resetModules();
  vi.doMock('../../utils/logger', () => ({ logger: { sync: { warn: vi.fn() } } }));
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
  return import('../supabase');
};

/** A fetch that never answers until its signal aborts. */
const hangingFetch = vi.fn(
  (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })
);

describe('requestTimeoutFor', () => {
  it('caps auth, REST and functions, and leaves storage uncapped', async () => {
    const { requestTimeoutFor, REQUEST_TIMEOUT_MS } = await loadModule();
    expect(requestTimeoutFor(`${BASE}/auth/v1/token?grant_type=password`)).toBe(
      REQUEST_TIMEOUT_MS.auth
    );
    expect(requestTimeoutFor(`${BASE}/rest/v1/workout_sessions`)).toBe(REQUEST_TIMEOUT_MS.rest);
    expect(requestTimeoutFor(`${BASE}/rest/v1/workout_sessions`, 'post')).toBe(
      REQUEST_TIMEOUT_MS.restWrite
    );
    expect(requestTimeoutFor(`${BASE}/functions/v1/ai-chat`)).toBe(REQUEST_TIMEOUT_MS.functions);
    expect(requestTimeoutFor(`${BASE}/storage/v1/object/avatars/a.jpg`)).toBeNull();
  });
});

describe('timedFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingFetch);
    hangingFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fails a login that gets no answer instead of waiting forever', async () => {
    const { timedFetch, REQUEST_TIMEOUT_MS } = await loadModule();
    const pending = timedFetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST' });
    const outcome = pending.catch((err: unknown) => err);

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS.auth - 1);
    expect(hangingFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const err = (await outcome) as DOMException;
    expect(err.name).toBe('TimeoutError');
  });

  it('returns the answer when the server responds in time', async () => {
    const { timedFetch } = await loadModule();
    const ok = new Response('{}', { status: 200 });
    const timersBefore = vi.getTimerCount();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ok)
    );
    await expect(timedFetch(`${BASE}/rest/v1/profiles`)).resolves.toBe(ok);
    // No timer left behind to abort a body that is still streaming.
    expect(vi.getTimerCount()).toBe(timersBefore);
  });

  it("still honours the caller's own abort", async () => {
    const { timedFetch } = await loadModule();
    const stop = new AbortController();
    const outcome = timedFetch(`${BASE}/functions/v1/ai-chat`, { signal: stop.signal }).catch(
      (err: unknown) => err
    );
    stop.abort(new DOMException('stopped', 'AbortError'));
    const err = (await outcome) as DOMException;
    expect(err.name).toBe('AbortError');
  });

  it('passes storage uploads straight through, with no cap', async () => {
    const { timedFetch } = await loadModule();
    const init = { method: 'PUT' };
    const timersBefore = vi.getTimerCount();
    void timedFetch(`${BASE}/storage/v1/object/photos/p.jpg`, init);
    expect(hangingFetch).toHaveBeenCalledWith(`${BASE}/storage/v1/object/photos/p.jpg`, init);
    expect(vi.getTimerCount()).toBe(timersBefore);
  });
});

// ── The session-keeping part of the client's fetch ───────────────────────────
// auth-js signs the user out when the token refresh answers 500 or 429 — it
// only treats a thrown fetch and 502/503/504/52x as "network". On an overloaded
// day that logged out people whose refresh token was perfectly valid.

const REFRESH_URL = `${BASE}/auth/v1/token?grant_type=refresh_token`;

/** Load the module as a configured client, so the stored-session helpers are live. */
const loadConfigured = async () => {
  vi.stubEnv('VITE_SUPABASE_URL', BASE);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'header.payload.signature');
  vi.resetModules();
  vi.doMock('../../utils/logger', () => ({ logger: { sync: { warn: vi.fn() } } }));
  const createClient = vi.fn(() => ({}));
  vi.doMock('@supabase/supabase-js', () => ({ createClient }));
  const mod = await import('../supabase');
  return { mod, createClient };
};

/** The auth server answers in JSON, a real rejection included. */
const answering = (status: number, headers: Record<string, string> = {}) =>
  vi.fn(
    async () =>
      new Response('{}', { status, headers: { 'content-type': 'application/json', ...headers } })
  );

describe('supabaseFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([500, 429, 503, 408])(
    'turns a %i on the token refresh into a thrown, retryable error',
    async (status) => {
      const { supabaseFetch } = await loadModule();
      vi.stubGlobal('fetch', answering(status));
      await expect(supabaseFetch(REFRESH_URL, { method: 'POST' })).rejects.toBeInstanceOf(
        TypeError
      );
    }
  );

  it('treats a page from something in front of the server as a server failure too', async () => {
    const { supabaseFetch } = await loadModule();
    // A firewall challenge or proxy page: not the auth server's verdict on the token.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>blocked</html>', {
            status: 403,
            headers: { 'content-type': 'text/html' },
          })
      )
    );
    await expect(supabaseFetch(REFRESH_URL, { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
  });

  it('backs off after a failure instead of letting auth-js hammer the server', async () => {
    const { supabaseFetch } = await loadModule();
    const fetchSpy = answering(503, { 'retry-after': '30' });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(supabaseFetch(REFRESH_URL, { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
    // The retry inside the window fails here, without a request.
    await expect(supabaseFetch(REFRESH_URL, { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Other requests are not held back.
    await supabaseFetch(`${BASE}/rest/v1/profiles`);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('lets a real rejection of the refresh token through, so sign-out still happens', async () => {
    const { supabaseFetch } = await loadModule();
    vi.stubGlobal('fetch', answering(400));
    const response = await supabaseFetch(REFRESH_URL, { method: 'POST' });
    expect(response.status).toBe(400);
  });

  it('leaves every other request alone — a failed login is still the login screen’s to show', async () => {
    const { supabaseFetch } = await loadModule();
    vi.stubGlobal('fetch', answering(500));
    const login = await supabaseFetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
    });
    expect(login.status).toBe(500);
    const rest = await supabaseFetch(`${BASE}/rest/v1/workout_sessions`);
    expect(rest.status).toBe(500);
  });
});

// supabase-js falls back to the anon key when a refresh failed but the session
// is still stored; the consent RPC and the age table then answered as "nobody"
// and walled a verified user off. Such a call must fail like a network error.
describe('no guest calls while a session is stored', () => {
  const ANON = 'header.payload.signature';
  const KEY = 'sb-fake-project-ref-auth-token';
  const stored = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'user-1' } };

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('refuses a database or function call sent with the anon key', async () => {
    const { mod } = await loadConfigured();
    localStorage.setItem(KEY, JSON.stringify(stored));
    const fetchSpy = answering(200);
    vi.stubGlobal('fetch', fetchSpy);

    for (const path of ['/rest/v1/rpc/current_legal_versions', '/functions/v1/strava']) {
      await expect(
        mod.supabaseFetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${ANON}` } })
      ).rejects.toBeInstanceOf(TypeError);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lets the same call through with the user token, or when nobody is signed in', async () => {
    const { mod } = await loadConfigured();
    const fetchSpy = answering(200);
    vi.stubGlobal('fetch', fetchSpy);

    await mod.supabaseFetch(`${BASE}/rest/v1/legal_documents`, {
      headers: { Authorization: `Bearer ${ANON}` },
    });
    localStorage.setItem(KEY, JSON.stringify(stored));
    await mod.supabaseFetch(`${BASE}/rest/v1/profiles`, {
      headers: new Headers({ Authorization: 'Bearer user.jwt.token' }),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('gives the token refresh a longer wait than other auth calls', async () => {
    const { requestTimeoutFor, REQUEST_TIMEOUT_MS } = await loadModule();
    expect(requestTimeoutFor(REFRESH_URL)).toBe(REQUEST_TIMEOUT_MS.refresh);
    expect(REQUEST_TIMEOUT_MS.refresh).toBeGreaterThan(REQUEST_TIMEOUT_MS.auth);
  });
});

describe('stored session helpers', () => {
  const KEY = 'sb-fake-project-ref-auth-token';
  const stored = {
    access_token: 'a',
    refresh_token: 'r',
    expires_at: 1,
    user: { id: 'user-1' },
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('hands the SDK the same storage key the helpers read', async () => {
    const { createClient } = await loadConfigured();
    expect(createClient).toHaveBeenCalledWith(
      BASE,
      expect.any(String),
      expect.objectContaining({ auth: expect.objectContaining({ storageKey: KEY }) })
    );
  });

  it('reads the stored session without the network — expired or not', async () => {
    const { mod } = await loadConfigured();
    expect(mod.readStoredAuthSession()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(mod.readStoredAuthSession()?.user.id).toBe('user-1');
  });

  it('ignores a stored value that is not a usable session', async () => {
    const { mod } = await loadConfigured();
    localStorage.setItem(KEY, '{not json');
    expect(mod.readStoredAuthSession()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ ...stored, user: null }));
    expect(mod.readStoredAuthSession()).toBeNull();
  });

  it('removes the session locally', async () => {
    const { mod } = await loadConfigured();
    localStorage.setItem(KEY, JSON.stringify(stored));
    localStorage.setItem(`${KEY}-code-verifier`, 'v');
    mod.clearStoredAuthSession();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(`${KEY}-code-verifier`)).toBeNull();
  });

  it('is inert when the cloud is not configured', async () => {
    const { readStoredAuthSession } = await loadModule();
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(readStoredAuthSession()).toBeNull();
  });
});
