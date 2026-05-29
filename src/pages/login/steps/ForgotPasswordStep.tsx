/**
 * STEP: FORGOT PASSWORD
 */

import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Check, Mail } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AnnualInput } from '../../../components/ui/AnnualInput';
import { Button } from '../../../components/ui/Button';
import { resetPassword } from '../../../services/supabaseAuth';
import { pageVariants, slideFromLeft, staggerContainer, staggerItem } from '../animations';
import { GhostLink } from '../components/GhostLink';
import type { ForgotPasswordFormData, ValidationErrors } from '../types';

interface ForgotPasswordStepProps {
  onBack: () => void;
}

export function ForgotPasswordStep({ onBack }: ForgotPasswordStepProps) {
  const [form, setForm] = useState<ForgotPasswordFormData>({ email: '' });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!form.email.trim()) {
      newErrors.email = 'אימייל הוא שדה חובה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      const { error } = await resetPassword(form.email.trim());
      setLoading(false);

      if (error) {
        setErrors({ general: error });
        return;
      }

      setSent(true);
    },
    [form, validate]
  );

  if (sent) {
    return (
      <motion.div
        key="reset-sent"
        {...pageVariants}
        className="flex flex-col items-center justify-center flex-1 px-5 py-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 flex items-center justify-center mb-6"
          style={{ background: 'var(--fs-accent)', borderRadius: '22px 16px 22px 16px' }}
        >
          <Check size={36} style={{ color: 'var(--fs-heading)' }} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '28px',
            color: 'var(--fs-ink)',
            marginBottom: '12px',
          }}
        >
          קישור נשלח!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            color: 'var(--fs-muted)',
            lineHeight: 1.6,
          }}
        >
          שלחנו קישור לאיפוס סיסמה אל
          <br />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fs-ink)', fontWeight: 600 }}>
            {form.email}
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Button variant="editorial-secondary" type="button" onClick={onBack} fullWidth={false}>
            חזרה להתחברות
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div key="forgot" {...slideFromLeft} className="flex flex-col">
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
          className="flex flex-col gap-5 px-5 py-6 flex-1"
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
              שכחת סיסמה?
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--fs-muted)',
                marginTop: '8px',
                lineHeight: 1.5,
              }}
            >
              נשלח קישור לאיפוס לדוא"ל שלך
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

          {errors.general && (
            <motion.div
              variants={staggerItem}
              className="p-4 flex items-start gap-3"
              style={{
                background: 'rgba(226, 110, 63, 0.12)',
                border: '1px solid var(--fs-warn)',
                borderRadius: 0,
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--fs-warn)', flexShrink: 0 }} />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--fs-warn)',
                }}
              >
                {errors.general}
              </p>
            </motion.div>
          )}
        </motion.div>

        <div className="px-5 pb-8">
          <Button
            variant="editorial"
            type="submit"
            isLoading={loading}
            disabled={loading}
            fullWidth
          >
            שלח קישור איפוס
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
