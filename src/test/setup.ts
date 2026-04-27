import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
// @ts-expect-error -- fake-indexeddb ships types at /lib/* but its package.json
// "exports" block blocks the default TS resolution; runtime resolution works.
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import { afterEach, beforeEach } from 'vitest';

// Reset the fake-indexeddb instance before every test so databases and any
// still-open connections from previous tests do not leak across tests.
// This is the recommended isolation pattern for fake-indexeddb and is
// required because services cache a singleton IDBDatabase reference —
// swapping the global factory invalidates any leftover connections and
// guarantees a blank slate. Services null their cached db via clearDatabase().
beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new (
    FDBFactory as unknown as { new (): IDBFactory }
  )();
});

afterEach(() => {
  cleanup();
});
