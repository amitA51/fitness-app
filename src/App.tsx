import { MotionConfig } from 'framer-motion';
import { AppRouter } from './AppRouter';
import { CookieConsentBanner } from './components/consent/CookieConsentBanner';
import { AuthProvider } from './contexts/AuthContext';
import { EntitlementProvider } from './contexts/EntitlementContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { SettingsProvider } from './contexts/SettingsContext';

// ============================================================================
// App Component
// ============================================================================

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LocaleProvider>
        <SettingsProvider>
          <AuthProvider>
            <EntitlementProvider>
              <AppRouter />
              <CookieConsentBanner />
            </EntitlementProvider>
          </AuthProvider>
        </SettingsProvider>
      </LocaleProvider>
    </MotionConfig>
  );
}

export default App;
