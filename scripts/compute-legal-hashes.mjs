// ============================================================================
// Compute sha256 content hashes for the legal documents in
// src/content/legal/legalDocs.ts, using the shared canonicalText() so the value
// matches what the client renders. Run: `node scripts/compute-legal-hashes.mjs`
// Paste the printed hashes into the seed migration (…_seed_legal_v1.sql).
// ============================================================================

import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const entry = `
export { TERMS_DOC, PRIVACY_DOC, COACH_TERMS_DOC } from './src/content/legal/legalDocs.ts';
export { canonicalText } from './src/content/legal/legalHash.ts';
`;

const result = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
});

const code = result.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

for (const doc of [mod.TERMS_DOC, mod.PRIVACY_DOC, mod.COACH_TERMS_DOC]) {
  const hash = createHash('sha256').update(mod.canonicalText(doc), 'utf8').digest('hex');
  console.log(`${doc.docType}\t${doc.version}\t${hash}`);
}
