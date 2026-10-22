/**
 * Offline Mutation Queue
 * Queues failed sync operations for retry when back online
 * Works with the existing supabaseSync service
 */

import { logger } from '../utils/logger';
import { isTimeoutError, withTimeout } from '../utils/withTimeout';
import { BUSY, withSyncLock } from './syncLock';

// ── Types ────────────────────────────────────────────────────────────────────

export type MutationType =
  | 'template:create'
  | 'template:update'
  | 'template:delete'
  | 'session:create'
  | 'session:update'
  | 'session:delete'
  | 'exercise:create'
  | 'exercise:update'
  | 'exercise:delete'
  | 'bodyweight:create'
  | 'bodyweight:delete'
  | 'measurement:create'
  | 'measurement:delete'
  | 'record:create'
  | 'record:delete'
  | 'recovery:create'
  | 'recovery:delete'
  | 'nutrition:create'
  | 'nutrition:update'
  | 'nutrition:delete'
  | 'setting:update'
  | 'ai:create'
  | 'ai:update'
  | 'ai:delete'
  | 'water:create'
  | 'water:delete';

interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: unknown;
  // Owner of the mutation, stamped at enqueue time. processQueue drops entries
  // whose owner is not the currently signed-in user so a queued write can never
  // replay into another account on a shared device. Optional for backward
  // compat with rows written before this field existed (legacy rows are
  // treated as belonging to the current user).
  userId?: string;
  timestamp: number;
  // Monotonic sequence assigned at enqueue time. Two mutations enqueued within
  // the same millisecond share a timestamp, so timestamp alone cannot preserve
  // FIFO order (e.g. create -> delete -> update of one record). `seq` breaks
  // those ties deterministically. Optional for backward compat with rows
  // written before this field existed (they sort first, as the oldest).
  seq?: number;
  /** Failures that count toward MAX_RETRIES — the server answered and refused. */
  retryCount: number;
  /**
   * Failures that do NOT count: the server could not be reached or could not
   * answer (network, timeout, 5xx, 429). They only space the next attempt out.
   * Optional for rows written before it existed.
   */
  transientFailures?: number;
  /**
   * When this revision first failed to sync (ms epoch). Bounds how long a write
   * the server never answers keeps being retried (see MAX_UNREACHABLE_MS).
   * Optional for rows written before it existed.
   */
  firstFailedAt?: number;
  lastError?: string;
  // Earliest time this entry may be attempted again (ms epoch). Set on every
  // retriable failure using exponential backoff, so a failing entry no longer
  // burns one of its MAX_RETRIES attempts on every app open / 90s tick.
  nextAttemptAt?: number;
}

/**
 * A mutation that could not be synced and has stopped being retried. The
 * payload is PRESERVED: previously these rows were deleted outright, so a user
 * who opened the app offline five times silently lost the underlying change
 * with no way to recover it.
 */
export interface DeadLetterMutation extends QueuedMutation {
  /** When the entry was moved out of the active queue. */
  failedAt: number;
  /**
   * Why it stopped being retried. `unreachable`: the server did not answer it
   * for MAX_UNREACHABLE_MS — held so the user is told, instead of retrying
   * silently forever.
   */
  reason: 'max_retries' | 'permanent_error' | 'ownerless' | 'unreachable';
}

/**
 * Owner sentinels.
 *
 * A queued mutation with NO owner used to be replayed for whoever was signed in
 * at the time — so a change made in guest mode, or while the auth lookup was
 * failing, could be written into the next person's account on a shared device.
 * Ownership is now always recorded, and these two values mark the cases where
 * there is no account to attribute the change to. Replay quarantines them into
 * the dead-letter store, where the user can explicitly claim (retry) or discard
 * them.
 */
export const GUEST_OWNER = '__guest__';
export const UNKNOWN_OWNER = '__unknown__';

/** True when the entry has no real account behind it (incl. pre-ownership rows). */
function isOwnerless(userId: string | undefined): boolean {
  return !userId || userId === GUEST_OWNER || userId === UNKNOWN_OWNER;
}

const STORE_NAME = 'mutation_queue';
const DEAD_LETTER_STORE = 'dead_letter_queue';
/** Cross-tab lease store, read/written by services/syncLock.ts. */
const LEASE_STORE = 'sync_leases';
/**
 * Refusals (see `retryCount`) allowed before a change is moved to the held store.
 * Transient failures never count: an outage of any length used to use up these
 * five attempts in ~45 minutes and tell the user a change was not saved to the
 * cloud, for a write the server would have accepted the moment it came back.
 */
const MAX_RETRIES = 5;

/**
 * How long a write may keep failing only because the server cannot be reached
 * before it is moved to the held store. Transient failures never count toward
 * MAX_RETRIES, so without this cap a write the server never answers was retried
 * silently forever and nobody was ever told it had not been saved to the cloud.
 * Held is not lost: the payload is kept and Settings can retry or export it.
 */
const MAX_UNREACHABLE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ...and only after this many unanswered attempts in that time, so a write that
 * failed once, a week before the app was next opened, is tried again rather
 * than held on its second attempt.
 */
const MIN_UNREACHABLE_ATTEMPTS = MAX_RETRIES;

/** Backoff per consecutive failure (ms): 5s, 30s, 2m, 10m, then every 30m. */
const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000];

function backoffFor(failures: number): number {
  const index = Math.min(Math.max(failures - 1, 0), RETRY_BACKOFF_MS.length - 1);
  return RETRY_BACKOFF_MS[index] ?? 1_800_000;
}

/**
 * Longest a single replayed write may take. The base fetch timeout (25 s, see
 * lib/supabase.ts) covers the request itself; this also covers whatever runs
 * around it, so one stuck write can never hold the sync lock - and with it every
 * pull and push - indefinitely. A timed-out write stays queued (transient).
 */
const MUTATION_TIMEOUT_MS = 30_000;

/**
 * How long `queueMutation` waits for auth to name the owner. The lookup can run
 * a token refresh against a slow server; the enqueue must not wait that out.
 */
const OWNER_LOOKUP_TIMEOUT_MS = 2_000;

/** How long a queue pass waits for the signed-in user before deferring itself. */
const PASS_USER_LOOKUP_TIMEOUT_MS = 10_000;

/**
 * After this many transient failures IN A ROW, a pass stops and leaves the rest
 * for the next one: the server is not answering, and replaying every queued
 * write against it only adds load and holds the sync lock longer.
 */
const MAX_CONSECUTIVE_TRANSIENT_PER_PASS = 2;

/** True when the browser reports no connectivity. Conservative: unknown = online. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Status codes that indicate a permanent failure — never retry these.
// 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found,
// 413 Payload Too Large, 415 Unsupported Media Type, 422 Unprocessable Entity.
//
// 409 Conflict is deliberately NOT here. PostgREST answers 409 for a genuine
// unique violation (permanent) but also for a serialization/deadlock conflict,
// which is exactly the kind of failure that succeeds on the next attempt. The
// SQLSTATE check below tells the two apart; treating every 409 as permanent
// dead-lettered writes that would have gone through moments later.
//
// 413/415 are new here: they used to fall through to "retriable" and burn all
// five attempts plus ~45 minutes of backoff on a request that can never succeed.
const NON_RETRIABLE_STATUS = new Set<number>([400, 401, 403, 404, 413, 415, 422]);

/**
 * SQLSTATEs that are TRANSIENT despite being well-formed Postgres errors.
 *
 * The old rule was "any 5-character numeric code is permanent", which is wrong
 * for the whole 40xxx class. `40001` is a serialization failure and `40P01` a
 * deadlock — both are the database asking the caller to retry, and both are
 * reachable here because `sync_lww_guard` and `consume_rate_limit` take row locks.
 * Classing them as permanent sent a perfectly good write straight to the
 * dead-letter store, where it needed manual intervention from Settings.
 *
 * 53xxx (insufficient resources: out of memory, too many connections) and 57014
 * (statement cancelled / timeout) are capacity problems, not data problems.
 * 08xxx is a connection failure.
 */
const RETRIABLE_SQLSTATES = new Set<string>([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
  '57014', // query_canceled (statement timeout)
  '53000', // insufficient_resources
  '53100', // disk_full
  '53200', // out_of_memory
  '53300', // too_many_connections
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '57P01', // admin_shutdown (database restarting)
  '57P02', // crash_shutdown (database recovering from a crash)
  '57P03', // cannot_connect_now (database starting up)
]);

// ── Error classification ────────────────────────────────────────────────────

/**
 * Returns true if the error looks transient (network blip, 5xx, timeout).
 * Returns false for 4xx-ish errors that will never succeed on retry.
 * Default: treat unknown errors as retriable — we'd rather retry than
 * silently drop a user's data.
 *
 * Exported so syncEngine shares the same classification and can short-circuit
 * permanent errors instead of burning a full backoff cycle on them.
 */
export function isRetriableError(err: unknown): boolean {
  if (err == null) return true;
  // Checked first: some transient failures carry a PGRST code that the generic
  // "PGRST... is permanent" rule below would otherwise dead-letter.
  if (isTransientError(err)) return true;

  const anyErr = err as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };

  // Supabase PostgREST errors expose .status on the response; some wrappers
  // expose .statusCode, and gateway bodies name it in .code. Check all three.
  const status = httpStatusOf(anyErr);

  // PostgREST returns string .code values like '23505' (unique violation),
  // 'PGRST301' (RLS), '42P01' (missing table). Most are permanent.
  //
  // This is checked BEFORE the HTTP status on purpose: the SQLSTATE is the more
  // specific signal. A 409 carrying '40001' is a serialization conflict the
  // database wants us to retry, while a 409 carrying '23505' is a real duplicate.
  // Reading only the status could not distinguish them.
  const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
  if (code) {
    if (RETRIABLE_SQLSTATES.has(code)) return true;
    // Classes 40 (serialization/deadlock), 08 (connection) and 53 (resources) are
    // transient as a class; anything else in them is safer retried than discarded.
    if (/^(40|08|53)[0-9A-Z]{3}$/.test(code)) return true;
    if (code.startsWith('PGRST')) return false;
    // Any other SQLSTATE is permanent for our write paths — bad data, constraint
    // violations, missing schema. Note the character class: a SQLSTATE is five
    // alphanumerics, NOT five digits. Matching only `\d{5}` let every lettered
    // code (22P02 invalid-text-representation, 42P01 undefined-table, 23P01
    // exclusion-violation) fall through to the "unknown → retriable" default, so
    // the queue retried them five times and waited ~45 minutes before finally
    // holding a write that could never have succeeded.
    if (/^[0-9A-Z]{5}$/.test(code)) return false;
  }

  if (typeof status === 'number') {
    if (NON_RETRIABLE_STATUS.has(status)) return false;
    // 409 without a recognised SQLSTATE: assume a real conflict rather than
    // retrying forever against a constraint that will not change.
    if (status === 409) return false;
    // 429 and 5xx and anything else → retriable
    return true;
  }

  // Network-ish errors: fetch failure, timeout, aborted request → retriable.
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  if (
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /failed to fetch|network|timeout|fetch failed/i.test(message)
  ) {
    return true;
  }

  // Unknown shape — default to retriable so we don't lose data on a transient
  // error we didn't recognize.
  return true;
}

/**
 * PostgREST codes that mean "not now", never "not this write".
 *
 * PGRST000-003 are the database being unreachable or out of pooled connections
 * - exactly what an overloaded instance answers (PGRST003 is a 504 "timed out
 * acquiring connection from connection pool"). They used to fall under the
 * blanket "PGRST... is permanent" rule and sent good writes straight to the held
 * store. PGRST303 is an expired access token: the session refreshes and the same
 * write then succeeds.
 */
const TRANSIENT_POSTGREST_CODES = new Set<string>([
  'PGRST000',
  'PGRST001',
  'PGRST002',
  'PGRST003',
  'PGRST303',
]);

/**
 * How a failed request reads once postgrest-js has wrapped it: browser network
 * errors (Chrome "Failed to fetch", Safari "Load failed", Firefox
 * "NetworkError..."), our fetch timeout, and what the gateways in front of the
 * database answer when it is overloaded — plain-text pages (502/503/504,
 * Cloudflare 52x) and JSON bodies with no code (Kong "An invalid response was
 * received from the upstream server", Envoy "upstream connect error ... reset",
 * "connection terminated", "too many connections"). postgrest-js hands such a
 * body back as the error itself, WITHOUT the HTTP status, so the words are all
 * there is to go on. Only consulted when the error carries no code.
 */
const TRANSIENT_MESSAGE =
  /failed to fetch|load failed|networkerror|network ?error|network request failed|fetch failed|session could not be refreshed|token refresh is backing off|timeout|timed out|time-out|did not answer|gateway|upstream|temporarily|unavailable|overloaded|rate limit|too many (connections|requests|clients)|remaining connection slots|connection (reset|refused|terminated|closed|lost|failure|timed out)|econnreset|econnrefused|etimedout|server closed the connection|terminating connection|could not connect|error code: 52\d|jwt expired|^(AbortError|TimeoutError):/i;

/** A 3-digit HTTP status written as a string — never a SQLSTATE (5) or a PGRST code. */
const HTTP_STATUS_TEXT = /^[1-5]\d\d$/;

interface ErrorShape {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
  error?: unknown;
}

/**
 * The HTTP status, wherever a wrapper put it: `status` / `statusCode`, or a
 * gateway body that names it in `code` (`{"code":503,"message":...}`), as a
 * number or as a string.
 */
function httpStatusOf(e: ErrorShape): number | undefined {
  for (const value of [e.status, e.statusCode, e.code]) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) {
      return value;
    }
    if (typeof value === 'string' && HTTP_STATUS_TEXT.test(value)) return Number(value);
  }
  return undefined;
}

/**
 * True when a failure says nothing about the write itself - the server could not
 * be reached or could not answer in time. Such a failure is retried with backoff
 * but NEVER counts toward MAX_RETRIES, so an outage of any length cannot turn a
 * good write into a held one. A failure with a SQLSTATE / PostgREST code is
 * judged by that code alone, so validation and RLS refusals (22xxx, 23xxx,
 * 42501, PGRST1xx/2xx) stay permanent whatever their message says.
 */
export function isTransientError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as ErrorShape;
  const message = typeof e.message === 'string' ? e.message : '';

  const rawCode = typeof e.code === 'string' ? e.code : '';
  const code = HTTP_STATUS_TEXT.test(rawCode) ? '' : rawCode;
  if (code) {
    if (TRANSIENT_POSTGREST_CODES.has(code)) return true;
    // Older PostgREST answered an expired token with PGRST301.
    if (code === 'PGRST301') return /jwt expired/i.test(message);
    if (RETRIABLE_SQLSTATES.has(code)) return true;
    return /^(40|08|53)[0-9A-Z]{3}$/.test(code);
  }

  const status = httpStatusOf(e);
  if (status !== undefined) {
    return status >= 500 || status === 429 || status === 408;
  }

  const name = typeof e.name === 'string' ? e.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  // Some gateways word the failure in `error` rather than `message`.
  const text = typeof e.error === 'string' ? `${message} ${e.error}` : message;
  return TRANSIENT_MESSAGE.test(text);
}

// ── IndexedDB helpers ───────────────────────────────────────────────────────

let queueDbInstance: IDBDatabase | null = null;
let queueDbOpenPromise: Promise<IDBDatabase> | null = null;

function openQueueDB(): Promise<IDBDatabase> {
  if (queueDbInstance) return Promise.resolve(queueDbInstance);
  if (queueDbOpenPromise) return queueDbOpenPromise;

  queueDbOpenPromise = new Promise((resolve, reject) => {
    // v2 added the dead-letter store; v3 added the cross-tab lease store.
    const request = indexedDB.open('SparkOS_Queue', 3);
    request.onerror = () => {
      queueDbOpenPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      queueDbInstance = request.result;
      queueDbOpenPromise = null;
      queueDbInstance.onversionchange = () => {
        queueDbInstance?.close();
        queueDbInstance = null;
      };
      queueDbInstance.onclose = () => {
        queueDbInstance = null;
      };
      resolve(queueDbInstance);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
        const dead = db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
        dead.createIndex('failedAt', 'failedAt', { unique: false });
      }
      // v3: cross-tab lease store used by services/syncLock.ts when the Web
      // Locks API is unavailable (Safari < 15.4). Lives in this database because
      // the queue is already the durable home of sync coordination state.
      if (!db.objectStoreNames.contains(LEASE_STORE)) {
        db.createObjectStore(LEASE_STORE, { keyPath: 'name' });
      }
    };
  });
  return queueDbOpenPromise;
}

// Monotonic sequence generator. Seeded from Date.now() and forced to strictly
// increase, so values are unique and ordered even when many mutations are
// enqueued within the same millisecond, and remain larger than any previously
// persisted seq across reloads (wall-clock only moves forward). Same ms scale
// as `timestamp`, so the two are directly comparable when sorting.
let lastSeq = 0;
function nextSeq(): number {
  lastSeq = Math.max(lastSeq + 1, Date.now());
  return lastSeq;
}

async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await openQueueDB();
  const mutations = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  });
  // Order by monotonic seq so create -> delete -> update FIFO holds even when
  // timestamps collide. Legacy rows without `seq` fall back to `timestamp`
  // (same scale) and sort as the oldest entries.
  return mutations.sort((a, b) => (a.seq ?? a.timestamp) - (b.seq ?? b.timestamp));
}

/** True while a row with this id is still in the active queue. */
async function isStillQueued(id: string): Promise<boolean> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count(id);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

async function putMutation(mutation: QueuedMutation): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(mutation);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteMutation(id: string): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a queue row ONLY if it still holds the revision we replayed.
 *
 * The race this closes, which the plain `deleteMutation` above lost:
 * `queueMutation` DEDUPS by `type::recordId` and REUSES the existing row id, so
 * a second edit to the same record overwrites the queued row in place with a new
 * payload and a new `seq`. Replay meanwhile holds a SNAPSHOT taken before its
 * `await syncFn()`. Sequence:
 *
 *   1. replay picks up `session:update(s)` revision A and awaits the network
 *   2. the user edits session `s` again; its direct write fails, so
 *      `queueMutation` replaces that same row with revision B
 *   3. A's request succeeds and replay deletes the row by id
 *
 * Revision B is now gone from the queue and was never sent anywhere. The
 * mirror-image case is a retriable failure, where `putMutation` wrote snapshot A
 * back over B. Comparing `seq` inside the transaction makes both cases leave the
 * newer revision pending instead, so the next pass picks it up.
 *
 * @returns true when the row was deleted, false when a newer revision was found
 *          and deliberately left in place.
 */
async function deleteMutationIfUnchanged(id: string, expectedSeq?: number): Promise<boolean> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    let deleted = false;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const read = store.get(id);
    read.onsuccess = () => {
      const current = read.result as QueuedMutation | undefined;
      if (!current) {
        // Already gone (another pass, or an explicit discard). Nothing to do.
        deleted = true;
        return;
      }
      if (current.seq !== expectedSeq) return; // superseded — keep the newer one
      store.delete(id);
      deleted = true;
    };
    tx.oncomplete = () => resolve(deleted);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Write back a retried mutation ONLY if the stored row is still the revision we
 * replayed — otherwise the newer revision from `queueMutation` would be
 * overwritten by our stale snapshot. See `deleteMutationIfUnchanged`.
 */
async function putMutationIfUnchanged(
  mutation: QueuedMutation,
  expectedSeq?: number
): Promise<boolean> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    let written = false;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const read = store.get(mutation.id);
    read.onsuccess = () => {
      const current = read.result as QueuedMutation | undefined;
      // Absent means it was superseded-then-removed; re-adding a stale snapshot
      // would resurrect an old payload, so do nothing.
      if (!current || current.seq !== expectedSeq) return;
      store.put(mutation);
      written = true;
    };
    tx.oncomplete = () => resolve(written);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function clearQueue(): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Dead-letter helpers ─────────────────────────────────────────────────────

/**
 * Move a mutation out of the active queue into the dead-letter store in ONE
 * transaction, so a crash can never drop the payload without recording it.
 *
 * Only when the queue row is STILL THERE, at the revision that was replayed —
 * read and write in the same transaction:
 *   - Gone: the queue was cleared under the pass. Sign-out gives up waiting for
 *     a flush after a few seconds and wipes the stores, but the abandoned pass
 *     keeps running; an unconditional put let a 401 that arrived afterwards
 *     write the PREVIOUS user's change back into the held store.
 *   - A newer revision: the user edited the record while it was replaying, so
 *     the newer payload stays queued (see deleteMutationIfUnchanged) instead of
 *     being deleted and replaced by the stale snapshot.
 *
 * @returns true when the row was moved.
 */
async function moveToDeadLetter(
  mutation: QueuedMutation,
  reason: DeadLetterMutation['reason']
): Promise<boolean> {
  const db = await openQueueDB();
  const entry: DeadLetterMutation = { ...mutation, failedAt: Date.now(), reason };
  return new Promise((resolve, reject) => {
    let moved = false;
    const tx = db.transaction([STORE_NAME, DEAD_LETTER_STORE], 'readwrite');
    const queue = tx.objectStore(STORE_NAME);
    const read = queue.get(mutation.id);
    read.onsuccess = () => {
      const current = read.result as QueuedMutation | undefined;
      if (!current || current.seq !== mutation.seq) return;
      tx.objectStore(DEAD_LETTER_STORE).put(entry);
      queue.delete(mutation.id);
      moved = true;
    };
    tx.oncomplete = () => resolve(moved);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAllDeadLetters(): Promise<DeadLetterMutation[]> {
  const db = await openQueueDB();
  const rows = await new Promise<DeadLetterMutation[]>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readonly');
    const req = tx.objectStore(DEAD_LETTER_STORE).getAll();
    req.onsuccess = () => resolve(req.result as DeadLetterMutation[]);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => b.failedAt - a.failedAt);
}

async function clearDeadLetterStore(): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Sync logic ─────────────────────────────────────────────────────────────

// Lazy-load supabaseSync once and cache the resolved module, rather than
// calling import() for every queued mutation processed.
let supabaseSyncModulePromise: Promise<typeof import('./supabaseSync')> | null = null;
const loadSupabaseSync = (): Promise<typeof import('./supabaseSync')> => {
  if (!supabaseSyncModulePromise) {
    supabaseSyncModulePromise = import('./supabaseSync');
  }
  return supabaseSyncModulePromise;
};

async function getSyncFn(type: MutationType, payload: unknown, userId: string) {
  const {
    syncWorkoutTemplate,
    deleteCloudWorkoutTemplate,
    syncWorkoutSession,
    deleteCloudWorkoutSession,
    syncPersonalExercise,
    deleteCloudPersonalExercise,
    syncBodyWeight,
    deleteCloudBodyWeight,
    syncBodyMeasurement,
    deleteCloudBodyMeasurement,
    syncPersonalRecord,
    deleteCloudPersonalRecord,
    syncRecoveryLog,
    deleteCloudRecoveryLog,
    syncNutritionLog,
    deleteCloudNutritionLog,
    syncUserSetting,
    syncAIConversation,
    softDeleteCloudAIConversation,
  } = await loadSupabaseSync();

  switch (type) {
    case 'template:create':
    case 'template:update':
      return () =>
        syncWorkoutTemplate(userId, payload as Parameters<typeof syncWorkoutTemplate>[1]);
    case 'template:delete':
      return () => deleteCloudWorkoutTemplate(userId, payload as string);
    case 'session:create':
    case 'session:update':
      return () => syncWorkoutSession(userId, payload as Parameters<typeof syncWorkoutSession>[1]);
    case 'session:delete':
      return () => deleteCloudWorkoutSession(userId, payload as string);
    case 'exercise:create':
    case 'exercise:update':
      return () =>
        syncPersonalExercise(userId, payload as Parameters<typeof syncPersonalExercise>[1]);
    case 'exercise:delete':
      return () => deleteCloudPersonalExercise(userId, payload as string);
    case 'bodyweight:create':
      return () => syncBodyWeight(userId, payload as Parameters<typeof syncBodyWeight>[1]);
    case 'bodyweight:delete':
      return () => deleteCloudBodyWeight(userId, payload as string);
    case 'measurement:create':
      return () =>
        syncBodyMeasurement(userId, payload as Parameters<typeof syncBodyMeasurement>[1]);
    case 'measurement:delete':
      return () => deleteCloudBodyMeasurement(userId, payload as string);
    case 'record:create':
      return () => syncPersonalRecord(userId, payload as Parameters<typeof syncPersonalRecord>[1]);
    case 'record:delete':
      return () => deleteCloudPersonalRecord(userId, payload as string);
    case 'recovery:create':
      return () => syncRecoveryLog(userId, payload as Parameters<typeof syncRecoveryLog>[1]);
    case 'recovery:delete':
      return () => deleteCloudRecoveryLog(userId, payload as string);
    case 'nutrition:create':
    case 'nutrition:update':
      return () => syncNutritionLog(userId, payload as Parameters<typeof syncNutritionLog>[1]);
    case 'nutrition:delete':
      return () => deleteCloudNutritionLog(userId, payload as string);
    case 'setting:update':
      return () => syncUserSetting(userId, payload as Parameters<typeof syncUserSetting>[1]);
    case 'ai:create':
    case 'ai:update':
      return () => syncAIConversation(userId, payload as Parameters<typeof syncAIConversation>[1]);
    case 'ai:delete':
      // Soft-delete so the tombstone propagates (mirrors deleteConversation).
      return () => softDeleteCloudAIConversation(userId, payload as string);
    case 'water:create':
      return async () => {
        const { syncWaterEntryToCloud } = await import('./waterService');
        await syncWaterEntryToCloud(
          userId,
          payload as { id: string; date: string; amountMl: number; createdAt: string }
        );
      };
    case 'water:delete':
      return async () => {
        const { deleteCloudWaterEntry } = await import('./waterService');
        await deleteCloudWaterEntry(userId, payload as string);
      };
    default:
      return null;
  }
}

// ── Dedup helpers ───────────────────────────────────────────────────────────

/**
 * Extract the underlying record id from a mutation payload.
 * - For delete mutations the payload is already the id (a string).
 * - For create/update mutations the payload is an object with an `id` field.
 * - 'setting:update' uses a `key` rather than a per-record id, so we key on
 *   that. We skip dedup for payload shapes we don't recognize rather than
 *   guess — returning null signals "leave this alone".
 */
function getRecordId(type: MutationType, payload: unknown): string | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as { id?: unknown; key?: unknown };
    if (type === 'setting:update') {
      if (typeof obj.key === 'string' && obj.key.length > 0) return obj.key;
      if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id;
      return null;
    }
    if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id;
  }
  return null;
}

/** Compose an in-memory dedup key from mutation type + record id. */
function getDedupKey(type: MutationType, payload: unknown): string | null {
  const recordId = getRecordId(type, payload);
  if (!recordId) return null;
  return `${type}::${recordId}`;
}

/**
 * The IndexedDB store a mutation type writes to, for the seven stores that carry
 * unsynced-ledger markers.
 *
 * `null` for everything else, and that is deliberate rather than an omission:
 * personal records, personal exercises, AI conversations and mirrored settings
 * are marker-less by design, because none of them has a clear-on-pull path — a
 * marker there would stick forever and turn the sign-out warning into noise.
 */
function markerStoreFor(type: MutationType): string | null {
  switch (type) {
    case 'session:create':
    case 'session:update':
    case 'session:delete':
      return 'workout_sessions';
    case 'template:create':
    case 'template:update':
    case 'template:delete':
      return 'workout_templates';
    case 'nutrition:create':
    case 'nutrition:update':
    case 'nutrition:delete':
      return 'nutrition_logs';
    case 'bodyweight:create':
    case 'bodyweight:delete':
      return 'body_weight';
    case 'measurement:create':
    case 'measurement:delete':
      return 'body_measurements';
    case 'recovery:create':
    case 'recovery:delete':
      return 'recovery_logs';
    case 'water:create':
    case 'water:delete':
      return 'water_logs';
    default:
      return null;
  }
}

/**
 * Drop the unsynced-ledger marker for a mutation the cloud has just confirmed.
 *
 * Imported lazily because `sessionDb` imports `queueMutation` from here; a static
 * import would close the cycle. Best-effort by design — a stale marker is a false
 * warning, so it must never fail a replay that actually succeeded.
 */
async function clearMarkerForMutation(type: MutationType, payload: unknown): Promise<void> {
  const store = markerStoreFor(type);
  if (!store) return;
  const recordId = getRecordId(type, payload);
  if (!recordId) return;
  try {
    const { clearUnsyncedRecordMarker } = await import('./sessionDb');
    await clearUnsyncedRecordMarker(store, recordId);
  } catch (err) {
    logger.sync.warn('Could not clear the unsynced marker for a confirmed mutation', {
      type,
      recordId,
      err,
    });
  }
}

// ── Ownership ───────────────────────────────────────────────────────────────

/** The account signed in on this device according to its stored session - no network. */
async function storedSessionUserId(): Promise<string | null> {
  try {
    const { readStoredAuthSession } = await import('../lib/supabase');
    return readStoredAuthSession()?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Who owns a mutation being queued now. Capped at OWNER_LOOKUP_TIMEOUT_MS: the
 * auth lookup can sit behind a token refresh against a slow server, and the
 * enqueue - often the only thing standing between a write and its loss - must
 * not wait on it.
 *
 * Whenever auth does not NAME a user, the session stored on this device does:
 * it is the account signed in here right now, read without the network, so it
 * is not a guess. That covers a timeout, a rejection, and — the case that cost
 * data — a plain "no user": `getCurrentUser()` answers null for about a minute
 * after a failed token refresh (supabaseAuth's refresh cooldown) while the
 * session is still stored. Stamping GUEST_OWNER there sent the change to
 * quarantine on replay, and a quarantined DELETE meant the next pull brought
 * the deleted workout back. Only with nothing stored is the entry GUEST_OWNER
 * (auth said nobody is signed in) or UNKNOWN_OWNER (auth could not answer).
 *
 * Exported for callers that queue many writes at once (an import): resolve the
 * owner once and pass it as `ownerId`, instead of one lookup per write.
 */
export async function resolveQueueOwner(): Promise<string> {
  let authAnswered = false;
  try {
    const { getCurrentUser } = await import('./supabaseAuth');
    const user = await withTimeout(getCurrentUser(), OWNER_LOOKUP_TIMEOUT_MS, 'queue owner lookup');
    if (user?.id) return user.id;
    authAnswered = true;
  } catch (err) {
    if (!isTimeoutError(err)) logger.sync.warn('Queue owner lookup failed', err);
  }
  const stored = await storedSessionUserId();
  if (stored) return stored;
  // Auth said "signed out" → a guest's change, adopted on a first sign-in.
  // Auth could not answer → kept, but quarantined on replay instead of guessed.
  return authAnswered ? GUEST_OWNER : UNKNOWN_OWNER;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Queue a mutation for background sync
 * Call this when a local write succeeds but cloud sync fails
 *
 * Dedup: if an existing queued mutation targets the same record (same type +
 * same record id), we reuse its queue id so the new payload overwrites the
 * old one. This keeps the queue small when the user edits the same record
 * multiple times while offline. We dedup in memory only — the on-disk schema
 * is unchanged.
 */
export interface QueueMutationOptions {
  /**
   * The account the change was made under, when the caller captured it at the
   * moment of the write. Use it when the enqueue runs LATER than the write (a
   * background hand-off): by then a sign-out or account switch may have changed
   * who auth answers with, and the change must stay owned by whoever made it.
   */
  ownerId?: string;
}

export async function queueMutation(
  type: MutationType,
  payload: unknown,
  options: QueueMutationOptions = {}
): Promise<void> {
  const dedupKey = getDedupKey(type, payload);

  // Stamp the owner so the entry can never replay into another account on a
  // shared device. Ownership is ALWAYS recorded — including the two "no real
  // owner" cases — because an entry with no owner used to be adopted by whoever
  // happened to be signed in at replay time, which silently wrote one person's
  // data into another person's account.
  const userId = options.ownerId || (await resolveQueueOwner());
  // A delete makes every pending create/update of the same record obsolete.
  const obsolete = obsoletedByDelete(type, payload);

  const db = await openQueueDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let queueId: string = crypto.randomUUID();
    let superseded = 0;

    function doPut() {
      store.put({
        id: queueId,
        type,
        payload,
        userId,
        timestamp: Date.now(),
        seq: nextSeq(),
        retryCount: 0,
      } as QueuedMutation);
    }

    if (dedupKey) {
      const idx = store.index('timestamp');
      const cursorReq = idx.openCursor();
      let matched = false;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          doPut();
          return;
        }
        const m = cursor.value as QueuedMutation;
        if (!matched && getDedupKey(m.type, m.payload) === dedupKey) {
          queueId = m.id;
          matched = true;
          // Only a delete needs the rest of the queue; anything else is done.
          if (!obsolete) {
            doPut();
            return;
          }
        } else if (
          obsolete?.types.has(m.type) &&
          getRecordId(m.type, m.payload) === obsolete.recordId
        ) {
          // Same transaction as the delete's own put, so there is never a moment
          // in which both are queued. Left in place, an older update parked by
          // outage backoff replayed AFTER the delete — which had matched 0 rows —
          // and its upsert inserted the record live: the delete resurrected it.
          cursor.delete();
          superseded++;
        }
        cursor.continue();
      };
      cursorReq.onerror = () => doPut();
    } else {
      doPut();
    }

    tx.oncomplete = () => {
      logger.sync.info('Queued offline mutation', {
        type,
        id: queueId,
        ...(superseded > 0 ? { supersededWrites: superseded } : {}),
      });
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Drop the pending create/update writes a delete makes obsolete, for a delete
 * that is pushed DIRECTLY rather than queued (syncEngine.syncWithRetry). A
 * delete that reaches the cloud at once never enters the queue, so without
 * this an older update parked there by outage backoff still replayed after it
 * and brought the record back. Returns how many were dropped.
 */
export async function discardWritesObsoletedBy(
  type: MutationType,
  payload: unknown
): Promise<number> {
  const obsolete = obsoletedByDelete(type, payload);
  if (!obsolete) return 0;
  const db = await openQueueDB();
  return new Promise<number>((resolve, reject) => {
    let dropped = 0;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const cursorReq = tx.objectStore(STORE_NAME).openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const m = cursor.value as QueuedMutation;
      if (obsolete.types.has(m.type) && getRecordId(m.type, m.payload) === obsolete.recordId) {
        cursor.delete();
        dropped++;
      }
      cursor.continue();
    };
    tx.oncomplete = () => {
      if (dropped > 0)
        logger.sync.info('Dropped writes made obsolete by a delete', { type, dropped });
      resolve(dropped);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * For `<entity>:delete` of one record, the pending writes of that record it makes
 * obsolete: `<entity>:create` and `<entity>:update`. Generic over every entity
 * that follows the naming (templates, sessions, exercises, body weight,
 * measurements, records, recovery, nutrition, AI conversations, water).
 */
function obsoletedByDelete(
  type: MutationType,
  payload: unknown
): { types: ReadonlySet<string>; recordId: string } | null {
  if (!type.endsWith(':delete')) return null;
  const recordId = getRecordId(type, payload);
  if (!recordId) return null;
  const entity = type.slice(0, -':delete'.length);
  return { types: new Set([`${entity}:create`, `${entity}:update`]), recordId };
}

// ── User-facing feedback ─────────────────────────────────────────────────────

// Lazy-load the toast module so this pure service never pulls the React/
// framer-motion GlobalToast component into its own (potentially worker/early
// boot) import graph. Matches the lazy-import style already used here for
// supabaseSync / waterService, and sidesteps any future circular-import risk.
async function notify(text: string, variant: 'error' | 'info'): Promise<void> {
  try {
    const { showToast } = await import('../components/ui/GlobalToast');
    showToast(text, variant);
  } catch {
    // Toast unavailable (e.g. container not mounted yet) — never let feedback
    // failures break queue processing.
  }
}

// True while a retriable-failure episode is ongoing. The "some changes didn't
// sync" toast fires once per episode instead of on every 90s periodic pass;
// the flag resets when a pass completes with no failures (queue drained or
// the retries finally succeeded), so a NEW episode toasts again.
let retriableFailureNotified = false;

/**
 * Debounced user-facing notice for retriable sync failures. Shared by the
 * startup / back-online / periodic queue passes. Exported for tests.
 */
export async function notifyRetriableFailures(): Promise<void> {
  if (retriableFailureNotified) return;
  retriableFailureNotified = true;
  await notify('חלק מהשינויים לא הסתנכרנו — ננסה שוב אוטומטית', 'error');
}

// ── Queue processing guard ──────────────────────────────────────────────────
// `isProcessing` only serialises calls inside THIS tab. Cross-tab exclusion
// comes from withSyncLock (services/syncLock.ts): two tabs replaying the same
// mutation would double-count retries and make ordering non-deterministic.
let isProcessing = false;

/**
 * Process all queued mutations.
 * Call on app start and when coming back online.
 *
 * Resolves with zeros when another tab holds the sync lock — sync is periodic
 * and idempotent, so standing down is correct and the next tick will retry.
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  if (isProcessing) return { success: 0, failed: 0 };
  isProcessing = true;
  try {
    const outcome = await withSyncLock(() => processQueueInternal());
    if (outcome === BUSY) {
      logger.sync.info('Another tab is syncing, skipping queue pass');
      return { success: 0, failed: 0 };
    }
    return outcome;
  } finally {
    isProcessing = false;
  }
}

async function processQueueInternal(): Promise<{ success: number; failed: number }> {
  // Offline guard. Previously only the 90s timer checked connectivity, while
  // initOfflineSync() called processQueue() immediately on every app start. Each
  // offline start therefore burned one of MAX_RETRIES, so opening the app five
  // times without a network connection DELETED the queued workout.
  if (isOffline()) {
    logger.sync.info('Offline, deferring queue processing');
    return { success: 0, failed: 0 };
  }

  const { getCurrentUser } = await import('./supabaseAuth');
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    // Capped: the pass holds the sync lock, and a lookup stuck behind a token
    // refresh would hold it - and every pull and push - for as long as that takes.
    user = await withTimeout(getCurrentUser(), PASS_USER_LOOKUP_TIMEOUT_MS, 'queue user lookup');
  } catch (err) {
    logger.sync.warn('Could not resolve the signed-in user; deferring the queue pass', err);
    return { success: 0, failed: 0 };
  }
  if (!user?.id) {
    logger.sync.info('Not authenticated, skipping queue processing');
    return { success: 0, failed: 0 };
  }

  const mutations = await getAllMutations();
  if (mutations.length === 0) {
    // Empty queue — any failure episode is over.
    retriableFailureNotified = false;
    return { success: 0, failed: 0 };
  }

  logger.sync.info(`Processing ${mutations.length} queued mutations`);

  let success = 0;
  let failed = 0;
  // Number of mutations permanently dropped in this pass (4xx or max retries).
  // Reported as a single, correctly-pluralized toast per run so a burst of
  // drops can't spam the user.
  let droppedCount = 0;
  // Ownerless entries moved to quarantine in this pass. Reported separately: the
  // user has to decide whether to claim them, so the message must not read like a
  // sync failure.
  let quarantinedCount = 0;

  // Track dedup keys we've already successfully synced in this pass. If a
  // later queued entry targets the same record we can drop it — the latest
  // writable state for that record is already up.
  const processedKeys = new Set<string>();

  // Transient failures in a row in THIS pass - see MAX_CONSECUTIVE_TRANSIENT_PER_PASS.
  let consecutiveTransient = 0;

  // Writes that only an outage has delayed (never refused, just unreachable)
  // and that are still inside their backoff. Once any write goes through in
  // this pass the server is evidently back, so they are appended to the pass
  // instead of waiting out a backoff of up to 30 minutes.
  const delayedByOutage: QueuedMutation[] = [];
  const backoffWaived = new Set<string>();
  const order: QueuedMutation[] = [...mutations];
  // Set by the first write that goes through: from then on an outage-delayed
  // write later in the list is attempted right away, not parked again.
  let serverAnswered = false;

  for (let index = 0; index < order.length; index++) {
    const mutation = order[index];
    if (!mutation) continue;
    if (consecutiveTransient >= MAX_CONSECUTIVE_TRANSIENT_PER_PASS) {
      logger.sync.info('Server not answering; leaving the rest of the queue for the next pass', {
        remaining: order.length - index,
      });
      break;
    }

    // Respect the backoff window so a persistently failing entry is not retried
    // (and charged an attempt) on every tick.
    if (
      mutation.nextAttemptAt &&
      mutation.nextAttemptAt > Date.now() &&
      !backoffWaived.has(mutation.id) &&
      !(serverAnswered && isDelayedOnlyByOutage(mutation))
    ) {
      if (isDelayedOnlyByOutage(mutation)) delayedByOutage.push(mutation);
      continue;
    }

    // Cross-account guard. An entry with a DIFFERENT owner is dropped: it can
    // never legitimately replay here. An entry with NO owner (guest mode, a
    // failed auth lookup, or a row written before ownership existed) is
    // QUARANTINED rather than adopted — adopting it silently wrote one person's
    // change into another person's account on a shared device.
    if (isOwnerless(mutation.userId)) {
      logger.sync.warn('Quarantining ownerless queued mutation', {
        type: mutation.type,
        id: mutation.id,
        owner: mutation.userId ?? 'legacy',
      });
      if (await moveToDeadLetter(mutation, 'ownerless')) quarantinedCount++;
      continue;
    }
    if (mutation.userId !== user.id) {
      logger.sync.warn('Dropping queued mutation owned by another user', {
        type: mutation.type,
        id: mutation.id,
      });
      await deleteMutation(mutation.id);
      continue;
    }

    const dedupKey = getDedupKey(mutation.type, mutation.payload);
    if (dedupKey && processedKeys.has(dedupKey)) {
      logger.sync.info('Skipping already-synced record in this pass', {
        type: mutation.type,
        id: mutation.id,
      });
      await deleteMutation(mutation.id);
      continue;
    }

    // The list this pass works through is a snapshot, and a write can leave the
    // queue under it — above all, a delete queued since then removes the
    // record's pending create/update (see queueMutation). Replaying that removed
    // write would undo the delete.
    if (!(await isStillQueued(mutation.id))) {
      logger.sync.info('Queued mutation was removed during the pass; not replaying it', {
        type: mutation.type,
        id: mutation.id,
      });
      continue;
    }

    const syncFn = await getSyncFn(mutation.type, mutation.payload, user.id);
    if (!syncFn) {
      logger.sync.warn('Unknown mutation type, dropping', { type: mutation.type });
      await deleteMutation(mutation.id);
      continue;
    }

    try {
      await withTimeout(syncFn(), MUTATION_TIMEOUT_MS, `queued ${mutation.type}`);
      consecutiveTransient = 0;
      // The cloud has CONFIRMED this record, so the unsynced-ledger marker its
      // write path left behind must go. Nothing used to clear a marker on the
      // REPLAY path — only a same-call sync success, a local delete or a cloud
      // pull did, and the pull only covers three of the seven ledgered stores.
      // So "log a meal offline → queue replays fine" left a marker that
      // `getUnsyncedRecords` kept counting forever (the row IS live, so it is not
      // pruned as stale), and the sign-out dialog and the offline indicator
      // warned about data that was safely in the cloud, with no user action able
      // to clear it. This is the single point of leverage: one call site covers
      // all seven stores and the replay path the merges cannot see.
      await clearMarkerForMutation(mutation.type, mutation.payload);
      // Revision-guarded: if the user re-edited this record while the request was
      // in flight, `queueMutation` has already replaced this row with a newer
      // payload under the SAME id. Deleting by id would silently discard that
      // never-sent revision. See deleteMutationIfUnchanged.
      const removed = await deleteMutationIfUnchanged(mutation.id, mutation.seq);
      if (removed) {
        // Only claim the record is up to date when nothing newer is queued for it,
        // otherwise a later entry for the same record would be dropped as a
        // duplicate before it was ever sent.
        if (dedupKey) processedKeys.add(dedupKey);
      } else {
        logger.sync.info('Mutation superseded while syncing; keeping newer revision queued', {
          type: mutation.type,
          id: mutation.id,
        });
      }
      success++;
      serverAnswered = true;
      logger.sync.info('Synced queued mutation', { type: mutation.type, id: mutation.id });
      if (delayedByOutage.length > 0) {
        const resumed = delayedByOutage.splice(0);
        for (const delayed of resumed) backoffWaived.add(delayed.id);
        order.push(...resumed);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Permanent failure → stop retrying, but KEEP the payload.
      if (!isRetriableError(err)) {
        logger.sync.error('Non-retriable error, moving mutation to dead letter', {
          type: mutation.type,
          id: mutation.id,
          error: errMsg,
        });
        consecutiveTransient = 0;
        if (await moveToDeadLetter({ ...mutation, lastError: errMsg }, 'permanent_error')) {
          droppedCount++;
        }
        failed++;
        continue;
      }

      // Transient (unreachable / timed out / 5xx / 429): back off, but do not
      // count it - only an answer from the server that REFUSES the write may
      // eventually hold it. Anything retriable but unrecognised still counts, as
      // before, so a write that can never succeed is held in the end.
      const transient = isTransientError(err);
      consecutiveTransient = transient ? consecutiveTransient + 1 : 0;
      const retryCount = transient ? mutation.retryCount : mutation.retryCount + 1;
      const transientFailures = (mutation.transientFailures ?? 0) + (transient ? 1 : 0);
      const now = Date.now();
      const retried: QueuedMutation = {
        ...mutation,
        retryCount,
        transientFailures,
        firstFailedAt: firstFailureOf(mutation, now),
        lastError: errMsg,
        nextAttemptAt: now + backoffFor(retryCount + transientFailures),
      };

      if (retried.retryCount >= MAX_RETRIES) {
        logger.sync.error('Mutation exceeded max retries, moving to dead letter', {
          type: retried.type,
          id: retried.id,
          errors: retried.lastError,
        });
        if (await moveToDeadLetter(retried, 'max_retries')) droppedCount++;
      } else if (transient && isUnreachableTooLong(retried, now)) {
        // Unanswered for a week: tell the user (held, with the payload kept)
        // instead of retrying silently forever.
        logger.sync.error('Server unreachable for this write for too long, moving to dead letter', {
          type: retried.type,
          id: retried.id,
          firstFailedAt: retried.firstFailedAt,
          transientFailures: retried.transientFailures,
        });
        if (await moveToDeadLetter(retried, 'unreachable')) droppedCount++;
      } else {
        // Also revision-guarded — writing the snapshot back unconditionally would
        // overwrite a newer payload queued during the failed attempt.
        const written = await putMutationIfUnchanged(retried, mutation.seq);
        if (written) {
          logger.sync.warn('Mutation failed, will retry', {
            type: retried.type,
            id: retried.id,
            transient,
            retryCount: retried.retryCount,
            nextAttemptAt: retried.nextAttemptAt,
            error: retried.lastError,
          });
        } else {
          logger.sync.info('Mutation failed but was superseded; newer revision kept', {
            type: mutation.type,
            id: mutation.id,
          });
        }
      }
      failed++;
    }
  }

  // One toast per run if anything stopped being retried. The wording matters:
  // the change is NOT lost any more — it sits in the dead-letter store and can
  // be retried or exported from Settings.
  if (droppedCount > 0) {
    await notify(
      droppedCount === 1
        ? 'שינוי אחד לא נשמר בענן. הוא נשמר במכשיר וניתן לנסות שוב מההגדרות'
        : `${droppedCount} שינויים לא נשמרו בענן. הם נשמרו במכשיר וניתן לנסות שוב מההגדרות`,
      'error'
    );
  }

  // Quarantine is not a failure: these changes were made without a signed-in
  // account, so only the user can decide whether they belong to this account.
  if (quarantinedCount > 0) {
    await notify(
      quarantinedCount === 1
        ? 'שינוי אחד נוצר ללא חשבון מחובר. אשרו אותו מההגדרות כדי לשמור אותו בענן'
        : `${quarantinedCount} שינויים נוצרו ללא חשבון מחובר. אשרו אותם מההגדרות כדי לשמור אותם בענן`,
      'info'
    );
  }

  // A clean pass (nothing left failing) ends the retriable-failure episode,
  // re-arming the debounced notice for the next one.
  if (failed === 0) {
    retriableFailureNotified = false;
  }

  return { success, failed };
}

/** Never refused — only the server being unreachable has delayed this write. */
function isDelayedOnlyByOutage(mutation: QueuedMutation): boolean {
  return mutation.retryCount === 0 && (mutation.transientFailures ?? 0) > 0;
}

/**
 * When this revision first failed, for a failure happening at `now`. A row
 * written before `firstFailedAt` existed that has already failed falls back to
 * when it was queued — the earliest it can have failed.
 */
function firstFailureOf(mutation: QueuedMutation, now: number): number {
  if (typeof mutation.firstFailedAt === 'number') return mutation.firstFailedAt;
  const failedBefore = mutation.retryCount + (mutation.transientFailures ?? 0) > 0;
  return failedBefore ? mutation.timestamp : now;
}

/** The server has not answered this write for MAX_UNREACHABLE_MS, over enough attempts. */
function isUnreachableTooLong(mutation: QueuedMutation, now: number): boolean {
  return (
    typeof mutation.firstFailedAt === 'number' &&
    now - mutation.firstFailedAt >= MAX_UNREACHABLE_MS &&
    (mutation.transientFailures ?? 0) >= MIN_UNREACHABLE_ATTEMPTS
  );
}

/**
 * The server has just answered (a pull succeeded): writes that only an outage
 * delayed need not wait out the rest of their backoff — up to 30 minutes — when
 * every queued write is backing off and no replay is due to prove the server is
 * back. Waives those backoffs (revision-guarded) and runs a pass. A no-op, with
 * no pass and no lock, when nothing is waiting.
 */
export async function retryOutageDelayedNow(): Promise<void> {
  const now = Date.now();
  const waiting = (await getAllMutations()).filter(
    (m) => isDelayedOnlyByOutage(m) && (m.nextAttemptAt ?? 0) > now
  );
  if (waiting.length === 0) return;
  for (const mutation of waiting) {
    await putMutationIfUnchanged({ ...mutation, nextAttemptAt: undefined }, mutation.seq);
  }
  logger.sync.info('Server answered; retrying writes the outage delayed', {
    count: waiting.length,
  });
  const result = await processQueue();
  if (result.failed > 0) await notifyRetriableFailures();
}

/**
 * Get current queue depth
 */
export async function getQueueDepth(): Promise<number> {
  const mutations = await getAllMutations();
  return mutations.length;
}

/**
 * Clear the entire queue INCLUDING the held/dead-letter changes.
 *
 * This is the destructive variant. Only call it when the user has actually asked
 * for their data to be gone — explicit "delete all my data", or a confirmed
 * sign-out where the warning named the unsynced changes.
 *
 * For an ACCOUNT SWITCH use `clearMutationQueueForOwner` instead: it drops the
 * outgoing account's entries (which can never replay anyway) without destroying
 * held changes belonging to somebody else who may sign back in.
 */
export async function clearMutationQueue(): Promise<void> {
  await clearQueue();
  await clearDeadLetterStore();
  retriableFailureNotified = false;
  logger.sync.info('Cleared mutation queue');
}

/**
 * Drop only the entries owned by `userId`, leaving every other account's pending
 * and held changes intact.
 *
 * Why this exists: the auth transition used to call `clearMutationQueue()`, which
 * wipes the dead-letter store too. That store is the app's recovery mechanism —
 * a change that hits a permanent error is MOVED there precisely so it is not
 * lost, and Settings offers retry/export for it. Destroying it on an account
 * switch deleted the one copy of writes that had never reached the cloud, and it
 * did so silently, because moving a change out of the active queue drops the
 * active depth to zero and the sign-out warning only looked at that.
 *
 * Scoping by owner keeps the security property (user A's entries never replay
 * into user B's account — replay also refuses foreign owners) without the loss.
 */
export async function clearMutationQueueForOwner(userId: string | null): Promise<void> {
  if (!userId) {
    // No known owner: fall back to the full clear, which is what the previous
    // behaviour did unconditionally. Better to be destructive here than to leave
    // unattributable entries that replay into whoever signs in next.
    await clearMutationQueue();
    return;
  }

  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, DEAD_LETTER_STORE], 'readwrite');
    for (const storeName of [STORE_NAME, DEAD_LETTER_STORE]) {
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => {
        for (const row of (req.result ?? []) as QueuedMutation[]) {
          if (row.userId === userId) tx.objectStore(storeName).delete(row.id);
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  retriableFailureNotified = false;
  logger.sync.info('Cleared queued mutations for the outgoing account', { userId });
}

/**
 * Guest → first account. Re-stamps every queued/held entry owned by
 * `GUEST_OWNER` to the real account id, then pushes all local data up so the
 * cloud holds the guest's workouts BEFORE the incoming account's pull merges.
 *
 * This is what makes signup honest: the signup screen says "כדי לשמור את
 * הנתונים שלכם", so a first sign-in must adopt local data, never wipe it.
 * Queue entries stamped `__guest__` can never replay (replay quarantines
 * ownerless owners), so re-stamping is also required for them to upload at all.
 *
 * Failures are logged per step but never thrown past a best-effort boundary:
 * an unreachable network still leaves local data intact under the new owner
 * marker, and the next successful sync drains it.
 */
export async function adoptGuestDataForUser(newUserId: string | null): Promise<void> {
  if (!newUserId) return;

  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, DEAD_LETTER_STORE], 'readwrite');
    for (const storeName of [STORE_NAME, DEAD_LETTER_STORE]) {
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => {
        for (const row of (req.result ?? []) as QueuedMutation[]) {
          if (row.userId === GUEST_OWNER)
            tx.objectStore(storeName).put({ ...row, userId: newUserId });
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  try {
    const { syncAllData } = await import('./supabaseSyncOrchestrator');
    const result = await syncAllData();
    logger.sync.info('Guest data adoption push finished', { result });
  } catch (err) {
    logger.sync.warn('Guest data adoption push failed; data stays queued locally', err);
  }
}

// ── Dead-letter recovery API ────────────────────────────────────────────────
//
// Mutations that stop being retried used to be deleted, which meant a failed
// sync silently destroyed the user's change. They are now retained here so the
// data can be recovered, retried once the cause is fixed, or exported before
// being discarded deliberately.

/** How many unsynced changes are being held for recovery. */
export async function getDeadLetterCount(): Promise<number> {
  const rows = await getAllDeadLetters();
  return rows.length;
}

/** All held changes, newest failure first. */
export async function listDeadLetters(): Promise<DeadLetterMutation[]> {
  return getAllDeadLetters();
}

/**
 * Put a held change back into the active queue with a clean retry budget, then
 * attempt a pass immediately. Returns false when the id is unknown.
 */
export async function retryDeadLetter(id: string): Promise<boolean> {
  const rows = await getAllDeadLetters();
  const entry = rows.find((row) => row.id === id);
  if (!entry) return false;

  const { failedAt: _failedAt, reason, ...mutation } = entry;

  // Re-queuing an OWNERLESS entry is the user's explicit act of claiming it for
  // the account they are signed into now. Without re-stamping the owner it would
  // be quarantined again on the next pass, and "retry" would appear broken.
  let userId = mutation.userId;
  if (reason === 'ownerless' || isOwnerless(userId)) {
    try {
      const { getCurrentUser } = await import('./supabaseAuth');
      const current = (await getCurrentUser())?.id;
      if (!current) {
        logger.sync.warn('Cannot claim an ownerless change while signed out', { id });
        return false;
      }
      userId = current;
    } catch (err) {
      logger.sync.warn('Cannot resolve the current account to claim a change', err);
      return false;
    }
  }

  await putMutation({
    ...mutation,
    userId,
    retryCount: 0,
    transientFailures: 0,
    firstFailedAt: undefined,
    nextAttemptAt: undefined,
  });

  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await processQueue();
  return true;
}

/** Retry every held change. Returns how many were re-queued. */
export async function retryAllDeadLetters(): Promise<number> {
  const rows = await getAllDeadLetters();
  let requeued = 0;
  for (const row of rows) {
    if (await retryDeadLetter(row.id)) requeued++;
  }
  return requeued;
}

/** Permanently discard a held change. Only ever call this on explicit user intent. */
export async function discardDeadLetter(id: string): Promise<void> {
  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  logger.sync.warn('Discarded dead-letter mutation on user request', { id });
}

/** JSON snapshot of all held changes, so a user can keep their data before discarding. */
export async function exportDeadLetters(): Promise<string> {
  const rows = await getAllDeadLetters();
  return JSON.stringify({ exportedAt: new Date().toISOString(), mutations: rows }, null, 2);
}

/**
 * Ids of the records of one entity (`'session'` → session:create/update/delete)
 * that have a write waiting in the active queue or held in the dead-letter
 * store. Those are the queue's to deliver, or the user's to decide on.
 */
export async function getQueuedRecordIds(entity: string): Promise<Set<string>> {
  const db = await openQueueDB();
  const rows = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const found: QueuedMutation[] = [];
    const tx = db.transaction([STORE_NAME, DEAD_LETTER_STORE], 'readonly');
    for (const storeName of [STORE_NAME, DEAD_LETTER_STORE]) {
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => found.push(...((req.result ?? []) as QueuedMutation[]));
    }
    tx.oncomplete = () => resolve(found);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.type.startsWith(`${entity}:`)) continue;
    const recordId = getRecordId(row.type, row.payload);
    if (recordId) ids.add(recordId);
  }
  return ids;
}

/**
 * Hand the cloud the workouts that sit on the unsynced ledger but in no queue
 * (sessionDb.drainUnsyncedSessions): a push that was cut short by closing the
 * tab, a hand-off that never ran. Nothing reaches those otherwise — the queue
 * cannot see them, and the "sync now" button and the sign-out guard were the
 * only callers. It runs where sync already runs on its own: after the start-up
 * queue pass (by then auth has answered or timed out), when the network comes
 * back, and after a successful pull (supabaseSyncPull). Never throws.
 */
export async function drainUnsyncedLedger(): Promise<void> {
  if (isOffline()) return;
  try {
    const { drainUnsyncedSessions } = await import('./sessionDb');
    const result = await drainUnsyncedSessions();
    if (result.pushed > 0 || result.queued > 0) {
      logger.sync.info('Drained unsynced workouts from the ledger', result);
    }
  } catch (err) {
    logger.sync.warn('Could not drain the unsynced-workout ledger', err);
  }
}

// ── Online/offline detection ────────────────────────────────────────────────

function setupOnlineListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    try {
      logger.sync.info('Network back online, processing queue');
      const result = await processQueue();
      if (result.success > 0 || result.failed > 0) {
        logger.sync.info('Queue processing complete', result);
      }
      if (result.failed > 0) {
        await notifyRetriableFailures();
      }
    } catch (err) {
      // An async event listener that rejects becomes an unhandled rejection.
      logger.sync.error('Online-handler queue processing failed', err);
    }
    await drainUnsyncedLedger();
  });

  window.addEventListener('offline', () => {
    logger.sync.info('Network went offline');
  });
}

// Auto-initialize on first import
let initialized = false;
export function initOfflineSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  setupOnlineListener();

  // Process any pending mutations on startup
  processQueue()
    .then((result) => {
      if (result.success > 0) {
        logger.sync.info('Processed queued mutations on startup', result);
      }
      if (result.failed > 0) {
        void notifyRetriableFailures();
      }
    })
    .catch((err) => logger.sync.error('Startup queue processing failed', err))
    // After the pass, not before: it has waited for auth to answer (or time out).
    .then(() => drainUnsyncedLedger());

  // DA-9: Periodic retry every 90s when online and queue has items
  setInterval(async () => {
    // An async setInterval callback that rejects becomes an unhandled
    // rejection — keep the whole body inside a try/catch.
    try {
      if (!navigator.onLine) return;
      const depth = await getQueueDepth();
      if (depth === 0) return;
      const result = await processQueue();
      if (result.success > 0 || result.failed > 0) {
        logger.sync.info('Periodic queue retry', result);
      }
      if (result.failed > 0) {
        await notifyRetriableFailures();
      }
    } catch (err) {
      logger.sync.error('Periodic queue retry failed', err);
    }
  }, 90_000);
}
