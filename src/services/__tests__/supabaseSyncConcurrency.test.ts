import { describe, expect, it, vi } from 'vitest';

// Mock heavy dependencies so syncAllData actually runs its body
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}));

// Track how many times dbGetAll is invoked (proxy for "real work")
const dbGetAllSpy = vi.fn(async () => []);

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
  dbGetAll: () => dbGetAllSpy(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { sync: { info: () => {}, error: () => {} } },
}));

describe('syncAllData concurrency guard', () => {
  it('coalesces concurrent calls — underlying work runs only once', async () => {
    // Skip the one-time legacy-id normalization pass (it has its own suite,
    // idNormalization.test.ts) so the dbGetAll count below isolates the
    // concurrency guard.
    localStorage.setItem('sparkos_legacy_id_normalization_v1', 'done');

    const { syncAllData } = await import('../supabaseSync');

    // Call twice concurrently
    const [r1, r2] = await Promise.all([syncAllData(), syncAllData()]);

    // Both resolve with the same successful result
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    // dbGetAll is called 11 times per real invocation (one per store).
    // If the guard works, it should be called exactly 11 times total, not 22.
    expect(dbGetAllSpy).toHaveBeenCalledTimes(11);
  });
});
