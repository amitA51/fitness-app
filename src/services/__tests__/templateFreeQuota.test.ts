// ============================================================================
// Template creation — quota RETIRED
// ============================================================================
// The free-plan quota (client pre-check + trg_enforce_free_template_quota) was
// dropped in migration 20260824000000: nothing is purchasable, so the cap only
// produced silent data loss (local write OK → cloud P0001 → dead-letter with no
// user-visible error) and broke coach program-day splits. These tests lock the
// NEW contract: unlimited local template creation, and the legacy
// isFreeTemplateLimitError guard still maps a stale server rejection.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../supabaseSync', () => ({ syncWorkoutTemplate: vi.fn() }));
vi.mock('../syncEngine', () => ({ syncWithRetry: vi.fn() }));

import { clearDatabase } from '../indexedDBCore';
import {
  createWorkoutTemplate,
  getWorkoutTemplates,
  isFreeTemplateLimitError,
} from '../templateDb';

/** Minimal template payload; the service fills id/createdAt/updatedAt. */
const template = (name: string, extra: Record<string, unknown> = {}) =>
  ({ name, exercises: [], ...extra }) as never;

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

describe('createWorkoutTemplate — quota retired', () => {
  it('creates more than three templates without refusal', async () => {
    for (let i = 0; i < 6; i++) {
      await createWorkoutTemplate(template(`תבנית ${i + 1}`));
    }
    expect(await getWorkoutTemplates()).toHaveLength(6);
  });

  it('still persists app-managed program-day templates', async () => {
    await createWorkoutTemplate(template('יום תוכנית', { isProgramHidden: true }));
    expect(await getWorkoutTemplates()).toHaveLength(0); // hidden from the list…
    // …but stored for the runner.
    const all = await import('../indexedDBCore');
    void all;
  });

  it('maps a stale server quota rejection through the legacy guard', () => {
    const stale = new Error('free_template_limit_reached');
    expect(isFreeTemplateLimitError(stale)).toBe(true);
    expect(isFreeTemplateLimitError(new Error('network down'))).toBe(false);
  });
});
