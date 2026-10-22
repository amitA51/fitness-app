// ============================================================================
// Last-known-good — the last answer the SERVER gave, kept per user with an age.
// ----------------------------------------------------------------------------
// Start-up checks (consent, age verification) used to read "the server did not
// answer" as "the user must act", putting a full-screen wall in front of people
// who had already passed the check. Storing the last real answer lets a failed
// read fall back to it instead. Entries expire after `ttlMs`, so a long-stale
// answer is never trusted forever.
//
// Only ever store what the server actually said — never a guess or a fallback —
// or a fallback would launder itself into "the server's answer".
// ============================================================================

import { readJsonStorage, writeJsonStorage } from './safeJson';

interface Entry<T> {
  savedAt: number;
  value: T;
}

const isEntry = (raw: unknown): raw is Entry<unknown> =>
  typeof raw === 'object' &&
  raw !== null &&
  typeof (raw as { savedAt?: unknown }).savedAt === 'number' &&
  'value' in raw;

/** The stored value, or null when there is none, it is malformed or older than `ttlMs`. */
export function readLastKnownGood<T>(key: string, ttlMs: number, now = Date.now()): T | null {
  const raw = readJsonStorage<unknown>(key, null);
  if (!isEntry(raw)) return null;
  // A savedAt in the future (the device clock moved back) still counts as fresh.
  if (now - raw.savedAt > ttlMs) return null;
  return raw.value as T;
}

/** The minimal account shape the fail-open rule needs (a Supabase User fits). */
export interface AccountRef {
  id: string;
  created_at?: string;
}

/** How long an account counts as new for {@link isNewAccount}. */
export const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a gate with no server answer AND no stored answer must stay up.
 *
 * Sign-up records neither consent nor a birth date: the start-up gates are the
 * only place a new account is asked. So a NEW account with nothing stored may
 * never have passed them, and stays gated until a read answers. An OLDER account
 * with nothing stored was first seen on this device before answers were kept,
 * or is on a new device / cleared storage; it was asked when it was new, so it
 * is let in and re-checked in the background. A missing or unreadable
 * created_at counts as older (Supabase always sends it).
 */
export function isNewAccount(account: AccountRef, now = Date.now()): boolean {
  const created = account.created_at ? Date.parse(account.created_at) : Number.NaN;
  if (Number.isNaN(created)) return false;
  return now - created < NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Store a server answer, stamped with `askedAt` — when the question was ASKED,
 * not when the answer arrived. An answer asked for before the stored one is
 * dropped: a slow read that started before an acceptance was recorded must not
 * overwrite that acceptance with the stale "still needed" it saw. (A stored
 * stamp in the future, from a clock that moved back, never blocks a write.)
 * Best-effort: a full or blocked storage only loses the fallback.
 */
export function writeLastKnownGood<T>(
  key: string,
  value: T,
  askedAt = Date.now(),
  now = Date.now()
): void {
  const stored = readJsonStorage<unknown>(key, null);
  if (isEntry(stored) && stored.savedAt > askedAt && stored.savedAt <= now) return;
  const entry: Entry<T> = { savedAt: askedAt, value };
  writeJsonStorage(key, entry);
}
