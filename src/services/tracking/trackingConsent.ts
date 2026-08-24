// ============================================================================
// TRACKING CONSENT — first-party cookie/tracking preference store.
//
// Categories: necessary (always on), analytics (Sentry + web-vitals), marketing
// (none yet). Persisted per-device in localStorage with a version so a policy
// change re-prompts. Honors Global Privacy Control (GPC) as an opt-out signal.
//
// Consent-Mode pattern: analytics/marketing SDKs initialise ONLY after the user
// opts in (see main.tsx, which subscribes via onTrackingConsentChange).
// ============================================================================

export type TrackingCategory = 'necessary' | 'analytics' | 'marketing';

export interface TrackingConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
  /** ISO timestamp of the decision, or null if the user has not decided yet. */
  decidedAt: string | null;
}

const STORAGE_KEY = 'tracking_consent';
export const CONSENT_VERSION = '2026-06-09';

type Listener = (consent: TrackingConsent) => void;
const listeners = new Set<Listener>();

/** True when the browser sends a Global Privacy Control opt-out signal. */
export function isGpcEnabled(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

function defaultConsent(): TrackingConsent {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
    decidedAt: null,
  };
}

export function getTrackingConsent(): TrackingConsent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConsent();
    const parsed = JSON.parse(raw) as Partial<TrackingConsent>;
    // A version bump invalidates a prior decision → re-prompt.
    if (parsed.version !== CONSENT_VERSION) return defaultConsent();
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: CONSENT_VERSION,
      decidedAt: parsed.decidedAt ?? null,
    };
  } catch {
    return defaultConsent();
  }
}

/** Whether the user has made an explicit choice for the current version. */
export function isTrackingDecided(): boolean {
  return getTrackingConsent().decidedAt !== null;
}

export function hasAnalyticsConsent(): boolean {
  return getTrackingConsent().analytics;
}

export function setTrackingConsent(choice: { analytics: boolean; marketing: boolean }): void {
  const next: TrackingConsent = {
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode) — consent still applies in-memory
    // for this session via the listener notification below.
  }
  for (const listener of listeners) listener(next);
}

export function acceptAllTracking(): void {
  // A Global Privacy Control signal is a standing opt-out (the policy already
  // advertises honouring it) — it overrides an "accept all" tap.
  if (isGpcEnabled()) {
    rejectNonEssentialTracking();
    return;
  }
  setTrackingConsent({ analytics: true, marketing: true });
}

export function rejectNonEssentialTracking(): void {
  setTrackingConsent({ analytics: false, marketing: false });
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onTrackingConsentChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
