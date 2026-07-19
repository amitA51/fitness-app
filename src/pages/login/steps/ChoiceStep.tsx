/**
 * STEP: CHOICE (Sign In vs Sign Up)
 */

import { m } from 'framer-motion';
import { ChevronLeft, Lock, ShieldAlert, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signInWithGoogle } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import { slideFromRight, staggerItem } from '../animations';

interface ChoiceStepProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onGuest: () => void;
}

export function ChoiceStep({ onSignIn, onSignUp, onGuest }: ChoiceStepProps) {
  const [oauthError, setOauthError] = useState('');
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
            borderRadius: '22px 16px 22px 16px',
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
          borderRadius: '22px 16px 22px 16px',
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
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '-0.01em',
                }}
              >
                משתמש קיים
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
          borderRadius: '22px 16px 22px 16px',
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
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
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
            letterSpacing: '0.15em',
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
        className="w-full h-12 flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: 'transparent',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--fs-muted)',
          cursor: 'pointer',
        }}
      >
        המשיכו כאורח
      </m.button>

      {/* Google OAuth */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={async () => {
          setOauthError('');
          const { error } = await signInWithGoogle();
          if (error) {
            setOauthError(
              typeof error === 'object' && error && 'message' in error
                ? `כניסה עם Google נכשלה: ${(error as { message?: string }).message ?? ''}`
                : 'כניסה עם Google נכשלה'
            );
          }
        }}
        className="w-full h-14 flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '15px',
          color: 'var(--fs-ink)',
          cursor: 'pointer',
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
        המשך עם Google
      </m.button>

      {oauthError && (
        <div
          role="alert"
          dir="rtl"
          style={{
            padding: '10px 14px',
            background: 'var(--color-error-muted)',
            border: '1px solid var(--color-error)',
            borderRadius: '12px 8px 12px 8px',
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
