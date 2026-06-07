import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORES, clearDatabase, initDB } from '../indexedDBCore';

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('indexedDBCore schema', () => {
  it('keeps date indexes for body-stat stores used by range queries', async () => {
    const db = await initDB();
    const tx = db.transaction([STORES.BODY_WEIGHT, STORES.BODY_MEASUREMENTS], 'readonly');

    expect(tx.objectStore(STORES.BODY_WEIGHT).indexNames.contains('date')).toBe(true);
    expect(tx.objectStore(STORES.BODY_MEASUREMENTS).indexNames.contains('date')).toBe(true);
  });
});
