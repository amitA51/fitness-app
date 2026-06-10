import { beforeEach, describe, expect, it } from 'vitest';
import { isUuid } from '../../utils/id';
import { ID_NORMALIZATION_FLAG, normalizeLegacyLocalIds } from '../idNormalization';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';

// Legacy creators minted prefixed ids (session_<ts>, meal-…, bw-…, rec-…,
// conv-…) that the cloud's uuid columns reject with 22P02 — those records
// could never sync. The one-time normalization pass must rewrite them to
// UUIDs, preserve all data, and keep recovery-log sessionId references and
// the ai_current_conversation pointer consistent.

interface AnyRecord {
  id: string;
  [key: string]: unknown;
}

const LEGACY_SESSION_ID = 'session_1781089080606';
const UUID_SESSION_ID = '11111111-2222-4333-8444-555555555555';

async function seedLegacyData(): Promise<void> {
  await dbPut(STORES.WORKOUT_SESSIONS, {
    id: LEGACY_SESSION_ID,
    date: '2026-06-01',
    startTime: '2026-06-01T10:00:00.000Z',
    totalVolume: 1234,
  });
  await dbPut(STORES.WORKOUT_SESSIONS, {
    id: UUID_SESSION_ID,
    date: '2026-06-02',
    startTime: '2026-06-02T10:00:00.000Z',
    totalVolume: 999,
  });
  await dbPut(STORES.RECOVERY_LOGS, {
    id: 'rec-1781089080606-abc1234',
    date: '2026-06-01',
    sleepHours: 8,
    sessionId: LEGACY_SESSION_ID,
    createdAt: '2026-06-01T20:00:00.000Z',
  });
  await dbPut(STORES.NUTRITION_LOGS, {
    id: 'meal-1781089080606-abc1234',
    date: '2026-06-01',
    name: 'חזה עוף',
    totalMacros: { calories: 500, protein: 40, carbs: 30, fat: 10 },
    createdAt: '2026-06-01T12:00:00.000Z',
  });
  await dbPut(STORES.BODY_WEIGHT, {
    id: 'bw-1781089080606-abc1234',
    date: '2026-06-01',
    weight: 82.5,
    createdAt: '2026-06-01T07:00:00.000Z',
  });
  await dbPut(STORES.BODY_MEASUREMENTS, {
    id: 'bm-1781089080606-abc1234',
    date: '2026-06-01',
    waist: 84,
    createdAt: '2026-06-01T07:00:00.000Z',
  });
  await dbPut(STORES.AI_CONVERSATIONS, {
    id: 'conv-1781089080606-ab123',
    title: 'שיחה',
    messages: [{ role: 'user', content: 'שלום' }],
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:05:00.000Z',
  });
}

beforeEach(async () => {
  localStorage.clear();
  await clearDatabase();
});

describe('normalizeLegacyLocalIds', () => {
  it('rewrites every non-UUID id to a UUID and preserves record data', async () => {
    await seedLegacyData();

    await normalizeLegacyLocalIds();

    const sessions = await dbGetAll<AnyRecord>(STORES.WORKOUT_SESSIONS);
    const nutrition = await dbGetAll<AnyRecord>(STORES.NUTRITION_LOGS);
    const bodyWeight = await dbGetAll<AnyRecord>(STORES.BODY_WEIGHT);
    const measurements = await dbGetAll<AnyRecord>(STORES.BODY_MEASUREMENTS);
    const conversations = await dbGetAll<AnyRecord>(STORES.AI_CONVERSATIONS);

    // No record lost, every id is now a UUID.
    expect(sessions).toHaveLength(2);
    for (const record of [
      ...sessions,
      ...nutrition,
      ...bodyWeight,
      ...measurements,
      ...conversations,
    ]) {
      expect(isUuid(record.id)).toBe(true);
    }

    // Data preserved through the rewrite.
    expect(sessions.map((s) => s.totalVolume as number).sort((a, b) => a - b)).toEqual([
      999, 1234,
    ]);
    expect(nutrition[0]?.name).toBe('חזה עוף');
    expect(bodyWeight[0]?.weight).toBe(82.5);
    expect(measurements[0]?.waist).toBe(84);
    expect((conversations[0]?.messages as AnyRecord[])[0]?.content).toBe('שלום');

    // Records that already had UUID ids are untouched.
    expect(sessions.some((s) => s.id === UUID_SESSION_ID)).toBe(true);
  });

  it('remaps recovery-log sessionId references with the session old→new map', async () => {
    await seedLegacyData();

    await normalizeLegacyLocalIds();

    const sessions = await dbGetAll<AnyRecord>(STORES.WORKOUT_SESSIONS);
    const recovery = await dbGetAll<AnyRecord>(STORES.RECOVERY_LOGS);
    const remappedSession = sessions.find((s) => s.totalVolume === 1234);

    expect(recovery).toHaveLength(1);
    expect(isUuid(recovery[0]?.id)).toBe(true);
    // The dangling reference now points at the session's NEW id.
    expect(recovery[0]?.sessionId).toBe(remappedSession?.id);
    expect(recovery[0]?.sessionId).not.toBe(LEGACY_SESSION_ID);
  });

  it('remaps the ai_current_conversation localStorage pointer', async () => {
    await seedLegacyData();
    localStorage.setItem('ai_current_conversation', 'conv-1781089080606-ab123');

    await normalizeLegacyLocalIds();

    const conversations = await dbGetAll<AnyRecord>(STORES.AI_CONVERSATIONS);
    expect(localStorage.getItem('ai_current_conversation')).toBe(conversations[0]?.id);
  });

  it('is idempotent: a second run changes nothing and the flag short-circuits', async () => {
    await seedLegacyData();

    await normalizeLegacyLocalIds();
    expect(localStorage.getItem(ID_NORMALIZATION_FLAG)).not.toBeNull();

    const firstPass = (await dbGetAll<AnyRecord>(STORES.WORKOUT_SESSIONS))
      .map((s) => s.id)
      .sort();

    // Second run with the flag set — no-op.
    await normalizeLegacyLocalIds();
    // Third run even WITHOUT the flag — ids are already UUIDs, still no-op.
    localStorage.removeItem(ID_NORMALIZATION_FLAG);
    await normalizeLegacyLocalIds();

    const thirdPass = (await dbGetAll<AnyRecord>(STORES.WORKOUT_SESSIONS))
      .map((s) => s.id)
      .sort();
    expect(thirdPass).toEqual(firstPass);
  });

  it('resolves without throwing when stores are empty', async () => {
    await expect(normalizeLegacyLocalIds()).resolves.toBeUndefined();
    expect(localStorage.getItem(ID_NORMALIZATION_FLAG)).not.toBeNull();
  });
});
