import { describe, expect, it, vi } from 'vitest';

// Regression guard for CODE-AUDIT item #2: a rejected upsert batch must NOT be
// silently dropped. It has to surface as failedItems > 0, success === false, a
// descriptive error, and a logged sync error — otherwise a transient 5xx loses
// records invisibly.

const errorSpy = vi.fn();

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => ({
      // Every upsert fails, simulating a transient backend error.
      upsert: async () => ({ error: { message: 'simulated 5xx' } }),
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}));

vi.mock('../indexedDBCore', () => ({
  STORES: {
    WORKOUT_TEMPLATES: 'workout_templates',
    WORKOUT_SESSIONS: 'workout_sessions',
    PERSONAL_EXERCISES: 'personal_exercises',
    BODY_WEIGHT: 'body_weight',
    BODY_MEASUREMENTS: 'body_measurements',
    PERSONAL_RECORDS: 'personal_records',
    RECOVERY_LOGS: 'recovery_logs',
    NUTRITION_LOGS: 'nutrition_logs',
    USER_SETTINGS: 'user_settings',
    AI_CONVERSATIONS: 'ai_conversations',
    WATER_LOGS: 'water_logs',
  },
  // Only templates has a record to push, so exactly one record should fail.
  dbGetAll: (store: string) =>
    store === 'workout_templates'
      ? Promise.resolve([{ id: 't1', name: 'T', exercises: [] }])
      : Promise.resolve([]),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    sync: { info: () => {}, warn: () => {}, error: (...args: unknown[]) => errorSpy(...args) },
  },
}));

describe('syncAllData — partial-batch failures are surfaced (audit #2)', () => {
  it('reports failedItems and success=false when an upsert batch errors', async () => {
    const { syncAllData } = await import('../supabaseSync');

    const result = await syncAllData();

    expect(result.success).toBe(false);
    expect(result.failedItems).toBeGreaterThanOrEqual(1);
    expect(result.syncedItems).toBe(0);
    expect(result.error).toMatch(/failed to push/);
    // The rejected batch must have been logged, not swallowed.
    expect(errorSpy).toHaveBeenCalled();
  });
});
