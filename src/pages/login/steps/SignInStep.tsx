/**
 * STEP: SIGN IN CREDENTIALS
 */

import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
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
          setGeneralError('אירעה שגיאה בלתי צפויה. נסה שוב.');
        }
        return;
      }

      onSuccess();
    },
    [form, validate, isSupabaseConfigured, onSuccess]
  );

  return (
    <motion.div key="signin" {...slideFromRight} className="flex flex-col">
      {/* Back button */}
      <div className="px-5 pt-5">
        <GhostLink onClick={onBack}>
          <ArrowLeft size={14} />
          חזרה
        </GhostLink>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-6 px-5 py-6 flex-1"
        >
          <motion.div variants={staggerItem}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '28px',
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
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
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '6px',
              }}
            >
              משתמש קיים
            </p>
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualInput
              label={'דוא"ל'}
              type="email"
              value={form.email}
              onChange={(val) => setForm((f) => ({ ...f, email: val }))}
              placeholder="your@email.com"
              icon={<Mail size={16} />}
              error={errors.email}
              autoComplete="email"
              autoFocus
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualPasswordInput
              label="סיסמה"
              value={form.password}
              onChange={(val) => setForm((f) => ({ ...f, password: val }))}
              placeholder="••••••••"
              error={errors.password}
            />
          </motion.div>

          {/* Forgot password link */}
          <motion.div variants={staggerItem}>
            <button
              type="button"
              onClick={onForgotPassword}
              className="transition-colors hover:opacity-80"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--fs-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              שכחתי סיסמה
            </button>
          </motion.div>

          {/* General error */}
          {generalError && (
            <motion.div
              variants={staggerItem}
              className="p-4 flex items-start gap-3"
              style={{
                background: 'rgba(226, 110, 63, 0.12)',
                border: '1px solid var(--fs-warn)',
                borderRadius: 0,
              }}
            >
              <AlertCircle
                size={16}
                style={{ color: 'var(--fs-warn)', flexShrink: 0, marginTop: '2px' }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--fs-warn)',
                  lineHeight: 1.4,
                }}
              >
                {generalError}
              </p>
            </motion.div>
          )}

          {/* Supabase not configured notice */}
          {!isSupabaseConfigured && (
            <motion.div
              variants={staggerItem}
              className="p-4"
              style={{
                background: 'var(--fs-accent)',
                color: 'var(--fs-heading)',
                borderRadius: 0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1.5,
                }}
              >
                Supabase not configured — login disabled. Add VITE_SUPABASE_URL and
                VITE_SUPABASE_ANON_KEY to .env
              </p>
            </motion.div>
          )}
        </motion.div>

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
    </motion.div>
  );
}
