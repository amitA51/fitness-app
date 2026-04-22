/**
 * SPORT ANNUAL — Login Page
 * Sign In / Sign Up with Supabase Auth
 * Bold · Editorial · Confident · Narrative · Printed
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailOpen,
  User,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  initSupabaseAuth,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
} from '../services/supabaseAuth';
import { cn } from '../utils/styles';

// ============================================================================
// TYPES
// ============================================================================

type FormStep = 'choice' | 'credentials' | 'new-user-form' | 'forgot-password' | 'success';

interface SignInFormData {
  email: string;
  password: string;
  showPassword: boolean;
}

interface SignUpFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
}

interface ForgotPasswordFormData {
  email: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  fullName?: string;
  confirmPassword?: string;
  general?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: [0.55, 0.06, 0.68, 0.19] } },
};

const slideFromRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.25, ease: [0.55, 0.06, 0.68, 0.19] } },
};

const slideFromLeft = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.25, ease: [0.55, 0.06, 0.68, 0.19] } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

// ============================================================================
// ANNUAL DESIGN — INPUT COMPONENTS
// ============================================================================

interface AnnualInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
}

const AnnualInput = memo(function AnnualInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  suffix,
  error,
  disabled,
  autoComplete,
  autoFocus,
}: AnnualInputProps) {
  return (
    <div className="w-full">
      <label
        className="block section-title mb-2"
        style={{ color: 'var(--stone)', letterSpacing: '0.18em' }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--stone)' }}
          >
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={cn(
            'w-full h-14 bg-white border-2 transition-all duration-200',
            'font-[IBM_Plex_Sans,var(--font-body)] text-base text-[var(--ink)]',
            'placeholder:text-[var(--stone-light)]',
            'focus:outline-none',
            icon ? 'pl-12 pr-4' : 'px-4',
            suffix ? 'pr-12' : '',
            error
              ? 'border-[var(--color-error)] focus:shadow-[0_0_0_3px_var(--color-error-muted)]'
              : 'border-[var(--bone-deep)] focus:border-[var(--navy)] focus:shadow-[0_0_0_3px_rgba(232,184,45,0.3)]',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          )}
          style={{
            borderRadius: 0,
            fontFamily: 'var(--font-body)',
          }}
        />
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
      {error && (
        <p
          className="mt-1.5 flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-error)',
            letterSpacing: '0.05em',
          }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
});

// ============================================================================
// ANNUAL DESIGN — PASSWORD INPUT
// ============================================================================

interface AnnualPasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const AnnualPasswordInput = memo(function AnnualPasswordInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  autoFocus,
}: AnnualPasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="w-full">
      <label
        className="block section-title mb-2"
        style={{ color: 'var(--stone)', letterSpacing: '0.18em' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={label === 'Password' ? 'current-password' : 'new-password'}
          className={cn(
            'w-full h-14 bg-white border-2 transition-all duration-200',
            'font-[IBM_Plex_Sans,var(--font-body)] text-base text-[var(--ink)]',
            'placeholder:text-[var(--stone-light)]',
            'focus:outline-none pr-12',
            error
              ? 'border-[var(--color-error)] focus:shadow-[0_0_0_3px_var(--color-error-muted)]'
              : 'border-[var(--bone-deep)] focus:border-[var(--navy)] focus:shadow-[0_0_0_3px_rgba(232,184,45,0.3)]',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          )}
          style={{
            borderRadius: 0,
            fontFamily: 'var(--font-body)',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: 'var(--stone)' }}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p
          className="mt-1.5 flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-error)',
            letterSpacing: '0.05em',
          }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
});

// ============================================================================
// ANNUAL DESIGN — PRIMARY BUTTON
// ============================================================================

interface AnnualButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  fullWidth?: boolean;
}

const AnnualButton = memo(function AnnualButton({
  children,
  onClick,
  type = 'button',
  disabled,
  loading,
  variant = 'primary',
  className,
  fullWidth = true,
}: AnnualButtonProps) {
  const baseClasses = cn(
    'h-[52px] px-6 font-[var(--font-display)] font-[var(--font-extrabold)] text-base',
    'tracking-[0.08em] uppercase transition-all duration-150',
    'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
    'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
    'flex items-center justify-center gap-3',
    fullWidth ? 'w-full' : '',
    className
  );

  if (variant === 'primary') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(baseClasses, 'bg-[var(--navy)] text-[var(--mustard)]')}
        style={{ borderRadius: 0 }}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        ) : null}
        {children}
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(baseClasses, 'bg-[var(--bone)] text-[var(--navy)] border-2 border-[var(--navy)]')}
        style={{ borderRadius: 0 }}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        ) : null}
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(baseClasses, 'bg-transparent text-[var(--navy)]')}
      style={{ borderRadius: 0 }}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
      ) : null}
      {children}
    </button>
  );
});

// ============================================================================
// ANNUAL DESIGN — GHOST LINK BUTTON
// ============================================================================

interface GhostLinkProps {
  children: React.ReactNode;
  onClick?: () => void;
}

function GhostLink({ children, onClick }: GhostLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 transition-colors"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--stone)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        minHeight: '44px',
        minWidth: '44px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// MASTHEAD — top editorial header
// ============================================================================

function Masthead() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full py-6 px-5"
      style={{ background: 'var(--navy)' }}
    >
      {/* Logo + Brand */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 flex items-center justify-center"
          style={{ background: 'var(--mustard)' }}
        >
          <Dumbbell size={24} style={{ color: 'var(--color-on-mustard)' }} aria-hidden="true" />
        </div>
        <div>
          <h1
            className="leading-none tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '28px',
              color: 'var(--bone)',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
            }}
          >
            SPARKOS
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--mustard)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            Annual Report · Fitness
          </p>
        </div>
      </div>

    </motion.div>
  );
}

// ============================================================================
// STEP: CHOICE (Sign In vs Sign Up)
// ============================================================================

interface ChoiceStepProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onGuest: () => void;
}

function ChoiceStep({ onSignIn, onSignUp, onGuest }: ChoiceStepProps) {
  return (
    <motion.div
      key="choice"
      {...slideFromRight}
      className="flex flex-col gap-6 px-5 py-8"
    >
      {/* Sign In Card */}
      <motion.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignIn}
        className="card-outlined text-right group"
        style={{ cursor: 'pointer', background: 'var(--bone)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: 'var(--navy)' }}
            >
              <Lock size={20} style={{ color: 'var(--mustard)' }} aria-hidden="true" />
            </div>
            <div>
              <h3
                className="mb-0.5"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--navy)',
                  textTransform: 'uppercase',
                }}
              >
                Sign In
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--stone)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Existing User
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:translate-x-1"
            style={{ background: 'var(--bone-deep)' }}
          >
            <ChevronRight size={18} style={{ color: 'var(--navy)' }} aria-hidden="true" />
          </div>
        </div>
      </motion.button>

      {/* Sign Up Card */}
      <motion.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onSignUp}
        className="card-outlined text-right group"
        style={{ cursor: 'pointer', background: 'var(--bone)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: 'var(--mustard)' }}
            >
              <User size={20} style={{ color: 'var(--color-on-mustard)' }} aria-hidden="true" />
            </div>
            <div>
              <h3
                className="mb-0.5"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--navy)',
                  textTransform: 'uppercase',
                }}
              >
                Sign Up
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--stone)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Create New Account
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 flex items-center justify-center transition-transform group-hover:translate-x-1"
            style={{ background: 'var(--bone-deep)' }}
          >
            <ChevronRight size={18} style={{ color: 'var(--navy)' }} aria-hidden="true" />
          </div>
        </div>
      </motion.button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1" style={{ height: '1px', background: 'var(--bone-deep)' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--stone)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Or
        </span>
        <div className="flex-1" style={{ height: '1px', background: 'var(--bone-deep)' }} />
      </div>

      {/* Guest Button */}
      <motion.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={onGuest}
        className="w-full h-14 bg-[var(--bone-deep)] border-2 flex items-center justify-center gap-3 transition-all hover:bg-[var(--bone-faint)] active:scale-[0.98]"
        style={{
          borderColor: 'var(--bone-deep)',
          borderRadius: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '15px',
          color: 'var(--navy)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: 'pointer',
        }}
      >
        Continue as Guest
      </motion.button>

      {/* Google OAuth */}
      <motion.button
        variants={staggerItem}
        initial="initial"
        animate="animate"
        onClick={async () => {
          const { error } = await signInWithGoogle();
          if (error) {
            // Handle error - could use a toast here
          }
        }}
        className="w-full h-14 bg-white border-2 flex items-center justify-center gap-3 transition-all hover:bg-[var(--bone-faint)] active:scale-[0.98]"
        style={{
          borderColor: 'var(--bone-deep)',
          borderRadius: 0,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '15px',
          color: 'var(--ink)',
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
        Continue with Google
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// STEP: SIGN IN CREDENTIALS
// ============================================================================

interface SignInStepProps {
  onBack: () => void;
  onForgotPassword: () => void;
  onSuccess: () => void;
  isSupabaseConfigured: boolean;
}

function SignInStep({ onBack, onForgotPassword, onSuccess, isSupabaseConfigured }: SignInStepProps) {
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
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!form.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      if (!isSupabaseConfigured) {
        setGeneralError('Login disabled — configure Supabase');
        return;
      }

      setLoading(true);
      setGeneralError('');

      const { error } = await signIn(form.email.trim(), form.password);

      setLoading(false);

      if (error) {
        if (error.includes('Invalid login credentials') || error.includes('Invalid credentials')) {
          setGeneralError('Invalid email or password');
        } else if (error.includes('Email not confirmed')) {
          setGeneralError('Please verify your email before signing in');
        } else {
          setGeneralError(error);
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
          Back
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
                fontWeight: 900,
                fontSize: '32px',
                color: 'var(--navy)',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
              }}
            >
              Sign In
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--stone)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '6px',
              }}
            >
              Existing User
            </p>
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualInput
              label="Email"
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
              label="Password"
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
                color: 'var(--stone)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Forgot Password?
            </button>
          </motion.div>

          {/* General error */}
          {generalError && (
            <motion.div
              variants={staggerItem}
              className="p-4 flex items-start gap-3"
              style={{ background: 'var(--color-error-muted)', borderLeft: '3px solid var(--color-error)' }}
            >
              <AlertCircle size={16} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }} />
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
            </motion.div>
          )}

          {/* Supabase not configured notice */}
          {!isSupabaseConfigured && (
            <motion.div
              variants={staggerItem}
              className="p-4"
              style={{
                background: 'var(--mustard)',
                color: 'var(--color-on-mustard)',
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
                Supabase not configured — login disabled. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Submit button */}
        <div className="px-5 pb-8">
          <AnnualButton type="submit" loading={loading} disabled={loading}>
            Sign In
          </AnnualButton>
        </div>
      </form>
    </motion.div>
  );
}

// ============================================================================
// STEP: SIGN UP (NEW USER)
// ============================================================================

interface SignUpStepProps {
  onBack: () => void;
  isSupabaseConfigured: boolean;
}

function SignUpStep({ onBack, isSupabaseConfigured }: SignUpStepProps) {
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
      newErrors.fullName = 'Full name is required';
    } else if (form.fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
          setGeneralError('This email is already registered');
        } else {
          setGeneralError(error);
        }
        return;
      }

      setConfirmSent(true);
    },
    [form, validate, isSupabaseConfigured]
  );

  if (confirmSent) {
    return (
      <motion.div
        key="confirm-sent"
        {...pageVariants}
        className="flex flex-col items-center justify-center flex-1 px-5 py-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 flex items-center justify-center mb-6"
          style={{ background: 'var(--mustard)' }}
        >
          <MailOpen size={36} style={{ color: 'var(--color-on-mustard)' }} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '28px',
            color: 'var(--navy)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
          }}
        >
          Check Your Email
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            color: 'var(--stone)',
            lineHeight: 1.6,
            marginBottom: '8px',
          }}
        >
          We sent a verification link to</motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--navy)',
            fontWeight: 600,
            marginBottom: '32px',
            wordBreak: 'break-all',
          }}
        >
          {form.email}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--stone)',
            lineHeight: 1.5,
          }}
        >
          Click the link in the email to activate your account
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <AnnualButton variant="secondary" onClick={onBack} fullWidth={false}>
            Back to Sign In
          </AnnualButton>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div key="signup" {...slideFromRight} className="flex flex-col">
      {/* Back button */}
      <div className="px-5 pt-5">
        <GhostLink onClick={onBack}>
          <ArrowLeft size={14} />
          Back
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
                fontWeight: 900,
                fontSize: '32px',
                color: 'var(--navy)',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
              }}
            >
              New Account
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--stone)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '6px',
              }}
            >
              Create Your Account
            </p>
          </motion.div>

          {/* Chapter-style section marker */}
          <motion.div variants={staggerItem} className="flex items-center gap-3 mt-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--mustard)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              §01 · Profile
            </span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--bone-deep)' }} />
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualInput
              label="Full Name"
              type="text"
              value={form.fullName}
              onChange={(val) => setForm((f) => ({ ...f, fullName: val }))}
              placeholder="John Smith"
              icon={<User size={16} />}
              error={errors.fullName}
              autoComplete="name"
              autoFocus
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualInput
              label="Email"
              type="email"
              value={form.email}
              onChange={(val) => setForm((f) => ({ ...f, email: val }))}
              placeholder="your@email.com"
              icon={<Mail size={16} />}
              error={errors.email}
              autoComplete="email"
            />
          </motion.div>

          {/* Password section */}
          <motion.div variants={staggerItem} className="flex items-center gap-3 mt-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--mustard)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              §02 · Security
            </span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--bone-deep)' }} />
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualPasswordInput
              label="Password"
              value={form.password}
              onChange={(val) => setForm((f) => ({ ...f, password: val }))}
              placeholder="6+ characters"
              error={errors.password}
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnnualPasswordInput
              label="Confirm Password"
              value={form.confirmPassword}
              onChange={(val) => setForm((f) => ({ ...f, confirmPassword: val }))}
              placeholder="Re-enter your password"
              error={errors.confirmPassword}
            />
          </motion.div>

          {/* General error */}
          {generalError && (
            <motion.div
              variants={staggerItem}
              className="p-4 flex items-start gap-3"
              style={{ background: 'var(--color-error-muted)', borderLeft: '3px solid var(--color-error)' }}
            >
              <AlertCircle size={16} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }} />
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
            </motion.div>
          )}
        </motion.div>

        {/* Submit button */}
        <div className="px-5 pb-8">
          <AnnualButton type="submit" loading={loading} disabled={loading}>
            Create Account
          </AnnualButton>
        </div>
      </form>
    </motion.div>
  );
}

// ============================================================================
// STEP: FORGOT PASSWORD
// ============================================================================

interface ForgotPasswordStepProps {
  onBack: () => void;
}

function ForgotPasswordStep({ onBack }: ForgotPasswordStepProps) {
  const [form, setForm] = useState<ForgotPasswordFormData>({ email: '' });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
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
          style={{ background: 'var(--color-success)' }}
        >
          <Check size={36} style={{ color: 'white' }} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '28px',
            color: 'var(--navy)',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          Reset Sent!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            color: 'var(--stone)',
            lineHeight: 1.6,
          }}
        >
          We sent a password reset link to
          <br />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--navy)', fontWeight: 600 }}>
            {form.email}
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <AnnualButton variant="secondary" onClick={onBack} fullWidth={false}>
            Back to Sign In
          </AnnualButton>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div key="forgot" {...slideFromLeft} className="flex flex-col">
      <div className="px-5 pt-5">
        <GhostLink onClick={onBack}>
          <ArrowLeft size={14} />
          Back
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
                fontWeight: 900,
                fontSize: '28px',
                color: 'var(--navy)',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
              }}
            >
              Forgot Password?
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--stone)',
                marginTop: '8px',
                lineHeight: 1.5,
              }}
            >
              We'll send a reset link to your email
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
              style={{ background: 'var(--color-error-muted)', borderLeft: '3px solid var(--color-error)' }}
            >
              <AlertCircle size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-error)' }}>
                {errors.general}
              </p>
            </motion.div>
          )}
        </motion.div>

        <div className="px-5 pb-8">
          <AnnualButton type="submit" loading={loading} disabled={loading}>
            Send Reset Link
          </AnnualButton>
        </div>
      </form>
    </motion.div>
  );
}

// ============================================================================
// MAIN LOGIN PAGE COMPONENT
// ============================================================================

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<FormStep>('choice');
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);

  useEffect(() => {
    initSupabaseAuth();
    import('../lib/supabase').then(({ isSupabaseConfigured }) => {
      setIsSupabaseConfigured(isSupabaseConfigured());
    });
  }, []);

  const handleSuccess = useCallback(() => {
    // Clear onboarding flag and redirect
    navigate('/', { replace: true });
  }, [navigate]);

  const handleSignIn = useCallback(() => {
    setStep('credentials');
  }, []);

  const handleSignUp = useCallback(() => {
    setStep('new-user-form');
  }, []);

  const handleGuest = useCallback(() => {
    // Dispatch event so App.tsx can skip auth + onboarding and go straight to app
    window.dispatchEvent(new CustomEvent('skip_auth'));
  }, []);

  const handleBack = useCallback(() => {
    setStep('choice');
  }, []);

  const handleForgotPassword = useCallback(() => {
    setStep('forgot-password');
  }, []);

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col"
      style={{ background: 'var(--bone)' }}
      dir="rtl"
    >
      {/* Skip link */}
      <a href="#main-content" className="skip-link" style={{ top: '-100%' }}>
        Skip to content
      </a>

      {/* Masthead */}
      <Masthead />

      {/* Main content */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ background: 'var(--bone)' }}
      >
        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <ChoiceStep key="choice" onSignIn={handleSignIn} onSignUp={handleSignUp} onGuest={handleGuest} />
          )}
          {step === 'credentials' && (
            <SignInStep
              key="signin"
              onBack={handleBack}
              onForgotPassword={handleForgotPassword}
              onSuccess={handleSuccess}
              isSupabaseConfigured={isSupabaseConfigured}
            />
          )}
          {step === 'new-user-form' && (
            <SignUpStep
              key="signup"
              onBack={handleBack}
              isSupabaseConfigured={isSupabaseConfigured}
            />
          )}
          {step === 'forgot-password' && (
            <ForgotPasswordStep key="forgot" onBack={handleBack} />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="px-5 py-6 text-center"
        style={{ background: 'var(--navy)' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'rgba(var(--text-on-navy-rgb), 0.4)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          SPARKOS · Annual Report · 2026
        </p>
      </motion.footer>
    </div>
  );
}
