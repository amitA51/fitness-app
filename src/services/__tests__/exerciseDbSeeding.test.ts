import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPersonalExercises } from '../exerciseDb';
import { clearDatabase } from '../indexedDBCore';

beforeEach(async () => {
  localStorage.clear();
  await clearDatabase();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('exerciseDb seeding (fresh / empty storage)', () => {
  it('seeds a non-empty built-in library on a completely empty DB', async () => {
    // First-load path: store is empty, so getPersonalExercises must seed the
    // built-ins and resolve a populated list (guards the blank-list race).
    const exercises = await getPersonalExercises();

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((ex) => typeof ex.id === 'string' && ex.id.length > 0)).toBe(true);
  });

  it('resolves the same already-seeded list on the second call (no duplicate seeding)', async () => {
    const first = await getPersonalExercises();
    const second = await getPersonalExercises();

    expect(second.length).toBe(first.length);
  });

  it('still seeds when crypto.randomUUID is unavailable (non-secure context)', async () => {
    // Reproduces the fresh-only bug: over plain HTTP (e.g. a LAN IP) the
    // browser does not expose crypto.randomUUID, so the seeding branch used to
    // throw a synchronous TypeError, rejecting the promise the selector awaits
    // and leaving the screen stuck behind the modal blur.
    const cryptoObj = globalThis.crypto as Crypto & { randomUUID?: unknown };
    const hadOwn = Object.prototype.hasOwnProperty.call(cryptoObj, 'randomUUID');
    Object.defineProperty(cryptoObj, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const exercises = await getPersonalExercises();
      expect(exercises.length).toBeGreaterThan(0);
      expect(exercises.every((ex) => typeof ex.id === 'string' && ex.id.length > 0)).toBe(true);
    } finally {
      // Restore the inherited (prototype) implementation for other tests.
      Reflect.deleteProperty(cryptoObj, 'randomUUID');
      if (hadOwn) {
        Object.defineProperty(cryptoObj, 'randomUUID', {
          value: () => '00000000-0000-4000-8000-000000000000',
          configurable: true,
          writable: true,
        });
      }
    }
  });
});
