import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { AppRouter } from './AppRouter';
import { CookieConsentBanner } from './components/consent/CookieConsentBanner';
import { AuthProvider } from './contexts/AuthContext';
import { EntitlementProvider } from './contexts/EntitlementContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { useMotionConfigMode } from './hooks/useReducedMotion';

// ============================================================================
// App Component
// ============================================================================

/**
 * `reducedMotion="user"` only honours the OS preference. The in-app Settings
 * toggle has to switch Framer to `"always"`, otherwise every `m.*` component
 * keeps animating while CSS animations stop — which is how the toggle used to
 * behave. This sits INSIDE SettingsProvider so it can observe that state.
 */
function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const mode = useMotionConfigMode();
  return <MotionConfig reducedMotion={mode}>{children}</MotionConfig>;
}

function App() {
  return (
    <LocaleProvider>
      <SettingsProvider>
        <MotionPreferenceProvider>
          <AuthProvider>
            <EntitlementProvider>
              <AppRouter />
              <CookieConsentBanner />
            </EntitlementProvider>
          </AuthProvider>
        </MotionPreferenceProvider>
      </SettingsProvider>
    </LocaleProvider>
  );
}

export default App;
