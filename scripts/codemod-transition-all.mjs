// One-off codemod: replace Tailwind's `transition-all` with the bounded
// `.transition-ui` utility (src/styles/global.css @layer utilities), so state
// transitions never animate layout properties or fight spring/layout animations.
// Run with: node scripts/codemod-transition-all.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const changed = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry)) continue;

    const source = readFileSync(full, 'utf8');
    // Only class-name occurrences: `transition-all` as a whole token.
    if (!/\btransition-all\b/.test(source)) continue;
    const next = source.replace(/\btransition-all\b/g, 'transition-ui');
    if (next === source) continue;
    writeFileSync(full, next);
    changed.push(path.relative(process.cwd(), full));
  }
}

walk(root);
console.log(`rewrote ${changed.length} files:`);
for (const file of changed) console.log(`  ${file}`);
