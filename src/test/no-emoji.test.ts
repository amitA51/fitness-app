import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'test' || name === '__tests__' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(p);
  }
  return acc;
}

describe('no emoji in source', () => {
  it('src/**/*.{ts,tsx} contains no emoji characters', () => {
    const files = walk(ROOT);
    const offenders: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (EMOJI_RE.test(line)) {
          offenders.push(`${relative(ROOT, f)}:${i + 1}`);
        }
      });
    }
    expect(offenders, `Emoji found at:\n${offenders.join('\n')}`).toEqual([]);
  });
});
