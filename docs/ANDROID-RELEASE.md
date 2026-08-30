# Android release signing

A release build is only accepted by Google Play if it is signed. This repo contains
**no** signing key and never will — you create it once, on your machine.

> **⚠️ The keystore cannot be regenerated. If you lose it, this app can never again be
> updated under the same Google Play listing — you would have to publish a new app with
> a new package name and lose every install and review. Back the `.jks` file and its
> passwords up somewhere that is NOT this machine and NOT this git repo** (password
> manager + offline copy). Enrolling in Play App Signing does not remove this
> requirement: the upload key below still has to survive.

## 1. Create the keystore (owner only, once)

Run from the repo root. `keytool` ships with the JDK that Android Studio installs.

```powershell
keytool -genkeypair -v -keystore android/app/release.jks -storetype PKCS12 -keyalg RSA -keysize 4096 -validity 10000 -alias sparkos-release
```

`keytool` will prompt for a store password and your name/organisation. Pick the password
yourself; nothing in this repo knows it. Keep the alias (`sparkos-release`) — you need it
in the next step.

`android/app/release.jks` is git-ignored (`*.jks`), so it stays out of version control.

## 2. Create `android/keystore.properties`

New file, not committed (`keystore.properties` is git-ignored):

```properties
storeFile=app/release.jks
storePassword=<the store password you just chose>
keyAlias=sparkos-release
keyPassword=<the key password; same as storePassword unless you set a different one>
```

`storeFile` is resolved relative to the `android/` folder. An absolute path works too —
useful if you keep the key outside the repo entirely, which is the safer option:

```properties
storeFile=C:/Users/<you>/keys/sparkos-release.jks
```

## 3. Build the signed AAB

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — upload this to the
Play Console.

For a signed APK instead (sideloading/testing): `.\gradlew.bat assembleRelease` →
`android/app/build/outputs/apk/release/app-release.apk`.

## 4. Verify it really is signed

```powershell
# JDK build-tools; adjust the SDK path if yours differs
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs android\app\build\outputs\apk\release\app-release.apk
```

## If `keystore.properties` is missing

Debug builds keep working normally. A release build stops with an error naming the file
to create and pointing back here — it never emits an unsigned artifact.
