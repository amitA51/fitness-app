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
    LocalNotifications: {
      // android/app/src/main/res/drawable/ic_stat_notify.xml - referenced by
      // resource NAME, without extension or @drawable/ prefix.
      smallIcon: 'ic_stat_notify',
      // --fs-accent from src/styles/tokens.css (light theme). Android tints the
      // small icon's alpha mask with this, so it must be a literal hex here -
      // the native layer cannot read a CSS custom property.
      iconColor: '#43c7a5',
    },
    // Added during native integration: Haptics, Browser, PushNotifications,
    // Preferences, App, StatusBar, @revenuecat/purchases-capacitor.
  },
};

export default config;
