/**
 * STEP: CHOICE (Sign In vs Sign Up)
 */

import { m } from 'framer-motion';
import { ChevronLeft, Lock, ShieldAlert, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { authErrorMessage } from '../../../services/authErrors';
import { NATIVE_AUTH_ERROR_EVENT } from '../../../services/nativeOAuth';
import { signInWithApple, signInWithGoogle } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import { getPlatform } from '../../../utils/platform';
import { slideFromRight, staggerItem } from '../animations';

const OAUTH_FAILED_TEXT = 'הכניסה לא הצליחה. נסו שוב או היכנסו עם אימייל וסיסמה.';

type OAuthProvider = 'google' | 'apple';

/**
 * Sign in with Apple is offered once the Apple provider is set up in Supabase
 * and the build says so (VITE_APPLE_SIGN_IN=true, docs/STORE-LAUNCH.md).
 */
const offersApple = (): boolean => import.meta.env.VITE_APPLE_SIGN_IN === 'true';

/**
 * App Store guideline 4.8: an iOS app that offers Google sign-in must also
 * offer Sign in with Apple. Without Apple the iOS app offers email and
 * password only; the web and Android always keep Google.
 */
const offersGoogle = (): boolean => getPlatform() !== 'ios' || offersApple();

/** Apple's mark, as its Human Interface Guidelines require on the button. */
function AppleLogo() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}

interface ChoiceStepProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onGuest: () => void;
}

export function ChoiceStep({ onSignIn, onSignUp, onGuest }: ChoiceStepProps) {
  const [oauthError, setOauthError] = useState('');
  // Busy from the tap until the redirect to the provider takes over the page,
  // so a second tap cannot start a competing attempt; a failure gets Hebrew
  // text instead of the SDK's English message.
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const googleBusy = oauthBusy === 'google';

  const handleOAuth = useCallback(
    async (provider: OAuthProvider) => {
      if (oauthBusy) return;
      setOauthBusy(provider);
      setOauthError('');
      try {
        const start = provider === 'apple' ? signInWithApple : signInWithGoogle;
        const { error, errorKind } = await start();
        if (error) {
          logger.auth.warn(`${provider} sign-in did not start`, error);
          setOauthError(errorKind === 'unknown' ? OAUTH_FAILED_TEXT : authErrorMessage(errorKind));
        }
      } finally {
        setOauthBusy(null);
      }
    },
    [oauthBusy]
  );
  const handleGoogle = useCallback(() => handleOAuth('google'), [handleOAuth]);

  // In the native apps the sign-in finishes after the system browser hands the
  // app back its callback; a failure there is reported through this event.
  useEffect(() => {
    const onNativeFailure = () => setOauthError(OAUTH_FAILED_TEXT);
    window.addEventListener(NATIVE_AUTH_ERROR_EVENT, onNativeFailure);
    return () => window.removeEventListener(NATIVE_AUTH_ERROR_EVENT, onNativeFailure);
  }, []);
  // Data-safety nudge: if local workout data already exists (a guest who built
  // up real data), surface a one-line banner pointing at Sign-Up so the data
  // gets a home before it can be lost. Best-effort — never blocks the screen.
  const [hasLocalData, setHasLocalData] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import('../../../services/sessionDb')
      .then(({ getAllWorkoutSessions }) => getAllWorkoutSessions())
      .then((sessions) => {
        if (!cancelled) setHasLocalData(sessions.length > 0);
      })
      .catch((err) => {
        logger.app.warn('ChoiceStep: local session check failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <m.div key="choice" {...slideFromRight} className="flex flex-col gap-6 px-5 py-8">
      {/* Guest data-safety conversion nudge */}
      {hasLocalData && (
        <m.button
          variants={staggerItem}
          initial="initial"
          animate="animate"
          type="button"
          onClick={onSignUp}
          className="flex items-center gap-3 text-right active:scale-[0.98] transition-transform"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-accent)',
            borderInlineStartWidth: '4px',
            borderRadius: 'var(--radius-card)',
            padding: '12px 14px',
            cursor: 'pointer',
          }}
        >
          <ShieldAlert
            size={18}
            style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--fs-ink)',
              lineHeight: 1.4,
            }}
          >
            אתם מתאמנים כאורח. צרו חשבון כדי לשמור את הנתונים שלכם.
          </span>
        </m.button>
      )}
      {/* Sign In Card */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignIn}
        className="text-right group glass-surface scale-pop-in transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
        style={{
          cursor: 'pointer',
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 'var(--radius-card)',
          padding: '20px',
          minHeight: '72px',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: 'var(--fs-primary)', borderRadius: 12 }}
            >
              <Lock size={20} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
            </div>
            <div>
              <h3
                className="mb-0.5"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: 'var(--fs-ink)',
                }}
              >
                כניסה עם חשבון
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '-0.01em',
                }}
              >
                כבר יש לכם חשבון
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:-translate-x-1 motion-reduce:group-hover:translate-x-0"
            style={{ background: 'var(--fs-surface-2)', borderRadius: 12 }}
          >
            <ChevronLeft size={18} style={{ color: 'var(--fs-ink)' }} aria-hidden="true" />
          </div>
        </div>
      </m.button>

      {/* Sign Up Card — primary path, full accent treatment */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignUp}
        className="text-right group scale-pop-in transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.94] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
        style={{
          cursor: 'pointer',
          background: 'var(--fs-accent)',
          border: '1px solid var(--fs-accent)',
          borderRadius: 'var(--radius-card)',
          padding: '20px',
          minHeight: '72px',
          boxShadow: 'var(--shadow-glow-accent)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: 'var(--fs-primary)', borderRadius: 12 }}
            >
              <User size={20} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
            </div>
            <div>
              <h3
                className="mb-0.5"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: 'var(--color-ink-on-accent)',
                }}
              >
                הרשמה
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--color-ink-on-accent)',
                  opacity: 0.7,
                  letterSpacing: '-0.01em',
                }}
              >
                יצירת חשבון חדש
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:-translate-x-1 motion-reduce:group-hover:translate-x-0"
            style={{ background: 'var(--fs-primary)', borderRadius: 12 }}
          >
            <ChevronLeft size={18} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
          </div>
        </div>
      </m.button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1" style={{ height: '1px', background: 'var(--fs-surface-2)' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--fs-muted)',
            letterSpacing: '-0.01em',
          }}
        >
          או
        </span>
        <div className="flex-1" style={{ height: '1px', background: 'var(--fs-surface-2)' }} />
      </div>

      {/* Guest Button — quieter than the accent Sign-Up card so the data-safe
          path stays the clear primary choice (muted border + body font). */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onGuest}
        className="w-full h-12 flex items-center justify-center gap-3 transition-ui hover:opacity-90 active:scale-[0.98]"
        style={{
          background: 'transparent',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 'var(--radius-card)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--fs-muted)',
          cursor: 'pointer',
        }}
      >
        המשיכו כאורח
      </m.button>

      {/* Sign in with Apple — black on light, white on dark (Apple HIG), and
          at least as prominent as the Google button below it. */}
      {offersApple() && (
        <m.button
          variants={staggerItem}
          initial="initial"
          animate="animate"
          type="button"
          onClick={() => void handleOAuth('apple')}
          disabled={oauthBusy !== null}
          aria-busy={oauthBusy === 'apple'}
          className="w-full h-14 flex items-center justify-center gap-3 transition-ui hover:opacity-90 active:scale-[0.98] disabled:active:scale-100"
          style={{
            background: 'var(--fs-ink)',
            border: '1px solid var(--fs-ink)',
            borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '15px',
            color: 'var(--fs-bg)',
            cursor: oauthBusy === 'apple' ? 'default' : 'pointer',
            opacity: oauthBusy === 'apple' ? 0.6 : 1,
          }}
        >
          <AppleLogo />
          {oauthBusy === 'apple' ? 'מעבירים ל-Apple…' : 'המשך עם Apple'}
        </m.button>
      )}

      {/* Google OAuth */}
      {offersGoogle() && (
        <m.button
          variants={staggerItem}
          initial="initial"
          animate="animate"
          type="button"
          onClick={handleGoogle}
          disabled={oauthBusy !== null}
          aria-busy={googleBusy}
          className="w-full h-14 flex items-center justify-center gap-3 transition-ui hover:opacity-90 active:scale-[0.98] disabled:active:scale-100"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '15px',
            color: 'var(--fs-ink)',
            cursor: googleBusy ? 'default' : 'pointer',
            opacity: googleBusy ? 0.6 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          {googleBusy ? 'מעבירים ל-Google…' : 'המשך עם Google'}
        </m.button>
      )}

      {oauthError && (
        <div
          role="alert"
          dir="rtl"
          style={{
            padding: '10px 14px',
            background: 'var(--color-error-muted)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-error)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            textAlign: 'right',
          }}
        >
          {oauthError}
        </div>
      )}
    </m.div>
  );
}
