/**
 * SPARKOS FITNESS — Login Page
 * Sign In / Sign Up with Supabase Auth
 * Fresh Steel Design — Minimal, Action-oriented
 *
 * Step-router shell: owns step state + auth navigation handlers and
 * renders the step components from ./login/steps.
 */

import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { initSupabaseAuth } from '../services/supabaseAuth';
import { Masthead } from './login/components/Masthead';
import { ChoiceStep } from './login/steps/ChoiceStep';
import { ForgotPasswordStep } from './login/steps/ForgotPasswordStep';
import { SignInStep } from './login/steps/SignInStep';
import { SignUpStep } from './login/steps/SignUpStep';
import type { FormStep } from './login/types';

// ============================================================================
// MAIN LOGIN PAGE COMPONENT
// ============================================================================

export default function LoginPage() {
  const navigate = useNavigate();
  const { skipAuth } = useAuth();
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
    skipAuth();
  }, [skipAuth]);

  const handleBack = useCallback(() => {
    setStep('choice');
  }, []);

  const handleForgotPassword = useCallback(() => {
    setStep('forgot-password');
  }, []);

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col ambient-mesh ambient-mesh-strong"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
      lang="he"
    >
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        דלג לתוכן
      </a>

      {/* Brand lockup. Static accent dot — NOT an animated/lime "live" status
          dot (anti-slop: no blinking live indicators; lime is PR-only). */}
      <div
        className="absolute z-20 flex items-center gap-2"
        style={{
          top: 'max(12px, env(safe-area-inset-top, 12px))',
          insetInlineEnd: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--fs-accent)',
            flexShrink: 0,
          }}
        />
        SparkOS
      </div>

      {/* Masthead */}
      <Masthead />

      {/* Main content */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ background: 'var(--fs-bg)' }}
      >
        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <ChoiceStep
              key="choice"
              onSignIn={handleSignIn}
              onSignUp={handleSignUp}
              onGuest={handleGuest}
            />
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
          {step === 'forgot-password' && <ForgotPasswordStep key="forgot" onBack={handleBack} />}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="px-5 py-6 text-center" style={{ background: 'var(--fs-primary)' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            // on-navy tint, not fs-muted — muted is 2.1:1 on the navy footer band
            color: 'rgba(var(--text-on-navy-rgb), 0.6)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          SPARKOS · יומן אימונים · 2026
        </p>
      </footer>
    </div>
  );
}
