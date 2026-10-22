// ============================================================================
// The public website's address
// ============================================================================
// Inside the native apps the page origin is the shell's own (https://localhost
// on Android, capacitor://localhost on iOS), which no outside service can send
// a user back to. Where a real web address is needed — Strava's return page —
// the apps use the public site instead. Override with VITE_PUBLIC_SITE_URL.
// ============================================================================

const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();

export const PUBLIC_SITE_ORIGIN = (configured || 'https://fitness-app-amit.netlify.app').replace(
  /\/+$/,
  ''
);
