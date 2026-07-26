// ============================================================================
// strip-sourcemaps — remove .map files from dist AFTER they have been archived
// ============================================================================
// vite.config.ts builds with `sourcemap: 'hidden'`: the .map files are emitted
// but no `//# sourceMappingURL` comment is written, so browsers never request
// them. They exist so production Sentry stack traces can be de-minified.
//
// They must NOT be published to the CDN, though: the host serves the whole dist
// directory, and a guessable `/assets/index-abc123.js.map` would hand out the
// full readable source. This script copies them to `sourcemaps/` (upload that
// to Sentry as part of the release) and deletes them from `dist/`.
//
// Usage:  node scripts/strip-sourcemaps.mjs
// Wired into `npm run build:release`.
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const archive = path.resolve('sourcemaps');

if (!existsSync(dist)) {
  console.error('strip-sourcemaps: dist/ not found — run the build first.');
  process.exit(1);
}

let moved = 0;

function walk(dir, relative = '') {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.join(relative, entry);
    if (statSync(full).isDirectory()) {
      walk(full, rel);
      continue;
    }
    if (!entry.endsWith('.map')) continue;

    const target = path.join(archive, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    renameSync(full, target);
    moved++;
  }
}

walk(dist);
console.log(
  moved === 0
    ? 'strip-sourcemaps: no .map files found in dist/.'
    : `strip-sourcemaps: moved ${moved} source map(s) to sourcemaps/ — upload them to Sentry, then discard.`
);
