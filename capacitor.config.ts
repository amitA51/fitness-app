// ============================================================================
// Capacitor configuration.
//
// The native iOS/Android projects (ios/, android/) are added on macOS / CI —
// see docs/native-capacitor-setup.md. The web PWA build (vite) is unaffected:
// nothing in src/ imports @capacitor/*; platform detection is runtime-only via
// src/utils/platform.ts. This file is intentionally untyped (no @capacitor/cli
// import) so the web project does not need the Capacitor packages installed.
// ============================================================================

const config = {
  appId: 'com.sparkos.fitness',
  appName: 'SparkOS Fitness',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  android: {},
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    // Added during native integration: Haptics, Browser, PushNotifications,
    // LocalNotifications, Preferences, App, StatusBar, @revenuecat/purchases-capacitor.
  },
};

export default config;
