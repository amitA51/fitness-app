// ============================================================================
// Supabase Edge Function: account-delete
// ----------------------------------------------------------------------------
// The only real "delete my account" path. Until this existed, Settings offered
// "מחיקת כל הנתונים", which cleared 11 sync tables plus local storage and left
// the auth.users row, the coaching/community/consent rows and every Storage
// object in place — while the UI promised permanent erasure.
//
// What this does, in order:
//   1. Authenticates the caller from their JWT (no service-role trust from the
//      browser) and rate-limits the endpoint fail-closed.
//   2. Requires a typed confirmation: the caller must send the exact email on
//      their own JWT. Verified server-side, so a stray client call cannot erase
//      an account by accident.
//   3. Opens an audit row (see 20260726090000_account_deletion_audit.sql).
//   4. Removes every Storage object under `${uid}/` in the private and public
//      buckets. Storage is NOT covered by the auth.users cascade.
//   5. Deletes auth.users. Every application table references auth.users(id)
//      with ON DELETE CASCADE (verified across supabase/migrations/**), so this
//      single delete removes workouts, coaching links, messages, community
//      content, consents, entitlements and push subscriptions.
//   6. Closes the audit row.
//
// Idempotent: deleting an already-deleted user resolves as success.
//
// Body:    { confirmEmail: string }
// Returns: { ok: true, storageObjectsRemoved: number }
//        | { ok: false, error: 'unauthenticated'|'confirmation_mismatch'|'rate_limited'|'method'|'bad_request'|'storage_failed'|'delete_failed' }
//
// Deploy:  supabase functions deploy account-delete
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeRateLimits } from '../_shared/rateLimit.ts';

// @ts-expect-error Deno global
const env = (k: string): string => (Deno.env.get(k) ?? '') as string;

// Same fail-closed CORS posture as coach-invite-accept: without ALLOWED_ORIGIN a
// misconfigured deploy only serves localhost, never a wildcard.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

function corsHeaders(req: Request): Record<string, string> {
  const raw = env('ALLOWED_ORIGIN');
  const allowed = (raw ? raw.split(',') : DEFAULT_ORIGINS).map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  // Omit the header entirely for disallowed origins rather than echoing the
  // literal string "null", which an opaque origin can match.
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

const json = (body: unknown, status: number, req: Request): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });

/** Buckets that namespace objects by `${uid}/`. Keep in sync with the client. */
const USER_STORAGE_BUCKETS = ['progress-photos', 'avatars'] as const;

interface StorageEntry {
  name: string;
  id: string | null;
}

/**
 * Collect every object path under a user's prefix. Storage listing is one level
 * at a time: entries with a null id are folders and must be walked.
 */
async function listUserObjects(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  const queue: string[] = [prefix];
  let guard = 0;

  while (queue.length > 0) {
    // Defensive bound: a pathological tree must not run the function out of time.
    if (guard++ > 500) return { paths, error: 'storage_tree_too_deep' };
    const current = queue.shift() as string;
    const { data, error } = await admin.storage.from(bucket).list(current, { limit: 1000 });
    if (error) return { paths, error: error.message };
    for (const entry of (data ?? []) as StorageEntry[]) {
      const full = `${current}/${entry.name}`;
      if (entry.id === null) queue.push(full);
      else paths.push(full);
    }
  }

  return { paths, error: null };
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, req);

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = env('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('[account-delete] missing required environment configuration');
    return json({ ok: false, error: 'delete_failed' }, 503, req);
  }

  // 1. Identify the caller from their own JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ ok: false, error: 'unauthenticated' }, 401, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Rate limit, fail CLOSED. Account deletion is irreversible; if the ledger is
  // unavailable we would rather refuse than allow unbounded attempts. Atomic via
  // the consume_rate_limit RPC so concurrent attempts cannot all slip through.
  const rateVerdict = await consumeRateLimits(
    admin,
    [{ bucket: 'account_delete_user', subject: caller.id, windowSeconds: 3600, maxEvents: 5 }],
    '[account-delete]'
  );
  if (!rateVerdict.allowed) {
    return json({ ok: false, error: 'rate_limited' }, rateVerdict.unavailable ? 503 : 429, req);
  }

  // 2. Typed confirmation, verified against the JWT claim rather than the body.
  let confirmEmail = '';
  try {
    const body = (await req.json()) as { confirmEmail?: unknown };
    if (typeof body.confirmEmail !== 'string') return json({ ok: false, error: 'bad_request' }, 400, req);
    confirmEmail = body.confirmEmail.trim().toLowerCase();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400, req);
  }

  const callerEmail = (caller.email ?? '').trim().toLowerCase();
  if (!callerEmail || confirmEmail !== callerEmail) {
    return json({ ok: false, error: 'confirmation_mismatch' }, 403, req);
  }

  // 3. Open the audit row before touching anything.
  const { data: auditRow } = await admin
    .from('account_deletion_audit')
    .insert({ deleted_user_id: caller.id, outcome: 'started' })
    .select('id')
    .maybeSingle();
  const auditId = (auditRow as { id?: string } | null)?.id ?? null;

  const failAudit = async (reason: string) => {
    if (!auditId) return;
    await admin
      .from('account_deletion_audit')
      .update({ outcome: 'failed', failure_reason: reason, completed_at: new Date().toISOString() })
      .eq('id', auditId);
  };

  // 4. Storage first: objects survive the auth.users cascade, so deleting the
  //    user before the files would orphan them permanently.
  let removed = 0;
  for (const bucket of USER_STORAGE_BUCKETS) {
    const { paths, error: listError } = await listUserObjects(admin, bucket, caller.id);
    if (listError) {
      console.error(`[account-delete] listing ${bucket} failed:`, listError);
      await failAudit(`storage_list:${bucket}`);
      return json({ ok: false, error: 'storage_failed' }, 500, req);
    }
    if (paths.length === 0) continue;

    // Remove in batches so a large photo history cannot exceed request limits.
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error: removeError } = await admin.storage.from(bucket).remove(batch);
      if (removeError) {
        console.error(`[account-delete] removing from ${bucket} failed:`, removeError.message);
        await failAudit(`storage_remove:${bucket}`);
        return json({ ok: false, error: 'storage_failed' }, 500, req);
      }
      removed += batch.length;
    }
  }

  // 5. Delete the identity. Every application table references auth.users(id)
  //    ON DELETE CASCADE, so this is what actually erases the user's records.
  const { error: deleteError } = await admin.auth.admin.deleteUser(caller.id);
  if (deleteError) {
    const message = deleteError.message ?? 'unknown';
    // Already gone: treat as success so a retried request still resolves.
    const alreadyDeleted = /not found/i.test(message);
    if (!alreadyDeleted) {
      console.error('[account-delete] auth user deletion failed:', message);
      await failAudit('auth_delete');
      return json({ ok: false, error: 'delete_failed' }, 500, req);
    }
  }

  // 6. Close the audit row.
  if (auditId) {
    await admin
      .from('account_deletion_audit')
      .update({
        outcome: 'completed',
        completed_at: new Date().toISOString(),
        storage_objects_removed: removed,
      })
      .eq('id', auditId);
  }

  return json({ ok: true, storageObjectsRemoved: removed }, 200, req);
});
