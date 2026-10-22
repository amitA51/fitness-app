// ============================================================================
// Login steps — what the user sees when sign-up / sign-in meet a real server.
// ============================================================================
// The live project confirms addresses automatically: signUp returns a session
// and sends NO email. The step used to show "check your email" with a resend
// button anyway — a dead end. And every server failure that was not a wrong
// password read "unexpected error", even when the server simply did not answer.
// ============================================================================

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signUp, signIn, resendSignUpConfirmation } = vi.hoisted(() => {
  // login/animations reads prefers-reduced-motion at import time; jsdom has no
  // matchMedia.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return { signUp: vi.fn(), signIn: vi.fn(), resendSignUpConfirmation: vi.fn() };
});

vi.mock('../../../../services/supabaseAuth', () => ({ signUp, signIn, resendSignUpConfirmation }));
vi.mock('../../../../utils/logger', () => ({
  logger: { auth: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

import { SignInStep } from '../SignInStep';
import { SignUpStep } from '../SignUpStep';

const fillSignUp = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('שם מלא'), 'דנה כהן');
  await user.type(screen.getByLabelText('דוא"ל'), 'dana@example.com');
  await user.type(screen.getByLabelText('סיסמה'), 'Strong1234');
  await user.type(screen.getByLabelText('אישור סיסמה'), 'Strong1234');
  await user.click(screen.getByRole('button', { name: 'צור חשבון' }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignUpStep', () => {
  it('goes straight into the app when sign-up already signed the user in', async () => {
    signUp.mockResolvedValue({
      user: { id: 'u1' },
      session: { access_token: 't', user: { id: 'u1' } },
      error: null,
      errorKind: null,
    });
    const onSuccess = vi.fn();
    render(<SignUpStep onBack={vi.fn()} onSuccess={onSuccess} isSupabaseConfigured />);

    await fillSignUp();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('בדוק את הדוא"ל שלך')).not.toBeInTheDocument();
  });

  it('asks to check the inbox only when the account still needs confirming', async () => {
    signUp.mockResolvedValue({ user: { id: 'u1' }, session: null, error: null, errorKind: null });
    const onSuccess = vi.fn();
    render(<SignUpStep onBack={vi.fn()} onSuccess={onSuccess} isSupabaseConfigured />);

    await fillSignUp();

    expect(await screen.findByText('בדוק את הדוא"ל שלך')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('says the address is taken instead of promising an email', async () => {
    signUp.mockResolvedValue({
      user: null,
      session: null,
      error: 'User already registered',
      errorKind: 'already_registered',
    });
    render(<SignUpStep onBack={vi.fn()} onSuccess={vi.fn()} isSupabaseConfigured />);

    await fillSignUp();

    expect(await screen.findByRole('alert')).toHaveTextContent('כתובת אימייל זו כבר רשומה');
  });
});

describe('SignInStep', () => {
  const signInWith = async () => {
    const user = userEvent.setup();
    render(
      <SignInStep
        onBack={vi.fn()}
        onForgotPassword={vi.fn()}
        onSuccess={vi.fn()}
        isSupabaseConfigured
      />
    );
    await user.type(screen.getByLabelText('דוא"ל'), 'dana@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'whatever1');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
  };

  it('tells a server outage apart from a wrong password, and stops spinning', async () => {
    signIn.mockResolvedValue({ user: null, error: 'Failed to fetch', errorKind: 'unreachable' });

    await signInWith();

    expect(await screen.findByRole('alert')).toHaveTextContent('השרת לא עונה כרגע');
    expect(screen.getByRole('button', { name: 'התחברות' })).not.toBeDisabled();
  });

  it('keeps the wrong-password wording', async () => {
    signIn.mockResolvedValue({
      user: null,
      error: 'Invalid login credentials',
      errorKind: 'invalid_credentials',
    });

    await signInWith();

    expect(await screen.findByRole('alert')).toHaveTextContent('אימייל או סיסמה שגויים');
  });
});
