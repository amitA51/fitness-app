// ============================================================================
// CONSENT SERVICE — wrappers around the current_legal_versions / record_consent
// RPCs (migration 20260609000000_legal_consent.sql).
//
// Failure policy, deliberately split (mirrors services/ageGate.ts):
//
//   * BACKEND NOT PRESENT (Supabase unconfigured, or the migration/seed not yet
//     applied) → fail OPEN. The app must keep working before this ships.
//   * ANY OTHER FAILURE (network blip, RLS refusal, RPC error) → fail CLOSED.
//
// The second half used to fail open too: a read error returned `[]`, which
// ConsentContext read as "nothing to accept", and a write error was swallowed, so
// `accept()` dismissed the gate even though no consent had been recorded. Either
// path produced a user who had legally accepted nothing while the app behaved as
// if they had — the exact opposite of what a consent record is for.
//
// What the GATE does with an unreadable status is decided one level up, in
// getConsentGateStatus: the last answer the server gave this user (kept for
// CONSENT_LKG_TTL_MS) stands in for a failed read, so an overloaded server no
// longer walls off people who already accepted.
// ============================================================================

import { supabase } from '../../lib/supabase';
import {
  type AccountRef,
  isNewAccount,
  readLastKnownGood,
  writeLastKnownGood,
} from '../../utils/lastKnownGood';
import { logger } from '../../utils/logger';
import type { LegalDocType, LegalVersionStatus, RecordConsentOptions } from './types';

interface CurrentVersionRow {
  doc_type: LegalDocType;
  current_version: string;
  content_hash: string;
  effective_date: string;
  accepted_version: string | null;
  needs_consent: boolean;
}

/** Documents every user must accept. coach_terms is handled separately for coaches. */
export const REQUIRED_DOC_TYPES: LegalDocType[] = ['terms', 'privacy'];

/** Postgres undefined_table / undefined_function — the migration is not applied. */
const PG_UNDEFINED_TABLE = '42P01';
const PG_UNDEFINED_FUNCTION = '42883';

function isBackendMissing(error: { code?: string } | null): boolean {
  return error?.code === PG_UNDEFINED_TABLE || error?.code === PG_UNDEFINED_FUNCTION;
}

/** Outcome of a consent-status read, with the failure mode kept distinguishable. */
export interface ConsentStatusResult {
  statuses: LegalVersionStatus[];
  /**
   * True when the status could not be determined. The caller must NOT treat this
   * as "no consent needed" — it should surface a retry instead.
   */
  unavailable: boolean;
}

/**
 * The current legal-version status for the signed-in user.
 *
 * Resolves with an empty list only when there is genuinely nothing to accept or
 * the backend is not present yet. A real failure sets `unavailable`.
 */
export async function getLegalConsentStatus(locale = 'he'): Promise<ConsentStatusResult> {
  if (!supabase) return { statuses: [], unavailable: false };

  let data: unknown;
  let error: { code?: string; message?: string } | null;
  try {
    ({ data, error } = await supabase.rpc('current_legal_versions', { _locale: locale }));
  } catch (err) {
    // A request that never got an answer (aborted by the fetch timeout, network
    // gone) is as unknown as an error response.
    logger.db.error('current_legal_versions threw', err);
    return { statuses: [], unavailable: true };
  }
  if (error) {
    if (isBackendMissing(error)) {
      logger.db.warn('current_legal_versions unavailable (migration not applied)', error);
      return { statuses: [], unavailable: false };
    }
    logger.db.error('current_legal_versions failed', error);
    return { statuses: [], unavailable: true };
  }

  const rows = (data ?? []) as CurrentVersionRow[];
  return {
    statuses: rows.map((r) => ({
      docType: r.doc_type,
      currentVersion: r.current_version,
      contentHash: r.content_hash,
      effectiveDate: r.effective_date,
      acceptedVersion: r.accepted_version,
      needsConsent: r.needs_consent,
    })),
    unavailable: false,
  };
}

/** How long a "nothing to accept" answer stands in for a failed consent read. */
export const CONSENT_LKG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const consentLkgKey = (userId: string): string => `consent_status_lkg:${userId}`;

/**
 * The documents this user still had to accept at the server's last answer, or
 * null when nothing usable is stored. A "nothing to accept" answer expires after
 * CONSENT_LKG_TTL_MS; a "still needed" one never does — only a live answer may
 * lift it, so neither time nor a moved clock lets a user past it.
 */
export function readCachedConsentPending(userId: string): LegalVersionStatus[] | null {
  const key = consentLkgKey(userId);
  const any = readLastKnownGood<unknown>(key, Number.POSITIVE_INFINITY);
  if (!Array.isArray(any)) return null;
  if (any.length > 0) return any as LegalVersionStatus[];
  return readLastKnownGood<unknown>(key, CONSENT_LKG_TTL_MS) === null ? null : [];
}

/**
 * Store a SERVER answer (never a fallback) as this user's last known status.
 * `askedAt` is when the question was asked; see writeLastKnownGood for why an
 * older question never overwrites a newer answer.
 */
export function cacheConsentPending(
  userId: string,
  pending: LegalVersionStatus[],
  askedAt = Date.now()
): void {
  writeLastKnownGood(consentLkgKey(userId), pending, askedAt);
}

/** What the consent gate should act on. */
export interface ConsentGateStatus {
  /** Documents the user must accept before continuing. */
  pending: LegalVersionStatus[];
  /** The live read failed; `pending` is the last server answer, or empty. */
  unavailable: boolean;
  /**
   * No answer at all — live or stored — for a NEW account: keep the gate up
   * (it cannot list the documents) and re-check. See isNewAccount.
   */
  unverified: boolean;
}

/**
 * The consent status the gate acts on, with a last-known-good fallback.
 *
 *   * Server answered → that answer, and it becomes the new last-known-good.
 *   * Read failed, a stored answer exists → that answer. A user the server had
 *     cleared (within the last 30 days) stays cleared; a user it had asked to
 *     accept is still asked.
 *   * Read failed, nothing stored, account older than a week → let the user in
 *     (fail OPEN); ConsentContext re-checks while the read keeps failing.
 *   * Read failed, nothing stored, NEW account → `unverified`: the gate stays up.
 *
 * Why failing open is acceptable for the older account: it was asked when it
 * was new (a new account with no answer is held at the gate), and the gate only
 * comes back when the terms change. It has nothing stored here because it was
 * first seen on this device before answers were kept, or is on a new device or
 * cleared storage. The server-side record in user_consents stays the record of
 * truth, and the gate goes up as soon as a read answers "needed". Blocking on an
 * outage, by contrast, walled off every user who had already accepted, for as
 * long as the database was overloaded.
 */
export async function getConsentGateStatus(
  account: AccountRef,
  locale = 'he'
): Promise<ConsentGateStatus> {
  const askedAt = Date.now();
  const live = await getLegalConsentStatus(locale);
  if (!live.unavailable) {
    const pending = live.statuses.filter((s) => s.needsConsent);
    cacheConsentPending(account.id, pending, askedAt);
    return { pending, unavailable: false, unverified: false };
  }
  const cached = readCachedConsentPending(account.id);
  if (cached) return { pending: cached, unavailable: true, unverified: false };
  return { pending: [], unavailable: true, unverified: isNewAccount(account) };
}

/**
 * Record a single consent acceptance (append-only, idempotent on the server).
 *
 * Returns false when the acceptance was NOT recorded. The caller must keep the
 * gate up in that case: silently swallowing this is how a user ends up marked as
 * having accepted terms that were never written down.
 */
export async function recordConsent(
  docType: LegalDocType,
  version: string,
  options: RecordConsentOptions = {}
): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.rpc('record_consent', {
      _doc_type: docType,
      _version: version,
      _locale: options.locale ?? 'he',
      _is_minor: options.isMinor ?? false,
      _guardian_ack: options.guardianAck ?? false,
    });
    if (error) {
      // A missing migration is not a refusal to consent; anything else is.
      if (isBackendMissing(error)) {
        logger.db.warn('record_consent unavailable (migration not applied)', error);
        return true;
      }
      logger.db.error('record_consent failed', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.db.error('record_consent threw', err);
    return false;
  }
}

/**
 * Record consent for every document that currently needs it.
 *
 * Returns false if ANY acceptance failed to persist, so the caller can keep the
 * gate up rather than letting the user through on an unrecorded acceptance.
 */
export async function acceptPendingConsents(
  statuses: LegalVersionStatus[],
  options: RecordConsentOptions = {}
): Promise<boolean> {
  let allRecorded = true;
  for (const status of statuses) {
    if (!status.needsConsent) continue;
    const recorded = await recordConsent(status.docType, status.currentVersion, options);
    if (!recorded) allRecorded = false;
  }
  return allRecorded;
}
