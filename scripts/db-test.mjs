// ============================================================================
// db-test — run the SQL suites in supabase/tests against a throwaway Postgres
// ============================================================================
// The migrations contain real logic: an optimistic-concurrency trigger, an
// idempotent webhook RPC, an entitlement projection, a quota trigger and a set of
// RLS policies. None of that is covered by the Vitest suite, which never touches
// a database — so before this script the SQL was shipped unexecuted.
//
// Requirements: Docker. Nothing else; no Supabase project and no credentials.
//
//   npm run db:test
//
// The container is created and removed by this script. A non-zero exit means a
// migration failed to apply or an assertion failed.
// ============================================================================

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CONTAINER = 'sparkos-dbtest';
const IMAGE = 'postgres:16-alpine';
const DB = 'sparkos_test';

/** Applied in order. The stub stands in for Supabase's auth schema and grants. */
const SETUP = [
  'supabase/tests/fixtures/supabase_min_stub.sql',
  'supabase/migrations/20260610000100_entitlements.sql',
  'supabase/migrations/20260611000000_community.sql',
  'supabase/migrations/20260726090000_account_deletion_audit.sql',
  'supabase/migrations/20260726100000_billing_core.sql',
  'supabase/migrations/20260726110000_product_events.sql',
  'supabase/migrations/20260726120000_sync_integrity.sql',
  'supabase/migrations/20260726130000_rate_limit_atomic.sql',
  'supabase/migrations/20260726140000_community_write_rpcs.sql',
];

/** Each is applied to a fresh transaction and must print "ALL ASSERTIONS PASSED". */
const SUITES = [
  'supabase/tests/billing_core_test.sql',
  'supabase/tests/rls_2026_07_26_test.sql',
  'supabase/tests/rate_limit_test.sql',
  'supabase/tests/community_write_test.sql',
];

/** Suites needing extra fixtures applied first. */
const SUITES_WITH_FIXTURES = [
  {
    fixtures: ['supabase/tests/fixtures/sync_tables_min.sql'],
    // Re-applied so the guard attaches to the fixture tables.
    setup: ['supabase/migrations/20260726120000_sync_integrity.sql'],
    suite: 'supabase/tests/sync_lww_guard_test.sql',
  },
];

function docker(args, { capture = true } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  return result;
}

function fail(message) {
  console.error(`\n[db:test] FAILED — ${message}`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  docker(['rm', '-f', CONTAINER]);
}

function requireDocker() {
  const result = docker(['version', '--format', '{{.Server.Version}}']);
  if (result.status !== 0) {
    console.error('[db:test] Docker is not available or the daemon is not running.');
    console.error('[db:test] Start Docker Desktop (or a local daemon) and retry.');
    process.exit(1);
  }
  console.log(`[db:test] Docker server ${result.stdout.trim()}`);
}

function startPostgres() {
  cleanup();
  const run = docker([
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    'POSTGRES_PASSWORD=test',
    IMAGE,
  ]);
  if (run.status !== 0) fail(`could not start ${IMAGE}: ${run.stderr.trim()}`);

  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = docker(['exec', CONTAINER, 'pg_isready', '-U', 'postgres']);
    if (ready.stdout.includes('accepting connections')) {
      docker(['exec', CONTAINER, 'createdb', '-U', 'postgres', DB]);
      return;
    }
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},500)']);
  }
  fail('Postgres did not become ready in time');
}

function apply(file, { label = 'apply' } = {}) {
  if (!existsSync(file)) fail(`missing SQL file: ${file}`);
  const name = path.basename(file);
  const copy = docker(['cp', file, `${CONTAINER}:/tmp/${name}`]);
  if (copy.status !== 0) fail(`could not copy ${file}: ${copy.stderr.trim()}`);

  const run = docker([
    'exec',
    CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    DB,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    `/tmp/${name}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  if (run.status !== 0 || /^psql:.*ERROR:/m.test(output)) {
    console.error(output);
    fail(`${label} failed: ${name}`);
  }
  return output;
}

// ── Run ─────────────────────────────────────────────────────────────────────

requireDocker();
startPostgres();

console.log('[db:test] applying schema + migrations');
for (const file of SETUP) apply(file, { label: 'migration' });

let passed = 0;

for (const suite of SUITES) {
  const output = apply(suite, { label: 'suite' });
  if (!output.includes('ALL ASSERTIONS PASSED')) {
    console.error(output);
    fail(`${path.basename(suite)} did not report ALL ASSERTIONS PASSED`);
  }
  console.log(`[db:test] PASS ${path.basename(suite)}`);
  passed++;
}

for (const entry of SUITES_WITH_FIXTURES) {
  for (const fixture of entry.fixtures) apply(fixture, { label: 'fixture' });
  for (const file of entry.setup) apply(file, { label: 'migration' });
  const output = apply(entry.suite, { label: 'suite' });
  if (!output.includes('ALL ASSERTIONS PASSED')) {
    console.error(output);
    fail(`${path.basename(entry.suite)} did not report ALL ASSERTIONS PASSED`);
  }
  console.log(`[db:test] PASS ${path.basename(entry.suite)}`);
  passed++;
}

// Idempotency: every migration must survive a second application.
console.log('[db:test] re-applying migrations to prove idempotency');
for (const file of SETUP) apply(file, { label: 'idempotency' });

// ── Concurrency: the rate limiter must hold under real parallel sessions ────
// An in-process SQL test cannot demonstrate this — the whole defect being fixed
// only appears when several CONNECTIONS race. pgbench ships with the Postgres
// image, so 10 clients hammer the same bucket and the total allowed must equal
// the quota exactly.
console.log('[db:test] concurrency: 50 parallel attempts against a quota of 5');
{
  const QUOTA = 5;
  const CLIENTS = 10;
  const PER_CLIENT = 5;

  const exec = (sql) =>
    docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-c', sql]);

  exec('CREATE TABLE IF NOT EXISTS _rl_results(allowed boolean);');
  exec("TRUNCATE _rl_results; DELETE FROM rate_limit_events WHERE bucket='burst';");

  const script = `INSERT INTO _rl_results SELECT public.consume_rate_limit('burst', 'one-user', 60, ${QUOTA});`;
  const write = docker([
    'exec',
    CONTAINER,
    'sh',
    '-c',
    `cat > /tmp/bench.sql <<'SQL'\n${script}\nSQL`,
  ]);
  if (write.status !== 0) fail(`could not write the pgbench script: ${write.stderr.trim()}`);

  const bench = docker([
    'exec',
    CONTAINER,
    'pgbench',
    '-U',
    'postgres',
    '-d',
    DB,
    '-n',
    '-c',
    String(CLIENTS),
    '-t',
    String(PER_CLIENT),
    '-f',
    '/tmp/bench.sql',
  ]);
  const attempts = CLIENTS * PER_CLIENT;
  if (!`${bench.stdout}${bench.stderr}`.includes(`processed: ${attempts}/${attempts}`)) {
    console.error(bench.stdout, bench.stderr);
    fail('pgbench did not complete every transaction');
  }

  const counts = exec(
    "SELECT count(*) FILTER (WHERE allowed) || ' ' || count(*) FILTER (WHERE NOT allowed) FROM _rl_results;"
  );
  const [allowed, denied] = counts.stdout.trim().split(/\s+/).map(Number);
  if (allowed !== QUOTA || denied !== attempts - QUOTA) {
    fail(
      `rate limiter is not atomic: ${allowed} allowed / ${denied} denied out of ${attempts} (expected ${QUOTA} / ${attempts - QUOTA})`
    );
  }
  console.log(`[db:test] PASS concurrency — ${allowed} allowed, ${denied} denied of ${attempts}`);
  passed++;
}

cleanup();
console.log(`\n[db:test] ${passed} SQL suite(s) passed, migrations idempotent.`);
