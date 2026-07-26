// ============================================================================
// Consent service — fail-closed on real errors, fail-open on a missing backend
// ============================================================================
// Both halves used to fail open. `getLegalConsentStatus` returned `[]` on any
// error, which ConsentContext read as "nothing to accept", and `recordConsent`
// swallowed failures so `accept()` dismissed the gate regardless. Either path
// produced a user who had legally accepted nothing while the app behaved as
// though they had.
//
// The distinction that matters: an UNAPPLIED MIGRATION must not block the app
// (the feature simply is not live yet), but a network blip or an RLS refusal must.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc },
}));

import { acceptPendingConsents, getLegalConsentStatus, recordConsent } from '../consentService';
import type { LegalVersionStatus } from '../types';

const pendingTerms: LegalVersionStatus = {
  docType: 'terms',
  currentVersion: '2.0',
  contentHash: 'hash',
  effectiveDate: '2026-01-01',
  acceptedVersion: null,
  needsConsent: true,
};

beforeEach(() => {
  rpc.mockReset();
});

describe('getLegalConsentStatus', () => {
  it('maps rows and reports availability on success', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          doc_type: 'terms',
          current_version: '2.0',
          content_hash: 'hash',
          effective_date: '2026-01-01',
          accepted_version: null,
          needs_consent: true,
        },
      ],
      error: null,
    });

    const result = await getLegalConsentStatus();

    expect(result.unavailable).toBe(false);
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0]).toMatchObject({ docType: 'terms', needsConsent: true });
  });

  it('reports UNAVAILABLE on a real failure rather than "nothing to accept"', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'network', code: '08006' } });

    const result = await getLegalConsentStatus();

    expect(result.unavailable).toBe(true);
    expect(result.statuses).toEqual([]);
  });

  it('reports UNAVAILABLE on an RLS refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'denied', code: '42501' } });

    expect((await getLegalConsentStatus()).unavailable).toBe(true);
  });

  it('stays available when the migration is simply not applied', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'function does not exist', code: '42883' },
    });

    const result = await getLegalConsentStatus();

    // The feature is not live yet — that must not block the whole app.
    expect(result.unavailable).toBe(false);
    expect(result.statuses).toEqual([]);
  });
});

describe('recordConsent', () => {
  it('returns true when the acceptance is persisted', async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(recordConsent('terms', '2.0')).resolves.toBe(true);
  });

  it('returns FALSE when the write fails, so the gate can stay up', async () => {
    rpc.mockResolvedValue({ error: { message: 'network', code: '08006' } });
    await expect(recordConsent('terms', '2.0')).resolves.toBe(false);
  });

  it('returns false when the RPC throws', async () => {
    rpc.mockRejectedValue(new Error('boom'));
    await expect(recordConsent('terms', '2.0')).resolves.toBe(false);
  });

  it('returns true when the migration is not applied', async () => {
    rpc.mockResolvedValue({ error: { message: 'no such function', code: '42883' } });
    await expect(recordConsent('terms', '2.0')).resolves.toBe(true);
  });
});

describe('acceptPendingConsents', () => {
  it('reports failure when any single acceptance did not persist', async () => {
    const privacy: LegalVersionStatus = { ...pendingTerms, docType: 'privacy' };
    rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'network', code: '08006' } });

    await expect(acceptPendingConsents([pendingTerms, privacy])).resolves.toBe(false);
  });

  it('reports success when every acceptance persisted', async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(acceptPendingConsents([pendingTerms])).resolves.toBe(true);
  });

  it('skips documents that do not need consent', async () => {
    rpc.mockResolvedValue({ error: null });
    await acceptPendingConsents([{ ...pendingTerms, needsConsent: false }]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
