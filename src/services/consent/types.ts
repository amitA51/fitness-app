// Versioned legal-consent shared types. Mirrors the current_legal_versions RPC.

export type LegalDocType = 'terms' | 'privacy' | 'coach_terms';

export interface LegalVersionStatus {
  docType: LegalDocType;
  currentVersion: string;
  contentHash: string;
  effectiveDate: string;
  /** Version the current user last accepted, or null if never. */
  acceptedVersion: string | null;
  /** True when the user must (re-)accept this document. */
  needsConsent: boolean;
}

export interface RecordConsentOptions {
  locale?: string;
  isMinor?: boolean;
  guardianAck?: boolean;
}
