// ============================================================================
// Free-plan template quota
// ============================================================================
// The paywall advertises "up to 3" templates on the free plan. Nothing enforced
// it: createWorkoutTemplate wrote straight to IndexedDB and the cloud accepted
// unlimited rows, so the paid tier's headline limit was not real.
//
// Enforcement is deliberately two-layered — this client pre-check for a clear,
// immediate refusal, plus trg_enforce_free_template_quota in
// 20260726100000_billing_core.sql so no client path can bypass it.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetEntitlement = vi.hoisted(() => vi.fn());
const mockIsPremium = vi.hoisted(() => vi.fn());

vi.mock('../billing/entitlementService', () => ({
  getEntitlement: mockGetEntitlement,
  isPremium: mockIsPremium,
}));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../supabaseSync', () => ({ syncWorkoutTemplate: vi.fn() }));
vi.mock('../syncEngine', () => ({ syncWithRetry: vi.fn() }));

import { clearDatabase } from '../indexedDBCore';
import {
  createWorkoutTemplate,
  getRemainingFreeTemplates,
  getWorkoutTemplates,
  isFreeTemplateLimitError,
} from '../templateDb';

/** Minimal template payload; the service fills id/createdAt/updatedAt. */
const template = (name: string, extra: Record<string, unknown> = {}) =>
  ({ name, exercises: [], ...extra }) as never;

beforeEach(async () => {
  await clearDatabase();
  mockGetEntitlement.mockResolvedValue({ plan: 'free', status: 'active', currentPeriodEnd: null });
  mockIsPremium.mockReturnValue(false);
});

afterEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

describe('createWorkoutTemplate — free-plan quota', () => {
  it('allows exactly three templates on the free plan', async () => {
    for (let i = 0; i < 3; i++) {
      await createWorkoutTemplate(template(`תבנית ${i + 1}`));
    }
    expect(await getWorkoutTemplates()).toHaveLength(3);
  });

  it('refuses the fourth template with a typed error', async () => {
    for (let i = 0; i < 3; i++) {
      await createWorkoutTemplate(template(`תבנית ${i + 1}`));
    }

    let caught: unknown;
    try {
      await createWorkoutTemplate(template('רביעית'));
    } catch (err) {
      caught = err;
    }

    expect(isFreeTemplateLimitError(caught)).toBe(true);
    // The refused template must not have been written locally either.
    expect(await getWorkoutTemplates()).toHaveLength(3);
  });

  it('does not count app-managed program-day templates against the quota', async () => {
    await createWorkoutTemplate(template('יום תוכנית', { isProgramHidden: true }));
    await createWorkoutTemplate(template('יום תוכנית 2', { isProgramHidden: true }));

    for (let i = 0; i < 3; i++) {
      await createWorkoutTemplate(template(`שלי ${i + 1}`));
    }
    expect(await getWorkoutTemplates()).toHaveLength(3);
  });

  it('is unlimited for a premium entitlement', async () => {
    mockIsPremium.mockReturnValue(true);
    for (let i = 0; i < 6; i++) {
      await createWorkoutTemplate(template(`תבנית ${i + 1}`));
    }
    expect(await getWorkoutTemplates()).toHaveLength(6);
  });

  it('reports the remaining free allowance, and null when unlimited', async () => {
    expect(await getRemainingFreeTemplates()).toBe(3);
    await createWorkoutTemplate(template('אחת'));
    expect(await getRemainingFreeTemplates()).toBe(2);

    mockIsPremium.mockReturnValue(true);
    expect(await getRemainingFreeTemplates()).toBeNull();
  });
});
