/**
 * STEP: SIGN UP (NEW USER)
 */

import { m } from 'framer-motion';
import { AlertCircle, ArrowLeft, Mail, MailOpen, User } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AnnualInput } from '../../../components/ui/AnnualInput';
import { AnnualPasswordInput } from '../../../components/ui/AnnualPasswordInput';
import { Button } from '../../../components/ui/Button';
import { signUp } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import { pageVariants, slideFromRight, staggerContainer, staggerItem } from '../animations';
import { GhostLink } from '../components/GhostLink';
import type { SignUpFormData, ValidationErrors } from '../types';

interface SignUpStepProps {
  onBack: () => void;
  isSupabaseConfigured: boolean;
}

export function SignUpStep({ onBack, isSupabaseConfigured }: SignUpStepProps) {
  const [form, setForm] = useState<SignUpFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!form.fullName.trim()) {
      newErrors.fullName = 'שם מלא הוא שדה חובה';
    } else if (form.fullName.trim().length < 2) {
      newErrors.fullName = 'שם חייב להכיל לפחות 2 תווים';
    }
    if (!form.email.trim()) {
      newErrors.email = 'אימייל הוא שדה חובה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }
    if (!form.password) {
      newErrors.password = 'סיסמה היא שדה חובה';
    } else if (form.password.length < 8) {
      newErrors.password = 'סיסמה חייבת להכיל לפחות 8 תווים';
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'נא לאמת את הסיסמה';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      if (!isSupabaseConfigured) {
        setGeneralError('Sign up disabled — configure Supabase');
        return;
      }

      setLoading(true);
      setGeneralError('');

      const { error } = await signUp(form.email.trim(), form.password, {
        full_name: form.fullName.trim(),
      });

      setLoading(false);

      if (error) {
        if (error.includes('already registered') || error.includes('already exists')) {
          setGeneralError('כתובת אימייל זו כבר רשומה');
        } else {
          logger.auth.warn('Unrecognized sign-up error', error);
          setGeneralError('אירעה שגיאה בלתי צפויה. נסה שוב.');
        }
        return;
      }

      setConfirmSent(true);
    },
    [form, validate, isSupabaseConfigured]
  );

  if (confirmSent) {
    return (
      <m.div
        key="confirm-sent"
        {...pageVariants}
        className="flex flex-col items-center justify-center flex-1 px-5 py-8 text-center"
      >
        <m.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 flex items-center justify-center mb-6"
          style={{ background: 'var(--fs-accent)', borderRadius: '22px 16px 22px 16px' }}
        >
          <MailOpen size={36} style={{ color: 'var(--color-ink-on-accent)' }} />
        </m.div>

        <m.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '28px',
            color: 'var(--fs-ink)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
          }}
        >
          בדוק את הדוא"ל שלך
        </m.h2>

        <m.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            color: 'var(--fs-muted)',
            lineHeight: 1.6,
            marginBottom: '8px',
          }}
        >
          שלחנו קישור אימות אל
        </m.p>

        <m.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--fs-ink)',
            fontWeight: 600,
            marginBottom: '32px',
            wordBreak: 'break-all',
          }}
        >
          {form.email}
        </m.p>

        <m.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            lineHeight: 1.5,
          }}
        >
          לחץ על הקישור בדוא"ל כדי להפעיל את החשבון
        </m.p>

        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Button variant="editorial-secondary" type="button" onClick={onBack} fullWidth={false}>
            חזרה להתחברות
          </Button>
        </m.div>
      </m.div>
    );
  }

  return (
    <m.div key="signup" {...slideFromRight} className="flex flex-col">
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
          className="flex flex-col gap-5 px-5 py-6 flex-1"
        >
          <m.div variants={staggerItem}>
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
              חשבון חדש
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
              צור את החשבון שלך
            </p>
          </m.div>

          {/* Chapter-style section marker */}
          <m.div variants={staggerItem} className="flex items-center gap-3 mt-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--fs-muted)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              פרופיל
            </span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--fs-surface-2)' }} />
          </m.div>

          <m.div variants={staggerItem}>
            <AnnualInput
              label="שם מלא"
              type="text"
              value={form.fullName}
              onChange={(val) => setForm((f) => ({ ...f, fullName: val }))}
              placeholder="ישראל ישראלי"
              icon={<User size={16} />}
              error={errors.fullName}
              autoComplete="name"
              autoFocus
            />
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
            />
          </m.div>

          {/* Password section */}
          <m.div variants={staggerItem} className="flex items-center gap-3 mt-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--fs-muted)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              אבטחה
            </span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--fs-surface-2)' }} />
          </m.div>

          <m.div variants={staggerItem}>
            <AnnualPasswordInput
              label="סיסמה"
              value={form.password}
              onChange={(val) => setForm((f) => ({ ...f, password: val }))}
              placeholder="לפחות 8 תווים"
              error={errors.password}
              autoComplete="new-password"
            />
          </m.div>

          <m.div variants={staggerItem}>
            <AnnualPasswordInput
              label="אישור סיסמה"
              value={form.confirmPassword}
              onChange={(val) => setForm((f) => ({ ...f, confirmPassword: val }))}
              placeholder="הזן שוב את הסיסמה"
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </m.div>

          {/* General error */}
          {generalError && (
            <m.div
              variants={staggerItem}
              role="alert"
              className="p-4 flex items-start gap-3"
              style={{
                background: 'var(--color-error-muted)',
                border: '1px solid var(--color-error)',
                borderRadius: 0,
              }}
            >
              <AlertCircle
                size={16}
                style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-error)',
                  lineHeight: 1.4,
                }}
              >
                {generalError}
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
            צור חשבון
          </Button>
        </div>
      </form>
    </m.div>
  );
}
