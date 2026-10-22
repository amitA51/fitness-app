/**
 * Auth error classification — one place that turns a Supabase auth failure into
 * something the screen can act on.
 *
 * The services used to hand back only `error.message`, so the status and the
 * error code were gone before the screen saw them. The login screens then
 * matched English substrings, and everything they did not recognise — the
 * server timing out, a rate limit, the database being overloaded — became
 * "אירעה שגיאה בלתי צפויה". The user could not tell "wrong password" from "the
 * server is down, wait a minute", which are opposite instructions.
 */

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'weak_password'
  /** Password reset to the password the account already has. */
  | 'same_password'
  | 'rate_limited'
  | 'email_rate_limited'
  /** No answer, a timeout, a 5xx, or the device is offline. Retrying later can work. */
  | 'unreachable'
  | 'unknown';

/** Short, plain, plural imperative — the register the rest of the app uses. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorKind, string>> = {
  invalid_credentials: 'אימייל או סיסמה שגויים',
  email_not_confirmed: 'האימייל עוד לא אושר. פתחו את המייל ששלחנו ולחצו על הקישור.',
  already_registered: 'כתובת אימייל זו כבר רשומה',
  weak_password: 'הסיסמה חלשה מדי. בחרו סיסמה ארוכה יותר שמשלבת אותיות וספרות.',
  same_password: 'זו הסיסמה הנוכחית. בחרו סיסמה אחרת.',
  rate_limited: 'יותר מדי ניסיונות ברצף. נסו שוב בעוד כמה דקות.',
  email_rate_limited: 'נשלחו יותר מדי מיילים בזמן קצר. נסו שוב בעוד שעה.',
  unreachable: 'השרת לא עונה כרגע. בדקו את החיבור לאינטרנט ונסו שוב בעוד דקה.',
  unknown: 'אירעה שגיאה בלתי צפויה. נסו שוב.',
};

export const authErrorMessage = (kind: AuthErrorKind | null | undefined): string =>
  AUTH_ERROR_MESSAGES[kind ?? 'unknown'];

interface ErrorFields {
  name: string;
  code: string;
  status: number | null;
  message: string;
}

const fieldsOf = (err: unknown): ErrorFields => {
  if (typeof err === 'string') {
    return { name: '', code: '', status: null, message: err.toLowerCase() };
  }
  if (!err || typeof err !== 'object') return { name: '', code: '', status: null, message: '' };
  const e = err as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  return {
    name: typeof e.name === 'string' ? e.name : '',
    code: typeof e.code === 'string' ? e.code.toLowerCase() : '',
    status: typeof e.status === 'number' ? e.status : null,
    message: typeof e.message === 'string' ? e.message.toLowerCase() : '',
  };
};

// auth-js gives these two a 500 status, but they are raised in the browser while
// reading a redirect URL — the server was never asked.
const CLIENT_SIDE_ERRORS = new Set([
  'AuthImplicitGrantRedirectError',
  'AuthPKCEGrantCodeExchangeError',
]);

const NETWORK_MESSAGES = [
  'failed to fetch', // Chrome
  'networkerror', // Firefox
  'load failed', // Safari
  'network request failed',
  'fetch failed',
  'did not answer in time', // our own timedFetch (src/lib/supabase.ts)
];

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * True when the server did not answer usefully: no connection, a timeout, a
 * gateway or database failure. These are worth retrying later and say nothing
 * about the user's credentials or session — so they must never sign anyone out.
 */
export const isUnreachableAuthError = (err: unknown): boolean => {
  if (!err) return false;
  const { name, code, status, message } = fieldsOf(err);
  if (name === 'AuthRetryableFetchError') return true;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  if (
    code === 'request_timeout' ||
    code === 'hook_timeout' ||
    code === 'hook_timeout_after_retry'
  ) {
    return true;
  }
  if (status !== null && !CLIENT_SIDE_ERRORS.has(name) && (status === 0 || status >= 500)) {
    return true;
  }
  if (NETWORK_MESSAGES.some((needle) => message.includes(needle))) return true;
  return isOffline();
};

export const classifyAuthError = (err: unknown): AuthErrorKind => {
  if (!err) return 'unknown';
  const { name, code, status, message } = fieldsOf(err);

  // Codes first: they are the server's own word (auth-js lib/error-codes).
  switch (code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return 'already_registered';
    case 'weak_password':
      return 'weak_password';
    case 'same_password':
      return 'same_password';
    case 'over_email_send_rate_limit':
      return 'email_rate_limited';
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limited';
  }
  if (status === 429) return 'rate_limited';
  if (isUnreachableAuthError(err)) return 'unreachable';
  if (name === 'AuthWeakPasswordError') return 'weak_password';

  // Older servers answer without a code; their messages are stable English.
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'invalid_credentials';
  }
  if (message.includes('email not confirmed')) return 'email_not_confirmed';
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'already_registered';
  }
  if (message.includes('email rate limit')) return 'email_rate_limited';
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limited';
  }
  if (message.includes('different from the old password')) return 'same_password';
  if (message.includes('password should')) return 'weak_password';
  return 'unknown';
};

/** How long a sign-out step may wait on the network before we move on. */
export const SIGN_OUT_STEP_TIMEOUT_MS = 4_000;

/**
 * Wait for `task` at most `ms`. Resolves `true` when it settled in time (either
 * way — a rejection is the caller's to log, not a reason to stall), `false` when
 * the wait ran out. The task itself keeps running; this only stops the WAIT.
 */
export const settlesWithin = async (task: Promise<unknown>, ms: number): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([
      task.then(
        () => true,
        () => true
      ),
      timedOut,
    ]);
  } finally {
    clearTimeout(timer);
  }
};
