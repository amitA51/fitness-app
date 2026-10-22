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

import {
  CONSENT_LKG_TTL_MS,
  acceptPendingConsents,
  cacheConsentPending,
  getConsentGateStatus,
  getLegalConsentStatus,
  readCachedConsentPending,
  recordConsent,
} from '../consentService';
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
  localStorage.clear();
});

const pendingTermsRow = {
  doc_type: 'terms',
  current_version: '2.0',
  content_hash: 'hash',
  effective_date: '2026-01-01',
  accepted_version: null,
  needs_consent: true,
};

const acceptedTermsRow = { ...pendingTermsRow, accepted_version: '2.0', needs_consent: false };

const networkDown = { data: null, error: { message: 'network', code: '08006' } };

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

describe('getConsentGateStatus — last-known-good fallback', () => {
  it('follows a live "needed" answer and stores it', async () => {
    rpc.mockResolvedValue({ data: [pendingTermsRow], error: null });

    const result = await getConsentGateStatus({ id: 'u1' });

    expect(result.unavailable).toBe(false);
    expect(result.pending).toHaveLength(1);
    expect(readCachedConsentPending('u1')).toHaveLength(1);
  });

  it('lets a user the server had cleared through when the read fails (no wall on an outage)', async () => {
    rpc.mockResolvedValueOnce({ data: [acceptedTermsRow], error: null });
    await getConsentGateStatus({ id: 'u1' });

    rpc.mockResolvedValueOnce(networkDown);
    const result = await getConsentGateStatus({ id: 'u1' });

    expect(result.unavailable).toBe(true);
    expect(result.pending).toEqual([]);
  });

  it('keeps asking a user the server had asked, when the read fails', async () => {
    rpc.mockResolvedValueOnce({ data: [pendingTermsRow], error: null });
    await getConsentGateStatus({ id: 'u1' });

    rpc.mockResolvedValueOnce(networkDown);
    const result = await getConsentGateStatus({ id: 'u1' });

    expect(result.unavailable).toBe(true);
    expect(result.pending.map((p) => p.docType)).toEqual(['terms']);
  });

  it('fails OPEN for an established account when the read fails and nothing is stored', async () => {
    rpc.mockResolvedValue(networkDown);

    const result = await getConsentGateStatus({ id: 'u1', created_at: '2026-01-01T00:00:00Z' });

    expect(result).toEqual({ pending: [], unavailable: true, unverified: false });
    // A fallback is never stored as if the server had said it.
    expect(readCachedConsentPending('u1')).toBeNull();
  });

  it('holds a NEW account at the gate when the read fails and nothing is stored', async () => {
    // Sign-up records no consent: the gate is the only place a new account is asked.
    rpc.mockResolvedValue(networkDown);

    const result = await getConsentGateStatus({ id: 'u1', created_at: new Date().toISOString() });

    expect(result).toEqual({ pending: [], unavailable: true, unverified: true });
  });

  it('treats a request that throws (fetch timeout) like a failed read', async () => {
    cacheConsentPending('u1', []);
    rpc.mockRejectedValue(new DOMException('The server did not answer in time', 'TimeoutError'));

    const result = await getConsentGateStatus({ id: 'u1' });

    expect(result).toEqual({ pending: [], unavailable: true, unverified: false });
  });

  it('lets a stored "nothing to accept" expire after the TTL', () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - CONSENT_LKG_TTL_MS - 1000);
    cacheConsentPending('u1', []);
    clock.mockRestore();

    expect(readCachedConsentPending('u1')).toBeNull();
  });

  it('never lets a stored "still needed" expire (only a live answer lifts it)', () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - CONSENT_LKG_TTL_MS - 1000);
    cacheConsentPending('u1', [pendingTerms]);
    clock.mockRestore();

    expect(readCachedConsentPending('u1')).toHaveLength(1);
  });

  it('does not let a slow read asked BEFORE an acceptance overwrite it', async () => {
    // The read is asked first and answers "needed" late; meanwhile the
    // acceptance is recorded and stored. The late answer must be dropped.
    let answer: (v: unknown) => void = () => {};
    rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    const slowRead = getConsentGateStatus({ id: 'u1' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    cacheConsentPending('u1', []);

    answer({ data: [pendingTermsRow], error: null });
    await slowRead;

    expect(readCachedConsentPending('u1')).toEqual([]);
  });

  it('keeps answers per user', async () => {
    rpc.mockResolvedValueOnce({ data: [pendingTermsRow], error: null });
    await getConsentGateStatus({ id: 'u1' });

    rpc.mockResolvedValueOnce(networkDown);
    const other = await getConsentGateStatus({ id: 'u2' });

    expect(other.pending).toEqual([]);
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
