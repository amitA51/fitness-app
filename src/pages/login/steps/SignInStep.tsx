/**
 * STEP: SIGN IN CREDENTIALS
 */

import { m } from 'framer-motion';
import { AlertCircle, ArrowLeft, LogIn, Mail } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnualInput } from '../../../components/ui/AnnualInput';
import { AnnualPasswordInput } from '../../../components/ui/AnnualPasswordInput';
import { Button } from '../../../components/ui/Button';
import { signIn } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import { slideFromRight, staggerContainer, staggerItem } from '../animations';
import { GhostLink } from '../components/GhostLink';
import type { SignInFormData, ValidationErrors } from '../types';

interface SignInStepProps {
  onBack: () => void;
  onForgotPassword: () => void;
  onSuccess: () => void;
  isSupabaseConfigured: boolean;
}

export function SignInStep({
  onBack,
  onForgotPassword,
  onSuccess,
  isSupabaseConfigured,
}: SignInStepProps) {
  const [form, setForm] = useState<SignInFormData>({
    email: '',
    password: '',
    showPassword: false,
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!form.email.trim()) {
      newErrors.email = 'אימייל הוא שדה חובה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }
    if (!form.password) {
      newErrors.password = 'סיסמה היא שדה חובה';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      if (!isSupabaseConfigured) {
        setGeneralError('כניסה לא זמינה — Supabase לא מוגדר');
        return;
      }

      setLoading(true);
      setGeneralError('');

      const { error } = await signIn(form.email.trim(), form.password);

      setLoading(false);

      if (error) {
        if (error.includes('Invalid login credentials') || error.includes('Invalid credentials')) {
          setGeneralError('אימייל או סיסמה שגויים');
        } else if (error.includes('Email not confirmed')) {
          setGeneralError('יש לאמת את כתובת הדוא"ל לפני התחברות');
        } else {
          logger.auth.warn('Unrecognized sign-in error', error);
          setGeneralError('אירעה שגיאה בלתי צפויה. יש לנסות שוב.');
        }
        return;
      }

      onSuccess();
    },
    [form, validate, isSupabaseConfigured, onSuccess]
  );

  return (
    <m.div key="signin" {...slideFromRight} className="flex flex-col">
      {/* Back button */}
      <div className="px-5 pt-5">
        <GhostLink onClick={onBack}>
          <ArrowLeft size={14} />
          חזרה
        </GhostLink>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <m.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-6 px-5 py-6 flex-1"
        >
          <m.div variants={staggerItem}>
            {/* Icon-in-colored-box with spring scale — shared confirmation motif */}
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-14 h-14 flex items-center justify-center mb-4"
              style={{ background: 'var(--fs-accent)', borderRadius: '22px 16px 22px 16px' }}
            >
              <LogIn size={26} style={{ color: 'var(--color-ink-on-accent)' }} aria-hidden="true" />
            </m.div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '28px',
                color: 'var(--fs-ink)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              התחברות
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
                letterSpacing: '-0.01em',
                marginTop: '6px',
              }}
            >
              משתמש קיים
            </p>
          </m.div>

          <m.div variants={staggerItem}>
            <AnnualInput
              label={'דוא"ל'}
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(val) => setForm((f) => ({ ...f, email: val }))}
              placeholder="your@email.com"
              icon={<Mail size={16} />}
              error={errors.email}
              autoComplete="email"
              enterKeyHint="next"
              autoFocus
            />
          </m.div>

          <m.div variants={staggerItem}>
            <AnnualPasswordInput
              label="סיסמה"
              value={form.password}
              onChange={(val) => setForm((f) => ({ ...f, password: val }))}
              placeholder="••••••••"
              error={errors.password}
              autoComplete="current-password"
              enterKeyHint="go"
            />
          </m.div>

          {/* Forgot password link */}
          <m.div variants={staggerItem}>
            <button
              type="button"
              onClick={onForgotPassword}
              className="transition-colors hover:opacity-80"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--fs-muted)',
                letterSpacing: '-0.01em',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              שכחתי סיסמה
            </button>
          </m.div>

          {/* General error — warm surface card with a trailing-edge accent bar */}
          {generalError && (
            <m.div
              variants={staggerItem}
              role="alert"
              className="p-4 flex items-start gap-3"
              style={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--color-error)',
                // Trailing edge in RTL is the inline-end (left); a thicker error
                // bar there gives the alert warmth without the sharp box look.
                borderInlineEndWidth: '4px',
                borderRadius: 'var(--radius-asymmetric)',
              }}
            >
              <AlertCircle
                size={18}
                style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '1px' }}
                aria-hidden="true"
              />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-error-fg)',
                  lineHeight: 1.5,
                }}
              >
                {generalError}
              </p>
            </m.div>
          )}

          {/* Supabase not configured notice */}
          {!isSupabaseConfigured && (
            <m.div
              variants={staggerItem}
              className="p-4"
              style={{
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.5,
                }}
              >
                Supabase not configured — login disabled. Add VITE_SUPABASE_URL and
                VITE_SUPABASE_ANON_KEY to .env
              </p>
            </m.div>
          )}
        </m.div>

        {/* Submit button */}
        <div className="px-5 pb-8">
          <Button
            variant="editorial"
            type="submit"
            isLoading={loading}
            disabled={loading}
            fullWidth
          >
            התחברות
          </Button>
        </div>
      </form>
    </m.div>
  );
}
