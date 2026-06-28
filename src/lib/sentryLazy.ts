/**
 * Lazy Sentry facade.
 *
 * `@sentry/react` is a sizeable dependency that previously sat in the eager
 * entry bundle (imported by the logger, the error boundaries and web-vitals,
 * all of which load on first paint). Yet `Sentry.init()` only ever runs AFTER
 * the user grants analytics consent — so on a first visit the SDK was shipped
 * but never used.
 *
 * This facade keeps the SDK out of the critical path: it is dynamically
 * imported exactly once, from the consent-gated `startAnalytics()` in main.tsx
 * (via {@link loadSentry}). Until then `captureException` / `addBreadcrumb`
 * here are no-ops — which is identical to the previous behaviour, because an
 * un-initialised Sentry client dropped those calls anyway. No telemetry is
 * sent (and no code is downloaded) before consent.
 *
 * `import type` below is erased at compile time, so it never pulls the SDK into
 * the bundle; only the dynamic `import('@sentry/react')` inside `loadSentry`
 * creates a (separate, lazily-fetched) chunk.
 */
import type * as SentryReact from '@sentry/react';

type SentryModule = typeof SentryReact;
type CaptureContext = Parameters<SentryModule['captureException']>[1];
type BreadcrumbInput = Parameters<SentryModule['addBreadcrumb']>[0];

let sentry: SentryModule | null = null;
let loadPromise: Promise<SentryModule> | null = null;

/**
 * Dynamically import `@sentry/react` once. Memoised, so repeated calls share a
 * single network request / module instance. Call this from the consent-gated
 * analytics bootstrap before `Sentry.init(...)`.
 */
export function loadSentry(): Promise<SentryModule> {
  if (!loadPromise) {
    loadPromise = import('@sentry/react').then((mod) => {
      sentry = mod;
      return mod;
    });
  }
  return loadPromise;
}

/** True once the SDK has finished loading (i.e. analytics consent was granted). */
export function isSentryLoaded(): boolean {
  return sentry !== null;
}

/**
 * Report an exception. No-op until the SDK has loaded (no consent yet), which
 * mirrors the prior "captureException on an un-initialised client" behaviour.
 */
export function captureException(error: unknown, context?: CaptureContext): void {
  sentry?.captureException(error, context);
}

/** Add a breadcrumb. No-op until the SDK has loaded. */
export function addBreadcrumb(breadcrumb: BreadcrumbInput): void {
  sentry?.addBreadcrumb(breadcrumb);
}
