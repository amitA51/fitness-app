/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** Netlify injects the deployed commit; used as the Sentry release id. */
  readonly VITE_COMMIT_REF?: string;
  /** 'true' once the Apple provider is set up in Supabase — shows "המשך עם Apple". */
  readonly VITE_APPLE_SIGN_IN?: string;
  /** The public website, for native-app hand-offs (defaults to the Netlify site). */
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config define(); falls back to package.json version. */
declare const __APP_VERSION__: string;
