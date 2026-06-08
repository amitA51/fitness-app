// ============================================================================
// LEGAL CONTENT HASHING — shared canonicalization
//
// `canonicalText` is the SINGLE deterministic serialization of a legal document
// used to derive its sha256 content hash. Both the client (Web Crypto, when it
// snapshots what a user accepted) and the seed-hash build script
// (scripts/compute-legal-hashes.mjs) import this exact function, so the hash
// stored in `legal_documents` always matches the rendered text.
// ============================================================================

import type { LegalDoc } from './legalDocs';

/** Deterministic plain-text serialization of a legal document. */
export function canonicalText(doc: LegalDoc): string {
  const parts: string[] = [`${doc.docType}|${doc.version}|${doc.locale}`];
  for (const section of doc.sections) {
    parts.push(`# ${section.heading}`);
    if (section.body) for (const p of section.body) parts.push(p);
    if (section.bullets) for (const b of section.bullets) parts.push(`- ${b}`);
  }
  return parts.join('\n');
}

/** sha256 hex digest via Web Crypto (browser / modern Node). */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
