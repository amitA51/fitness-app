// ============================================================================
// CONSENT SERVICE — wrappers around the current_legal_versions / record_consent
// RPCs (migration 20260609000000_legal_consent.sql).
//
// Fail-safe: when Supabase is unconfigured, or the RPC/seed is not yet present,
// these resolve to "no consent needed" so the app never hard-blocks on a
// missing backend. The real enforcement turns on once the migration + seed are
// applied.
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

/**
 * Returns the current legal-version status for the signed-in user. Empty array
 * when Supabase is unconfigured or the RPC is unavailable (fail-open).
 */
export async function getLegalConsentStatus(locale = 'he'): Promise<LegalVersionStatus[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('current_legal_versions', { _locale: locale });
  if (error) {
    logger.db.error('current_legal_versions failed', error);
    return [];
  }
  const rows = (data ?? []) as CurrentVersionRow[];
  return rows.map((r) => ({
    docType: r.doc_type,
    currentVersion: r.current_version,
    contentHash: r.content_hash,
    effectiveDate: r.effective_date,
    acceptedVersion: r.accepted_version,
    needsConsent: r.needs_consent,
  }));
}

/** Records a single consent acceptance (append-only, idempotent on the server). */
export async function recordConsent(
  docType: LegalDocType,
  version: string,
  options: RecordConsentOptions = {}
): Promise<void> {
  if (!supabase) return;
  // Fail-safe: log and return on failure — never throw. Throwing here would
  // break ConsentContext.accept() (the consent gate would never dismiss).
  try {
    const { error } = await supabase.rpc('record_consent', {
      _doc_type: docType,
      _version: version,
      _locale: options.locale ?? 'he',
      _is_minor: options.isMinor ?? false,
      _guardian_ack: options.guardianAck ?? false,
    });
    if (error) logger.db.error('record_consent failed', error);
  } catch (err) {
    logger.db.error('record_consent threw', err);
  }
}

/** Records consent for every document that currently needs it. */
export async function acceptPendingConsents(
  statuses: LegalVersionStatus[],
  options: RecordConsentOptions = {}
): Promise<void> {
  for (const status of statuses) {
    if (status.needsConsent) {
      await recordConsent(status.docType, status.currentVersion, options);
    }
  }
}
