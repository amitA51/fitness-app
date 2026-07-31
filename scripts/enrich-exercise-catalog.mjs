/**
 * enrich-exercise-catalog.mjs
 *
 * Reads the built-in Hebrew catalog (src/data/builtInExercises.ts) and matches
 * every entry against the free-exercise-db dataset by its English name, so the
 * classification we ship (mechanic / force / level / primaryMuscle) comes from
 * the public dataset rather than from guesswork.
 *
 * It is a REPORTING tool: it never writes to src/. Output is a JSON report the
 * catalog author uses to fill in classification and to see which entries have no
 * upstream match and therefore need a hand-made decision.
 *
 * Usage:
 *   node scripts/enrich-exercise-catalog.mjs [path-to-exercises.json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CATALOG = join(REPO, 'src', 'data', 'builtInExercises.ts');
const DEFAULT_DB = 'C:/Users/amit0/Desktop/db workout github/exercises.json';
const OUT = join(REPO, 'tmp-catalog-enrichment.json');

/** `'לחיצת חזה | Bench Press'` → `'Bench Press'`; Hebrew-only names return ''. */
const englishPart = (name) => {
  const parts = name.split('|').map((p) => p.trim());
  const latin = parts.find((p) => /[A-Za-z]/.test(p));
  return latin ?? '';
};

/** Loose key so "Romanian Deadlift (RDL)" and "Romanian Deadlift" collide. */
const nameKey = (raw) =>
  raw
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Parse the TS catalog. A regex is adequate and dependency-free here because the
// file is generated/maintained in one fixed shape: flat object literals with
// single-quoted values, one `name:` per record.
// ---------------------------------------------------------------------------
const parseCatalog = (source) => {
  const records = [];
  const objectRx = /\{\s*name:\s*'([^']*)'([\s\S]*?)\n  \}/g;
  for (const match of source.matchAll(objectRx)) {
    const [, name, body] = match;
    const field = (key) => {
      const found = body.match(new RegExp(`${key}: '([^']*)'`));
      return found ? found[1] : undefined;
    };
    const numField = (key) => {
      const found = body.match(new RegExp(`${key}: (\\d+)`));
      return found ? Number(found[1]) : undefined;
    };
    records.push({
      name,
      english: englishPart(name),
      muscleGroup: field('muscleGroup'),
      category: field('category'),
      equipment: field('equipment'),
      tempo: field('tempo'),
      defaultRestTime: numField('defaultRestTime'),
      defaultSets: numField('defaultSets'),
      mechanic: field('mechanic'),
      level: field('level'),
      force: field('force'),
      primaryMuscle: field('primaryMuscle'),
    });
  }
  return records;
};

const dbPath = process.argv[2] ?? DEFAULT_DB;
const db = JSON.parse(readFileSync(dbPath, 'utf8'));
const catalog = parseCatalog(readFileSync(CATALOG, 'utf8'));

const dbByKey = new Map();
for (const entry of db) {
  const key = nameKey(entry.name);
  if (!dbByKey.has(key)) dbByKey.set(key, entry);
}

const matched = [];
const unmatched = [];

for (const record of catalog) {
  const upstream = record.english ? dbByKey.get(nameKey(record.english)) : undefined;
  if (!upstream) {
    unmatched.push(record);
    continue;
  }
  matched.push({
    name: record.name,
    english: record.english,
    current: {
      muscleGroup: record.muscleGroup,
      mechanic: record.mechanic,
      force: record.force,
      level: record.level,
      primaryMuscle: record.primaryMuscle,
    },
    upstream: {
      mechanic: upstream.mechanic ?? null,
      force: upstream.force ?? null,
      level: upstream.level ?? null,
      primaryMuscles: upstream.primaryMuscles ?? [],
      secondaryMuscles: upstream.secondaryMuscles ?? [],
      category: upstream.category ?? null,
      equipment: upstream.equipment ?? null,
    },
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  source: dbPath,
  catalogEntries: catalog.length,
  matchedCount: matched.length,
  unmatchedCount: unmatched.length,
  missingClassification: catalog.filter(
    (r) => !r.mechanic || !r.force || !r.level || !r.primaryMuscle
  ).length,
  matched,
  unmatched,
};

writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`catalog entries      : ${report.catalogEntries}`);
console.log(`matched upstream     : ${report.matchedCount}`);
console.log(`no upstream match    : ${report.unmatchedCount}`);
console.log(`missing classification: ${report.missingClassification}`);
console.log(`report               : ${OUT}`);
if (unmatched.length > 0) {
  console.log('\nentries needing a hand-made classification:');
  for (const record of unmatched) console.log(`  - ${record.name}`);
}
