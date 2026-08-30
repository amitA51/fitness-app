// ============================================================================
// check-supabase-env — abort a release build that would ship with no cloud sync
// ============================================================================
// Vite inlines `import.meta.env.VITE_*` at BUILD time. If a build is made on a
// machine or path without a valid `.env.local`, the Supabase URL and anon key are
// baked in empty or as placeholder text, and `src/lib/supabase.ts` then correctly
// degrades to local-only mode: `supabase` is null, `isSupabaseConfigured()` is
// false, and the app installs, opens, logs workouts — and saves NOTHING to the
// cloud. Nothing crashes, nothing warns, and testers lose their data on reinstall.
//
// Graceful degradation is the right RUNTIME behaviour and the wrong BUILD
// behaviour, so this runs BEFORE `vite build` and fails fast.
//
// Env is read through Vite's own `loadEnv` — the same loader, the same file
// precedence (.env, .env.local, .env.[mode], .env.[mode].local, then inline
// `process.env` overrides) — so the guard can never disagree with what the build
// inlines. No `.env` file is opened, written or created by this script, and no
// value (not a prefix, not a length) is ever printed: names only.
//
// Usage:  node scripts/check-supabase-env.mjs [--warn] [--mode=production]
//   default   missing/malformed config → message on stderr, exit 1
//   --warn    same message, exit 0 (used by the plain `npm run build`)
// Wired into `npm run build`, `npm run build:release` and `npm run build:android`.
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

/**
 * The two shape rules below are DUPLICATED from `src/lib/supabase.ts` and must
 * stay in sync with it. They cannot be imported: that module is TypeScript, reads
 * `import.meta.env`, and builds the client at module scope — importing it from a
 * node script would execute all of that. Two rules that drift apart is how this
 * class of bug is born, so if you change one, change the other in the same commit.
 */

/** A real project URL is an absolute `https:` URL (`https://<ref>.supabase.co`). */
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** The anon key is a JWT: three non-empty dot-separated segments. Shape only. */
const isJwtShaped = (value) => {
  const segments = value.split('.');
  return segments.length === 3 && segments.every((segment) => segment.length > 0);
};

/** Every variable the app needs inlined for cloud sync to exist at all. */
const REQUIRED = [
  {
    name: 'VITE_SUPABASE_URL',
    expected: 'an absolute https: URL, e.g. https://<project-ref>.supabase.co',
    isValid: isHttpsUrl,
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    expected: 'the project anon key — a JWT: three non-empty dot-separated segments',
    isValid: isJwtShaped,
  },
];

/**
 * Pure, so it can be exercised directly without a build and without a `.env` file.
 * Mirrors `src/lib/supabase.ts`: an absent or empty value is MISSING, a present
 * value that fails its shape rule is MALFORMED. Returns names, never values.
 */
export function validateSupabaseEnv(env) {
  const missing = [];
  const malformed = [];

  for (const variable of REQUIRED) {
    const value = env[variable.name];
    if (!value) {
      missing.push(variable);
      continue;
    }
    if (!variable.isValid(value)) {
      malformed.push(variable);
    }
  }

  return { ok: missing.length === 0 && malformed.length === 0, missing, malformed };
}

function report({ missing, malformed }, { warnOnly }) {
  const lines = [
    warnOnly
      ? 'check-supabase-env: WARNING — this build will have NO CLOUD SYNC.'
      : 'check-supabase-env: BUILD ABORTED — this build would have NO CLOUD SYNC.',
    '',
  ];

  if (missing.length > 0) {
    lines.push(`  missing:   ${missing.map((v) => v.name).join(', ')}`);
  }
  if (malformed.length > 0) {
    lines.push(`  malformed: ${malformed.map((v) => v.name).join(', ')}`);
  }

  lines.push(
    '',
    'Vite inlines these at build time. Absent or placeholder-shaped, src/lib/supabase.ts',
    'degrades to local-only mode: the app installs, opens, logs workouts — and saves nothing',
    'to the cloud. Nothing crashes and nothing warns at runtime.',
    '',
    'Fix: set them in .env.local at the project root (or as real environment variables in',
    'CI), then re-run. Both are read for SHAPE only and are never printed.'
  );

  for (const variable of [...missing, ...malformed]) {
    lines.push(`  ${variable.name} — ${variable.expected}`);
  }

  lines.push('Both values: Supabase dashboard → Project Settings → API.');

  // stderr for both paths: a warning that scrolls past in a build log is exactly
  // the silence this guard exists to remove.
  console.error(lines.join('\n'));
}

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn');
const mode = args.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length) ?? 'production';

// Only check when run as a command. Importing this module — from a test, or to
// reuse `validateSupabaseEnv` — must not read env or exit the process.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  // `vite build` defaults to mode 'production' and `envDir` defaults to the project
  // root, which is where npm runs these scripts from.
  const result = validateSupabaseEnv(loadEnv(mode, process.cwd(), 'VITE_'));

  if (result.ok) {
    console.log(
      `check-supabase-env: Supabase config present and well-shaped (mode ${mode}) — cloud sync will work.`
    );
  } else {
    report(result, { warnOnly });
    if (!warnOnly) process.exit(1);
  }
}
