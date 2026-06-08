# Native (Capacitor) setup — iOS + Android

The web PWA already runs standalone. This wraps the **same** Vite build in a
Capacitor native shell for the App Store / Play Store. **iOS steps require macOS
+ Xcode** and Android requires the Android SDK — they cannot run on the Windows
dev box, so do them on a Mac / CI runner.

The app is already prepared for this:

- `capacitor.config.ts` — config (appId `com.sparkos.fitness`, `webDir: dist`).
- `src/utils/platform.ts` — runtime web/native detection (no build-time dep).
- `src/utils/externalLink.ts` — opens links via the native Browser plugin when present.

## One-time install (on macOS / CI)

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm i @capacitor/haptics @capacitor/browser @capacitor/app \
      @capacitor/preferences @capacitor/status-bar @capacitor/splash-screen \
      @capacitor/push-notifications @capacitor/local-notifications
# Monetization (Wave 2): @revenuecat/purchases-capacitor

npm run build            # produces dist/ (the webDir)
npx cap add ios
npx cap add android
npx cap sync
```

## Per-build

```bash
npm run build && npx cap sync
npx cap open ios       # Xcode: signing, capabilities, run
npx cap open android   # Android Studio: signing, run
```

## Wave-1 follow-ups once native is wired

- Swap `<a target="_blank">` legal links to `openExternalLink()` (already native-aware).
- App Store: Privacy Nutrition Labels + Account Deletion (DangerZone exists) + Terms/Privacy URLs (use the public `/legal/*` routes).
- Play: Data Safety form consistent with the privacy policy / ROPA.

## Wave-2/3 native features (separate work-streams in plans/FEATURE-EXPANSION-PLAN.md)

- Haptics (`@capacitor/haptics`) behind `src/services/haptics.ts`.
- Native IAP via RevenueCat (Apple Guideline 3.1.1).
- Home / lock-screen widgets (WidgetKit / Glance — native Swift/Kotlin).
- Push notifications upgrade.
