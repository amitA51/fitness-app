/**
 * STEP: SIGN UP (NEW USER)
 */

import { m } from 'framer-motion';
import { AlertCircle, ArrowLeft, Mail, MailOpen, User, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AnnualInput } from '../../../components/ui/AnnualInput';
import { AnnualPasswordInput } from '../../../components/ui/AnnualPasswordInput';
import { Button } from '../../../components/ui/Button';
import { resendSignUpConfirmation, signUp } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import { pageVariants, slideFromRight, staggerContainer, staggerItem } from '../animations';
import { GhostLink } from '../components/GhostLink';
import type { SignUpFormData, ValidationErrors } from '../types';

interface SignUpStepProps {
  onBack: () => void;
  isSupabaseConfigured: boolean;
}

// Resend throttle: block repeat taps for a short window after a successful send.
const RESEND_COOLDOWN_SECONDS = 30;
const RESEND_TICK_MS = 1000;

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
  // Resend recovery for the confirm dead-end: a short cooldown throttles repeat
  // taps; `resendStatus` drives an aria-live confirmation/error line.
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
        setGeneralError('הרשמה אינה זמינה כרגע — השירות אינו מוגדר');
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
          setGeneralError('אירעה שגיאה בלתי צפויה. יש לנסות שוב.');
        }
        return;
      }

      setConfirmSent(true);
    },
    [form, validate, isSupabaseConfigured]
  );

  // Tick the resend cooldown down to zero. One interval per active cooldown.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, RESEND_TICK_MS);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resendStatus === 'sending') return;
    setResendStatus('sending');
    const { error } = await resendSignUpConfirmation(form.email.trim());
    if (error) {
      logger.auth.warn('Resend confirmation failed', error);
      setResendStatus('error');
      return;
    }
    setResendStatus('sent');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }, [form.email, resendCooldown, resendStatus]);

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
            fontWeight: 600,
            fontSize: '28px',
            color: 'var(--fs-ink)',
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
          יש ללחוץ על הקישור בדוא"ל כדי להפעיל את החשבון
        </m.p>

        {/* Resend recovery — for an email that never arrived. aria-live so the
            screen reader announces the confirmation/error without a visual jump. */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8 w-full flex flex-col items-center gap-3"
        >
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendStatus === 'sending'}
            className="active:scale-[0.98] transition-transform disabled:active:scale-100"
            style={{
              minHeight: '44px',
              paddingInline: '8px',
              background: 'none',
              border: 'none',
              cursor: resendCooldown > 0 || resendStatus === 'sending' ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '-0.01em',
              color: resendCooldown > 0 ? 'var(--fs-muted)' : 'var(--fs-accent)',
              opacity: resendStatus === 'sending' ? 0.6 : 1,
            }}
          >
            {resendStatus === 'sending'
              ? 'שולחים…'
              : resendCooldown > 0
                ? `שליחה חוזרת בעוד ${resendCooldown} שנ׳`
                : 'לא קיבלתם? שלחו שוב'}
          </button>

          <p
            aria-live="polite"
            className="min-h-[18px]"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: resendStatus === 'error' ? 'var(--color-error)' : 'var(--fs-muted)',
              margin: 0,
            }}
          >
            {resendStatus === 'sent'
              ? 'הקישור נשלח שוב'
              : resendStatus === 'error'
                ? 'השליחה נכשלה. נסו שוב בעוד רגע.'
                : ''}
          </p>

          <Button variant="editorial-secondary" type="button" onClick={onBack} fullWidth={false}>
            חזרה
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
            {/* Icon-in-colored-box with spring scale — shared confirmation motif */}
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-14 h-14 flex items-center justify-center mb-4"
              style={{ background: 'var(--fs-accent)', borderRadius: '22px 16px 22px 16px' }}
            >
              <UserPlus
                size={26}
                style={{ color: 'var(--color-ink-on-accent)' }}
                aria-hidden="true"
              />
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
              חשבון חדש
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
              enterKeyHint="next"
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
              enterKeyHint="next"
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
              enterKeyHint="next"
              showStrength
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
              enterKeyHint="go"
            />
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
