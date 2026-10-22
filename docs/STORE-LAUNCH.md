# Store launch — Google Play and the App Store

Status 2026-10-22. Research sources are linked at the bottom. The app ships as
the same web app inside Capacitor shells (`android/`, `ios/`).

## Done in code

- iOS project (`ios/`, Capacitor 8, Swift Package Manager). Info.plist: Hebrew
  region, location strings + background location for live runs, camera string,
  `com.sparkos.fitness` URL scheme, no-encryption flag. `PrivacyInfo.xcprivacy`
  added to the target (UserDefaults CA92.1; collected data matches the policy).
- Native plugins: App, Browser, Haptics, StatusBar (plus local notifications and
  background geolocation from before). Haptics now play on iOS (the WebView has
  no Vibration API); the status bar follows the light / dark theme.
- Google sign-in in the apps goes through the system browser and returns on
  `com.sparkos.fitness://auth/callback` (`src/services/nativeOAuth.ts`, wired
  into `signInWithGoogle`; Android intent-filter, iOS URL type). Google blocks
  sign-in inside a WebView. The return link carries only a PKCE one-time code,
  and only a sign-in the app started may finish, so a forged or intercepted
  link signs nobody in.
- The iOS app hides "Continue with Google" (Apple 4.8 would require Sign in
  with Apple next to it); web and Android keep it.
- No service worker inside the apps (it would serve the previous version after
  a store update).
- AI answers: one-time explicit consent before data goes to the AI provider
  (Apple 5.1.2(i)) and a "report this answer" button (Play generative-AI
  policy) that writes to `ai_feedback`.
- `codemagic.yaml`: iOS → TestFlight and Android → Play internal test, built in
  the cloud (no Mac needed).
- Android `versionCode` comes from the CI build number.

## Still to wire in code (next session)

1. Privacy policy: add precise location (runs) and the AI provider; replace the
   contact email; publish the static pages at a URL that loads (Play needs a
   privacy URL and an account-deletion URL).
2. Store screenshots (the iOS icon and launch screen now use the brand mark).
3. Sign in with Apple is wired (button, web + native PKCE flow) but hidden until
   `VITE_APPLE_SIGN_IN=true`. With it on, the iOS app shows Apple AND Google
   (guideline 4.8 is then met). Owner setup, ~30 minutes once the Apple
   Developer account exists:
   - developer.apple.com → Identifiers → the App ID `com.sparkos.fitness` →
     enable "Sign in with Apple".
   - Identifiers → new Services ID (e.g. `com.sparkos.fitness.web`) → enable
     Sign in with Apple → domain `qxhgmqxiomidmimpnjvs.supabase.co`, return URL
     `https://qxhgmqxiomidmimpnjvs.supabase.co/auth/v1/callback`.
   - Keys → new key with Sign in with Apple → download the .p8 once.
   - Supabase → Authentication → Providers → Apple: Services ID, Team ID,
     Key ID and the .p8 (Supabase turns them into the client secret; it
     expires every 6 months — set a reminder).
   - Netlify and Codemagic env: `VITE_APPLE_SIGN_IN=true`.
   - Account deletion must then also revoke the Apple token (Apple's rule) —
     extend the `account-delete` function before turning it on.

Strava connect inside the apps opens Strava in the system browser and returns
to the website's `/strava/callback` (`PUBLIC_SITE_ORIGIN`), which finishes the
link; back in the app the Settings card sees it and starts the import.

## Owner steps (Amit)

| Step | Cost | Time |
| --- | --- | --- |
| Google Play developer account (ID check) | $25 once | 1-2 days for approval |
| Apple Developer Program | $99 / year | 1-2 days |
| Create the Android release keystore and keep 2 backups (`docs/ANDROID-RELEASE.md`) | — | 15 minutes |
| Codemagic account linked to the GitHub repo; add the App Store Connect API key | free tier 500 min/month | 30 minutes |
| Supabase → Authentication → URL Configuration → add `com.sparkos.fitness://**` to Redirect URLs | — | 2 minutes |
| Supabase → Edge Functions → Secrets → `ALLOWED_ORIGIN`: add `capacitor://localhost,https://localhost` (the iOS and Android app origins). Without it every edge function — AI coach, Strava, invite accept — is blocked by CORS inside the apps | — | 2 minutes |
| Recruit 12 testers with Google accounts for the Play closed test (14 days) | — | 14 days |
| Custom email sender (domain + SMTP); the built-in one only mails team members | domain ~$10/year | 1 hour |
| Decide the contact email shown in the legal pages and the store listings | — | — |

## Order

1. Accounts + keystore (owner, day 1).
2. Finish the four code items above (about 1 day).
3. Android internal test → closed test with 12 testers (starts the 14-day clock).
4. iOS TestFlight build on Codemagic → test on the iPhone.
5. Store listings: screenshots, privacy labels / Data safety, Health apps
   declaration (Activity and Fitness), foreground-service location video,
   review demo account.
6. Submit: Apple review; Play production after the 14 days.

## Sources

- Play testing rule: https://support.google.com/googleplay/android-developer/answer/14151465
- Play target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Play health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Play foreground services: https://support.google.com/googleplay/android-developer/answer/13392821
- Apple review guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple upload requirements: https://developer.apple.com/news/upcoming-requirements/
- Google WebView OAuth block: https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
- Codemagic pricing: https://codemagic.io/pricing/
