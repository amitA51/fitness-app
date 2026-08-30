import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `src/lib/supabase.ts` reads `import.meta.env` at module-load time, so every test
 * stubs the env and re-imports the module via `vi.resetModules()`.
 *
 * The guarded bug: `Boolean(url && key)` accepted placeholder text from a committed
 * `.env`, built a real client against a non-Supabase host and bypassed the designed
 * local-only path. Config must now be validated by SHAPE and fail closed.
 *
 * Every fixture below is obviously fake and correctly shaped — no real project URL
 * and no real key ever appears here.
 */
const FAKE_URL = 'https://fake-project-ref.supabase.co';
const FAKE_JWT = 'eyJmYWtlLWhlYWRlcg.eyJmYWtlLXBheWxvYWQ.ZmFrZS1zaWduYXR1cmU';
const PLACEHOLDER_URL = 'your-supabase-url-here';
const PLACEHOLDER_KEY = 'your-supabase-anon-key-here';

const warnSpy = vi.fn();

const loadSupabaseModule = async (url: string, anonKey: string) => {
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey);
  // Mocked so a "configured" case never constructs a real client, and so the
  // rejection cases can prove the constructor was not reached at all.
  const createClient = vi.fn(() => ({ from: vi.fn() }));
  vi.doMock('@supabase/supabase-js', () => ({ createClient }));
  vi.doMock('../../utils/logger', () => ({ logger: { sync: { warn: warnSpy } } }));

  const module = await import('../supabase');
  return { ...module, createClient };
};

describe('supabase config validation (shape, not truthiness)', () => {
  beforeEach(() => {
    vi.resetModules();
    warnSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@supabase/supabase-js');
    vi.doUnmock('../../utils/logger');
  });

  it('accepts a correctly shaped https URL and JWT anon key', async () => {
    // Arrange + Act
    const { isSupabaseConfigured, supabase, createClient } = await loadSupabaseModule(
      FAKE_URL,
      FAKE_JWT
    );

    // Assert
    expect(isSupabaseConfigured()).toBe(true);
    expect(supabase).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects a placeholder URL that is not a parsable absolute URL', async () => {
    // Arrange + Act
    const { isSupabaseConfigured, supabase, createClient } = await loadSupabaseModule(
      PLACEHOLDER_URL,
      FAKE_JWT
    );

    // Assert
    expect(isSupabaseConfigured()).toBe(false);
    expect(supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a non-https URL (http, ws and bare hosts are not project URLs)', async () => {
    // Arrange + Act
    const { isSupabaseConfigured, supabase } = await loadSupabaseModule(
      'http://fake-project-ref.supabase.co',
      FAKE_JWT
    );

    // Assert
    expect(isSupabaseConfigured()).toBe(false);
    expect(supabase).toBeNull();
  });

  it('rejects a placeholder anon key that is not JWT shaped', async () => {
    // Arrange + Act
    const { isSupabaseConfigured, supabase, createClient } = await loadSupabaseModule(
      FAKE_URL,
      PLACEHOLDER_KEY
    );

    // Assert
    expect(isSupabaseConfigured()).toBe(false);
    expect(supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a two-segment key and a key with an empty segment', async () => {
    // Arrange + Act
    const twoSegments = await loadSupabaseModule(
      FAKE_URL,
      'eyJmYWtlLWhlYWRlcg.eyJmYWtlLXBheWxvYWQ'
    );

    // Assert
    expect(twoSegments.isSupabaseConfigured()).toBe(false);
    expect(twoSegments.supabase).toBeNull();

    // Arrange + Act
    vi.resetModules();
    const emptySegment = await loadSupabaseModule(
      FAKE_URL,
      'eyJmYWtlLWhlYWRlcg..ZmFrZS1zaWduYXR1cmU'
    );

    // Assert
    expect(emptySegment.isSupabaseConfigured()).toBe(false);
    expect(emptySegment.supabase).toBeNull();
  });

  it('stays unconfigured for empty values, exactly as before (no throw)', async () => {
    // Arrange + Act
    const { isSupabaseConfigured, supabase } = await loadSupabaseModule('', '');

    // Assert
    expect(isSupabaseConfigured()).toBe(false);
    expect(supabase).toBeNull();
    // Absent config is the documented local-only path, not a rejection: stay quiet.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once naming the malformed variable, without echoing its value', async () => {
    // Arrange + Act
    await loadSupabaseModule(PLACEHOLDER_URL, PLACEHOLDER_KEY);

    // Assert
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]?.[0]);
    expect(message).toContain('VITE_SUPABASE_URL');
    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
    expect(message).not.toContain(PLACEHOLDER_URL);
    expect(message).not.toContain(PLACEHOLDER_KEY);
  });
});
