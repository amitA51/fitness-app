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
// ============================================================================

import { supabase } from '../../lib/supabase';
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

  const { data, error } = await supabase.rpc('current_legal_versions', { _locale: locale });
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
