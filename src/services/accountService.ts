// ============================================================================
// ACCOUNT SERVICE — permanent account deletion
// ----------------------------------------------------------------------------
// Settings previously offered only "מחיקת כל הנתונים", which cleared local
// stores plus 11 cloud tables and left the account, the coaching relationships
// and every uploaded photo intact. This is the real erasure path: the
// `account-delete` edge function removes the user's Storage objects and then the
// auth.users row, which cascades every application table.
//
// The confirmation email is verified SERVER-side against the caller's JWT. It is
// sent here only so a mistyped confirmation fails before anything is destroyed.
// ============================================================================

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { clearUserScopedLocalData } from './userScopedLocalData';

export type DeleteAccountError =
  | 'unauthenticated'
  | 'confirmation_mismatch'
  | 'rate_limited'
  | 'offline'
  | 'server'
  | 'not_configured';

export interface DeleteAccountResult {
  ok: boolean;
  error?: DeleteAccountError;
  /** How many Storage objects the server removed. Useful for the audit copy. */
  storageObjectsRemoved?: number;
}

interface EdgeResponse {
  ok?: boolean;
  error?: string;
  storageObjectsRemoved?: number;
}

/** Hebrew, actionable messages for every failure the server can return. */
export function deleteAccountErrorMessage(error: DeleteAccountError | undefined): string {
  switch (error) {
    case 'confirmation_mismatch':
      return 'כתובת הדוא"ל שהוזנה אינה תואמת לחשבון. הקלידו את הכתובת המדויקת שאיתה נכנסתם.';
    case 'rate_limited':
      return 'נשלחו יותר מדי בקשות מחיקה. נסו שוב בעוד שעה.';
    case 'offline':
      return 'אין חיבור לאינטרנט. מחיקת חשבון מחייבת חיבור — התחברו לרשת ונסו שוב.';
    case 'unauthenticated':
      return 'הפעולה דורשת התחברות מחדש. התנתקו, התחברו שוב ונסו שוב.';
    case 'not_configured':
      return 'החשבון הזה מקומי בלבד ואין מה למחוק בענן. אפשר למחוק את הנתונים מהמכשיר.';
    default:
      return 'מחיקת החשבון נכשלה ולא בוצע שינוי. נסו שוב, ואם החוזר נמשך פנו לתמיכה.';
  }
}

/**
 * Permanently delete the signed-in account. On success the local device is also
 * wiped, because the account it belonged to no longer exists.
 */
export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  if (!supabase) return { ok: false, error: 'not_configured' };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }

  const { data, error } = await supabase.functions.invoke('account-delete', {
    body: { confirmEmail: confirmEmail.trim().toLowerCase() },
  });

  if (error) {
    logger.db.error('deleteAccount transport failure', error);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, error: offline ? 'offline' : 'server' };
  }

  const res = (data ?? {}) as EdgeResponse;
  if (!res.ok) {
    const known: DeleteAccountError[] = [
      'unauthenticated',
      'confirmation_mismatch',
      'rate_limited',
    ];
    const mapped = known.find((k) => k === res.error);
    return { ok: false, error: mapped ?? 'server' };
  }

  // The cloud account is gone. Remove the local mirror too so the device does
  // not keep showing the deleted user's workouts.
  try {
    await clearUserScopedLocalData();
  } catch (err) {
    logger.app.warn('deleteAccount: local cleanup incomplete after server deletion', err);
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    logger.auth.warn('deleteAccount: sign-out after deletion failed', err);
  }

  return { ok: true, storageObjectsRemoved: res.storageObjectsRemoved ?? 0 };
}
