/**
 * STEP: CHOICE (Sign In vs Sign Up)
 */

import { m } from 'framer-motion';
import { ChevronRight, Lock, User } from 'lucide-react';
import { useState } from 'react';
import { signInWithGoogle } from '../../../services/supabaseAuth';
import { slideFromRight, staggerItem } from '../animations';

interface ChoiceStepProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onGuest: () => void;
}

export function ChoiceStep({ onSignIn, onSignUp, onGuest }: ChoiceStepProps) {
  const [oauthError, setOauthError] = useState('');
  return (
    <m.div key="choice" {...slideFromRight} className="flex flex-col gap-6 px-5 py-8">
      {/* Sign In Card */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignIn}
        className="text-right group glass-surface scale-pop-in"
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
              style={{ background: 'var(--fs-primary)', borderRadius: 0 }}
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
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                משתמש קיים
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:-translate-x-1"
            style={{ background: 'var(--fs-surface-2)', borderRadius: 0 }}
          >
            <ChevronRight size={18} style={{ color: 'var(--fs-ink)' }} aria-hidden="true" />
          </div>
        </div>
      </m.button>

      {/* Sign Up Card */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignUp}
        className="text-right group glass-surface scale-pop-in"
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
              style={{ background: 'var(--fs-accent)', borderRadius: 0 }}
            >
              <User size={20} style={{ color: 'var(--color-ink-on-accent)' }} aria-hidden="true" />
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
                הרשמה
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                יצירת חשבון חדש
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:-translate-x-1"
            style={{ background: 'var(--fs-surface-2)', borderRadius: 0 }}
          >
            <ChevronRight size={18} style={{ color: 'var(--fs-ink)' }} aria-hidden="true" />
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
            textTransform: 'uppercase',
          }}
        >
          או
        </span>
        <div className="flex-1" style={{ height: '1px', background: 'var(--fs-surface-2)' }} />
      </div>

      {/* Guest Button */}
      <m.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onGuest}
        className="w-full h-14 flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-primary)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '15px',
          textTransform: 'uppercase',
          color: 'var(--fs-heading)',
          cursor: 'pointer',
        }}
      >
        התחל כאורח
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
          fontWeight: 800,
          fontSize: '15px',
          textTransform: 'uppercase',
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
