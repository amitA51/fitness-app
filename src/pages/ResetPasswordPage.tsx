// ============================================================================
// ResetPasswordPage — /reset-password
// ============================================================================
// Landing page for the Supabase recovery email. `resetPassword()` sends the user
// to `${origin}/reset-password` (src/services/supabaseAuth.ts), and the Supabase
// client exchanges the URL fragment for a short-lived recovery session on load
// (detectSessionInUrl defaults to true). Until this page existed the link was a
// dead end: the route was missing, so every password reset ended on a 404-ish
// redirect back into the app shell.
//
// Three states, all reachable:
//   verifying — the client is still exchanging the recovery token
//   ready     — a recovery session exists, show the new-password form
//   invalid   — expired/reused/malformed link, offer to request a new one
// ============================================================================

import { m } from 'framer-motion';
import { AlertCircle, Check, Lock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AnnualInput } from '../components/ui/AnnualInput';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { updatePassword } from '../services/supabaseAuth';
import { logger } from '../utils/logger';

type ScreenState = 'verifying' | 'ready' | 'invalid' | 'done';

/**
 * Recovery errors arrive in the URL fragment (`#error=...&error_description=...`)
 * rather than the query string, so they must be read before the client strips it.
 */
function readLinkError(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const code = params.get('error_code') ?? params.get('error');
  if (!code) return null;
  if (code.includes('expired') || code === 'otp_expired') {
    return 'תוקף הקישור פג. בקשו קישור חדש והשתמשו בו תוך שעה.';
  }
  return 'הקישור אינו תקין או שכבר נעשה בו שימוש. בקשו קישור חדש.';
}

export default function ResetPasswordPage() {
  const [state, setState] = useState<ScreenState>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolve the recovery session once. The Supabase client may still be parsing
  // the fragment when this component mounts, so we listen for the auth event as
  // well as checking the current session.
  useEffect(() => {
    const linkError = readLinkError();
    if (linkError) {
      setGeneralError(linkError);
      setState('invalid');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setGeneralError('איפוס סיסמה דורש חיבור לחשבון בענן. נסו שוב מהמכשיר שבו נרשמתם.');
      setState('invalid');
      return;
    }

    const client = supabase;
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setState('ready');
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) markReady();
    });

    client.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) markReady();
      })
      .catch((err) => {
        logger.auth.warn('Recovery session lookup failed', err);
      });

    // The exchange is local (no network round-trip beyond the initial load), so a
    // short grace period is enough to distinguish "still parsing" from "no token".
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setGeneralError('לא זיהינו קישור איפוס תקין. בקשו קישור חדש ופתחו אותו מאותו מכשיר.');
      setState('invalid');
    }, 2500);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGeneralError(null);
      setFieldError(null);
      setConfirmError(null);

      if (!password) {
        setFieldError('יש להזין סיסמה חדשה');
        return;
      }
      if (password !== confirm) {
        setConfirmError('הסיסמאות אינן זהות');
        return;
      }

      setSaving(true);
      // updatePassword() runs the shared strength policy and returns a localised
      // message, so the rules stay identical to sign-up.
      const { error } = await updatePassword(password);
      setSaving(false);

      if (error) {
        setGeneralError(error);
        return;
      }

      setState('done');
    },
    [password, confirm]
  );

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
      lang="he"
    >
      <main
        id="main-content"
        className="flex-1 flex flex-col items-center justify-center px-5 py-8"
      >
        <div className="w-full" style={{ maxWidth: 400 }}>
          {state === 'verifying' && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--fs-muted)',
                textAlign: 'center',
              }}
            >
              מאמתים את קישור האיפוס...
            </p>
          )}

          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-asymmetric)',
                  background: 'var(--color-error-muted)',
                }}
                aria-hidden="true"
              >
                <AlertCircle size={26} style={{ color: 'var(--color-error)' }} />
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 24,
                  color: 'var(--fs-ink)',
                  margin: 0,
                }}
              >
                לא ניתן לאפס את הסיסמה
              </h1>
              <p
                role="alert"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--fs-muted)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {generalError}
              </p>
              <Button variant="editorial" fullWidth onClick={() => window.location.assign('/')}>
                חזרה למסך ההתחברות
              </Button>
            </div>
          )}

          {state === 'done' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <m.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 1 }}
                className="flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-asymmetric)',
                  background: 'var(--fs-accent)',
                }}
                aria-hidden="true"
              >
                <Check size={26} style={{ color: 'var(--color-ink-on-accent)' }} />
              </m.div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 24,
                  color: 'var(--fs-ink)',
                  margin: 0,
                }}
              >
                הסיסמה עודכנה
              </h1>
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--fs-muted)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                אפשר להמשיך לאפליקציה עם הסיסמה החדשה.
              </p>
              <Button variant="editorial" fullWidth onClick={() => window.location.assign('/')}>
                המשך לאפליקציה
              </Button>
            </div>
          )}

          {state === 'ready' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 28,
                    color: 'var(--fs-ink)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    margin: 0,
                  }}
                >
                  סיסמה חדשה
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--fs-muted)',
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  לפחות 8 תווים, הכוללים אות וספרה.
                </p>
              </div>

              <AnnualInput
                label="סיסמה חדשה"
                type="password"
                value={password}
                onChange={setPassword}
                icon={<Lock size={16} />}
                error={fieldError ?? undefined}
                autoComplete="new-password"
                autoFocus
              />

              <AnnualInput
                label="אימות סיסמה"
                type="password"
                value={confirm}
                onChange={setConfirm}
                icon={<Lock size={16} />}
                error={confirmError ?? undefined}
                autoComplete="new-password"
                enterKeyHint="done"
              />

              {generalError && (
                <div
                  role="alert"
                  className="p-4 flex items-start gap-3"
                  style={{
                    background: 'var(--color-error-muted)',
                    border: '1px solid var(--color-error)',
                    borderRadius: 12,
                  }}
                >
                  <AlertCircle size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      color: 'var(--color-error)',
                      margin: 0,
                    }}
                  >
                    {generalError}
                  </p>
                </div>
              )}

              <Button
                variant="editorial"
                type="submit"
                isLoading={saving}
                disabled={saving}
                fullWidth
              >
                שמירת הסיסמה
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
