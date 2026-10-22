import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Which sign-in buttons the login screen offers, per App Store guideline 4.8:
// in the iOS app Google may appear only next to Sign in with Apple.

vi.hoisted(() => {
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
});

let platform: 'ios' | 'android' | 'web' = 'web';
const signInWithGoogle = vi.fn(async () => ({ user: null, error: null, errorKind: null }));
const signInWithApple = vi.fn(async () => ({ user: null, error: null, errorKind: null }));

vi.mock('../../../../utils/platform', () => ({ getPlatform: () => platform }));
vi.mock('../../../../services/supabaseAuth', () => ({
  signInWithGoogle: () => signInWithGoogle(),
  signInWithApple: () => signInWithApple(),
}));
vi.mock('../../../../services/sessionDb', () => ({ getAllWorkoutSessions: async () => [] }));

import { ChoiceStep } from '../ChoiceStep';

const renderChoice = () =>
  render(
    <LazyMotion features={domMax}>
      <ChoiceStep onSignIn={vi.fn()} onSignUp={vi.fn()} onGuest={vi.fn()} />
    </LazyMotion>
  );

describe('ChoiceStep sign-in providers', () => {
  beforeEach(() => {
    platform = 'web';
    signInWithGoogle.mockClear();
    signInWithApple.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('offers Google on the web and Android, without Apple until it is set up', () => {
    renderChoice();
    expect(screen.getByRole('button', { name: 'המשך עם Google' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'המשך עם Apple' })).not.toBeInTheDocument();
  });

  it('hides Google in the iOS app while Sign in with Apple is not available', () => {
    platform = 'ios';
    renderChoice();
    expect(screen.queryByRole('button', { name: 'המשך עם Google' })).not.toBeInTheDocument();
  });

  it('offers both in the iOS app once Apple is set up, and starts the chosen one', () => {
    vi.stubEnv('VITE_APPLE_SIGN_IN', 'true');
    platform = 'ios';
    renderChoice();
    expect(screen.getByRole('button', { name: 'המשך עם Google' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'המשך עם Apple' }));
    expect(signInWithApple).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });
});
