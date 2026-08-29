# SETTINGS SCREEN — READ-ONLY AUDIT

**Date:** 2026-08-29 · **Scope:** `src/pages/Settings.tsx` + `src/pages/settings/**`
**Status:** fact base only. Nothing was edited. No build, no dev server, no browser, no git.

---

## 0. METHOD, AND HOW TO READ THE TAGS

Every claim below carries one of three tags. They are not decoration — two prior audit
documents in this repo were later found to carry wrong figures that other workers trusted,
so the tag tells you exactly how much weight a line can bear.

| Tag | Means |
|---|---|
| **VERIFIED** | I opened the consumer file and read the line that consumes the value. The `file:line` given is a line I actually read. |
| **INFERRED** | I read the surrounding code and the conclusion follows, but I did not observe the behaviour at runtime. |
| **UNVERIFIED** | I did not confirm it. Stated so you do not build on it. |

**What I did:** read `Settings.tsx`, all 16 section components, the 4 shared components,
`useSettingsState.ts`, `types.ts`, `SettingsContext.tsx`, `useWorkoutSettings.ts`,
`WorkoutSettingsOverlay.tsx`, `WorkoutProvider.tsx`, `workoutReducerUiHandlers.ts`,
`datePreferences.ts`, `SettingsSectionLabel.tsx`, `SectionCard.tsx`, plus targeted greps for
each stored key across `src/`.

**What I did NOT do:** run the app, run any gate, or observe any of this in a browser. Every
"what the user sees" statement is therefore **INFERRED** from the code path, not observed.
A runtime confirmation pass on §4 is worth doing before anyone ships a fix.

**Absence-of-consumer method.** Where I claim "nothing reads this", the evidence is a
repo-wide grep for the identifier returning only the writer and the module that defines it.
That is strong but not absolute: a dynamic/string-built access would evade it. I saw no
dynamic settings access anywhere in this codebase, so I rate those claims VERIFIED and flag
the residual risk here once rather than repeating it per row.

---

## 1. CURRENT RENDER ORDER (on-screen, top to bottom)

The complaint is partly about arrangement, so the existing order is data. Source:
`src/pages/Settings.tsx:160-330`. **VERIFIED.**

| # | Anchor | Component | Heading on screen | Always visible? |
|---|---|---|---|---|
| 1 | — | `PageHeader` | הגדרות | yes |
| 2 | — | `SettingsJumpNav` | 8 chips | yes (sticky) |
| 3 | — | intro paragraph | "חשבון, פרופיל, תצוגה…" | yes |
| 4 | `set-account` | `AccountSection` | חשבון | yes |
| 5 | — | Paywall `Link` | פרימיום | **app-admins only** (`Settings.tsx:186`) |
| 6 | `set-profile` | `ProfileSection` | פרטים אישיים | yes |
| 7 | `set-profile` | `ProfileEditSection` | פרופיל ציבורי | yes (3 load states) |
| 8 | `set-display` | `ThemeSection` | תצוגה ונגישות | yes |
| 9 | `set-display` | `DateTimeSection` | תאריך ושעה | yes |
| 10 | `set-display` | `GuidanceSection` | הדרכה | yes |
| 11 | `set-workout` | `WorkoutPrefsSection` | אימון | yes |
| 12 | `set-coach` | `CoachSection` | מאמן | **coaches only** (`CoachSection.tsx:108`) |
| 13 | `set-notifications` | `NotificationsSection` | התראות | yes |
| 14 | `set-data` | `SectionLabel` | פרטיות ונתונים | yes |
| 15 | `set-data` | `ExportSection` | ייצוא ושיתוף | yes |
| 16 | `set-data` | `CloudSyncSection` | סנכרון ענן | only if Supabase configured |
| 17 | `set-data` | `UnsyncedChangesSection` | (danger tone) | **only when queue holds items** |
| 18 | `set-data` | `DangerZoneSection` | אזור מסוכן | yes |
| 19 | `set-legal` | `SectionLabel` | משפטי ופרטיות | yes |
| 20 | `set-legal` | `LegalLinksSection` | (3 links + toggle) | yes |
| 21 | `set-legal` | `BlockedUsersSection` | משתמשים חסומים | **yes — even when empty** |
| 22 | `set-legal` | `DataAboutSection` | version footer | yes |

**Structural observations on the order itself (VERIFIED from the table above):**

- Two sections carrying the word *profile* are adjacent (#6, #7) under one anchor, each with
  its own heading, its own name field and its own save model. See §3 DUP-1.
- `DateTimeSection` (#9) sits between two live display sections. It is the largest control
  block in the "תצוגה" group and every control in it is dead. See §2.
- `אזור מסוכן` (#18) is followed by three more sections. Destructive actions are not last on
  the screen. Whether that matters is a design call, not a defect.
- `BlockedUsersSection` renders its card and an empty-state sentence even with zero blocked
  users, unlike `UnsyncedChangesSection`, which renders nothing when idle. Two different
  conventions for "I have nothing to show" on one screen.

---

## 2. CONTROL INVENTORY AND CLASSIFICATION

### 2.1 AccountSection — `src/pages/settings/sections/AccountSection.tsx`

| Line | Hebrew label | Class | Consumer / note | Verdict |
|---|---|---|---|---|
| 25 | `מחובר/ת` / `לא מחוברים לחשבון` + email | LIVE | display of `state.authEmail`, loaded `useSettingsState.ts:93-97` — **VERIFIED** | KEEP |
| 51 | `התנתקות` | LIVE | `Settings.tsx:117 handleSignOut` → flushes offline queue, counts dead letters, then `signOut()` — **VERIFIED** | KEEP |
| 76 | `התחברות או הרשמה` | LIVE | `clearGuest()` from `AuthContext` — **VERIFIED** | KEEP |

### 2.2 Paywall row — `src/pages/Settings.tsx:186-232`

| Line | Hebrew label | Class | Consumer / note | Verdict |
|---|---|---|---|---|
| 205 | `פרימיום` / `הצטרפו לרשימת ההמתנה` | LIVE, admin-gated | `useIsAppAdmin()`, same hook as the route guard — **VERIFIED** | ADVANCED, or leave as-is |

Not a user-facing control for 99% of users. Only appears for app admins. Costs the normal
user nothing. Low priority either way.

### 2.3 ProfileSection — `src/pages/settings/sections/ProfileSection.tsx`

All fields persist to `localStorage['user_profile']` via `useSettingsState.ts:54-57`, and are
mirrored to the cloud-synced store by `mirrorLocalKey('user_profile')`.

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 47 | `שם` | **DUPLICATED** | read by `src/components/dashboard/DashboardHeader.tsx:20` — **VERIFIED**. Also see DUP-1 | KEEP (top level) |
| 75 | `גיל` | LIVE | `utils/tdee.ts` BMR input via `settingsService.computeMacrosFromProfile`; consumed `pages/nutrition/components/GoalsEditor.tsx:126-137` — **VERIFIED** | KEEP |
| 87 | `גובה` | LIVE | same TDEE path; **also** `pages/Progress.tsx:109-120` for BMI — **VERIFIED** | KEEP |
| 101 | `משקל` | **DUPLICATED** | TDEE path — **VERIFIED**. See DUP-2 | KEEP + reconcile |
| 119 | `מין` | LIVE | BMR formula, `utils/tdee.ts` — **VERIFIED** | KEEP |
| 129 | `מטרת משקל` | LIVE | `GoalsEditor.tsx:137` → `getMacroGoalsForGoal`; **also** `services/intelligence/profile.ts:66` — **VERIFIED** | KEEP |
| 139 | `רמת פעילות` | LIVE | `utils/tdee.ts:68 ACTIVITY_MAP` multiplier — **VERIFIED** | KEEP |

**This section is the strongest part of the screen.** Every one of seven controls has a named
reader, and two have two independent readers. Nothing here is decorative.

### 2.4 ProfileEditSection — `src/pages/settings/sections/ProfileEditSection.tsx`

Writes to the Supabase `profiles` row via `services/profile/profileService`.

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 283 | avatar picker, `aria-label="העלאת תמונת פרופיל"` | LIVE | `uploadAvatar` — **VERIFIED** as a real service call; the surface that renders the avatar is **UNVERIFIED** | RELOCATE → public profile screen |
| 329 | `שם תצוגה` | **DUPLICATED** | see DUP-1 | RELOCATE → public profile screen |
| 345 | `תיאור קצר` (280 char counter) | LIVE | `updateProfile` — **VERIFIED** call; reader **UNVERIFIED** | RELOCATE |
| 374 | `שמירת פרופיל` button | LIVE | commits name + bio + isPublic — **VERIFIED** | RELOCATE with the fields |
| ~412 | `פרופיל ציבורי` switch | LIVE | `updateProfile({isPublic})` immediately, reverts on error — **VERIFIED** | RELOCATE |

**Two real problems here, both VERIFIED by reading the file:**

1. **Mixed save model inside one card.** Name and bio require the explicit `שמירת פרופיל`
   button (line 374); the visibility switch (~412) saves immediately on tap. Every *other*
   section on this screen autosaves and flashes `נשמר`. Three save conventions on one screen.
2. **The string `פרופיל ציבורי` is used twice at different levels** — as the section heading
   (line 230) and as the visibility toggle's own label (~line 412). A heading and a switch
   inside it share a name.

### 2.5 ThemeSection — `src/pages/settings/sections/ThemeSection.tsx`

All four write `SettingsContext`. This is the section implicated in §4.

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 58 | `מצב כהה` | LIVE | `SettingsContext.tsx:205` toggles `html.dark` — **VERIFIED** | KEEP |
| 66 | `הפחתת אנימציות` | LIVE, **DUPLICATED** | `SettingsContext.tsx:196` → `html.reduce-motion` → `styles/motion.css:361-368`, `exercise-library.css:993` — **VERIFIED**. See §4 | KEEP |
| 78 | `טקסט גדול` | LIVE, **DUPLICATED** | `SettingsContext.tsx:203` → `html.large-text` → `styles/tokens.css:250` — **VERIFIED**. See §4 | KEEP |
| 86 | `ניגודיות גבוהה` | LIVE, **DUPLICATED** | `SettingsContext.tsx:200` → `html.high-contrast` → `styles/tokens.css:587`, `:672` — **VERIFIED**. See §4 | KEEP |

Worth recording: `high-contrast` used to be exactly the failure mode this audit exists to
catch — a class and a switch with no styles behind it. `tokens.css:581-587` carries the
comment documenting that it was fixed. It is now genuinely implemented. **VERIFIED.**

### 2.6 DateTimeSection — `src/pages/settings/sections/DateTimeSection.tsx` — **ALL DEAD**

This is the highest-value finding on the screen.

| Line | Hebrew label | Options | Class | Verdict |
|---|---|---|---|---|
| 164 | `אזור זמן` | 13 timezones, Jerusalem → Sydney | **DEAD** | **DELETE** |
| 195 | `פורמט שעה` | 24h / 12h AM-PM | **DEAD** | **DELETE** |
| 219 | `פורמט תאריך` | dmy / mdy / ymd | **DEAD** | **DELETE** |
| 246 | `יום ראשון בשבוע` | ראשון (ישראל) / שני (אירופה) | **DEAD** | **DELETE** |

**Evidence — VERIFIED:**

- All four persist through `services/datePreferences.ts` to `localStorage['date_prefs']`.
- A repo-wide grep for `datePreferences|getDatePreferences|firstDayOfWeek` returns matches in
  exactly **three** files: the service itself, `DateTimeSection.tsx`, and
  `useWorkoutSettings.ts` — and the last one matched only on the unrelated string
  `--font-scale`. **No file outside the section reads any of the four values.**
- `onDatePreferencesChange` (`datePreferences.ts:170`) exists, is exported, and has
  **zero subscribers**.
- `src/utils/datetime.ts`, which the service's own header claims it "pairs with", does **not**
  import `datePreferences`. The pairing is aspirational.
- The service header admits the gap in writing (`datePreferences.ts:6-8`): the server mirror
  is *"a follow-up — see the module's INTEGRATION NEEDED notes"*.
- Meanwhile **40 files** hardcode `he-IL` or `Asia/Jerusalem`, including `utils/datetime.ts`,
  `utils/dateUtils.ts`, `services/exportService.ts`, `components/dashboard/WeeklyGrid.tsx`
  and `pages/settings/hooks/useCloudSync.ts` — the last of which formats a timestamp shown in
  the very same screen, three sections below, using a hardcoded locale.

**This is FICTION on two counts, and both are worth stating separately** because they call
for the same action for different reasons:

- **Fiction of choice:** the app is Israel-only, so `יום ראשון בשבוע` and `פורמט תאריך`
  have one true answer. A 13-entry timezone menu offering Denver and Mumbai is a menu with
  twelve wrong answers.
- **Fiction of effect:** even the *correct* answer changes nothing. Selecting
  `לונדון` writes `Europe/London` to storage and the app keeps rendering Jerusalem time,
  because 40 files never consult the preference. **This is worse than a dead toggle** —
  a dead toggle does nothing, but this one silently claims to have changed how every date in
  the app is displayed.

`DELETE`, not `ADVANCED`. Demoting it behind `מתקדם` preserves a lie in a less-visible place.
If a genuine multi-timezone need appears later, the service is 200 lines and can return.

### 2.7 GuidanceSection — `src/pages/settings/sections/GuidanceSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 20 | `הצגת ההדרכה מחדש` → button `הצג` | LIVE | `relaunchGuidance()` from `GuidanceContext` — **VERIFIED** as a real context call; that it visibly reopens the sheet is **INFERRED** | ADVANCED |

Genuinely useful, but a once-or-never action. Prime `מתקדם` candidate.

### 2.8 WorkoutPrefsSection — `src/pages/settings/sections/WorkoutPrefsSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| ~45-72 | `זמן מנוחה ברירת מחדל` — 5 pills (30/60/90/120/180s) | LIVE | mirrored into `SettingsContext` at `useSettingsState.ts:62`; consumed via `useRestTimerSettings()` (`useWorkoutSettings.ts:339-341`) — **VERIFIED** | KEEP |
| 81 | `התחלה אוטומטית של טיימר` | LIVE | same mirror, `useSettingsState.ts:63` — **VERIFIED** | KEEP |
| 96 | `רטט (Haptic Feedback)` | LIVE | mirror `useSettingsState.ts:64` → `SettingsContext.tsx:214 setHapticsEnabled()` → `utils/haptics` — **VERIFIED** | KEEP |

**Name this as well built.** These three are the *correct* solution to the exact problem §4
describes. `useSettingsState.ts:60-67` writes them to localStorage **and** mirrors them into
`SettingsContext`, and `useSettingsState.ts:80-90` reads them back *from* the context on every
change — so the local copy can never drift from the app-wide one. The accessibility toggles do
not do this, and that is the whole bug. Whoever fixes §4 should copy this pattern.

One RTL/label nit: the visible label mixes Hebrew with the untranslated English
`(Haptic Feedback)`. Cosmetic, and it does render LTR-inside-RTL correctly as a parenthesised
run — **INFERRED** from it being a plain inline string with no `dir` override; not visually
confirmed.

### 2.9 CoachSection — `src/pages/settings/sections/CoachSection.tsx`

Returns `null` for non-coaches (`:108`) and while `loading` (`:104`). **VERIFIED.**

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 135 | `שם העסק` | LIVE | debounced `updateMyCoachProfile({businessName})` — **VERIFIED** | RELOCATE → `/coach` |
| 193 | `אודות` | LIVE | debounced `updateMyCoachProfile({bio})` — **VERIFIED** | RELOCATE → `/coach` |
| 243 | `ניהול מתאמנים` → chevron | LIVE | `navigate('/coach')` — **VERIFIED** | KEEP or RELOCATE |
| ~262 | `חזרה לחשבון מתאמן` | LIVE | `disable()`; server refuses with active clients — **VERIFIED** | RELOCATE → `/coach` |

The business-profile fields are coach-panel content living in the trainee settings screen.
Moving them to `/coach` satisfies the house test — *is it true, and does whoever needs it
still get it* — because a coach is by definition in `/coach` regularly.

### 2.10 NotificationsSection — `src/pages/settings/sections/NotificationsSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 40 | `תזכורת אימון` | LIVE | `services/notificationService.ts:175` — `if (!config.workoutReminderEnabled) return;` inside `checkMissedWorkouts`, called from `main.tsx:140` — **VERIFIED** | KEEP |
| 48 | `התראת שיא אישי (PR)` | LIVE | `services/prService.ts:295` — `if (!getNotificationConfig().prNotificationEnabled) return;` — **VERIFIED** | KEEP |
| 88 | `התראות בזמן אמת` | LIVE | `subscribeToPush`/`unsubscribeFromPush`; initial state probes the real SW subscription at `useSettingsState.ts:100-110`; disables itself and says so when unsupported — **VERIFIED** | KEEP |

**Name this as well built, emphatically.** This section is where the app's worst habit was
already corrected, twice, and the fixes are annotated in the code:

- The PR toggle named in the brief as *"wired to no consumer"* **now has one** at
  `prService.ts:295`. Fixed.
- `notificationService.ts:173-174` carries the comment recording that
  `checkMissedWorkouts` *"used to fire unconditionally from main.tsx, making the toggle a
  no-op."* Fixed.
- `NotificationsSection.tsx:34-35` records that a nutrition-reminder toggle **was deleted**
  rather than demoted, because no scheduler existed. That is the precedent for the
  DateTimeSection recommendation above.
- `useSettingsState.ts:143-147` requests browser permission when a toggle goes on, so the
  persisted config is actionable rather than a switch that stores an intention nothing can
  honour.

### 2.11 ExportSection — `src/pages/settings/sections/ExportSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 196 | `ייצוא היסטוריית אימונים (CSV)` | LIVE | `settingsService.exportWorkoutHistory` — **VERIFIED** | ADVANCED |
| 206 | `גיבוי מלא (JSON) — נתוני המכשיר` | LIVE | `exportFullBackup` — **VERIFIED** | ADVANCED |
| 216 | `שחזור מגיבוי (JSON)` | LIVE | `importFullBackup`, staged behind `ConfirmDialog` — **VERIFIED** | ADVANCED |
| 226 | `דוח שבועי` | LIVE | `generateWeeklyReport` → inline `<pre>` + `שתף` / `העתק` | KEEP |

Well built: per-action `busy` state prevents double-fire, restore is two-step with an honest
Hebrew description of what it overwrites, and every failure path shows a Hebrew toast.

`דוח שבועי` is a sharing feature, not a data-management one, and is the only row here a
typical user would tap. It reads as misfiled next to three backup rows.

### 2.12 CloudSyncSection — `src/pages/settings/sections/CloudSyncSection.tsx`

Renders only when `isSupabaseConfigured()`. **VERIFIED.**

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| ~70 | `מחובר לענן` / `לא מחובר` | LIVE | `Settings.tsx:105` — `cloudSync.cloudConnected && Boolean(state.authEmail)` — **VERIFIED** | KEEP |
| ~99 | `בהמתנה: {n}` | LIVE | `useCloudSync.pendingSyncCount` | KEEP |
| ~117 | `סנכרון אחרון: {time}` | LIVE | `useCloudSync.lastSyncTime` — **note:** formatted with hardcoded `he-IL` in `useCloudSync.ts` — **VERIFIED** | KEEP |
| ~152 | `סנכרון מלא` | LIVE | `handleSyncAll` | KEEP |
| ~168 | `העלה לענן` | LIVE | `handleSyncToCloud` | ADVANCED |
| ~181 | `הורד מענן` | LIVE | `handlePullFromCloud` | ADVANCED |

Well built: `Settings.tsx:100-105` carries the reasoning for why reachable-but-signed-out is
**not** reported as connected, and the disconnected state explains the path forward instead of
leaving three disabled buttons with no explanation.

Directional up/down sync is an expert affordance — a user who understands which direction they
need is not the user complaining about clutter. `סנכרון מלא` alone serves everyone else.

### 2.13 UnsyncedChangesSection — `src/pages/settings/sections/UnsyncedChangesSection.tsx`

Renders **nothing** when the dead-letter store is empty. **VERIFIED** (`:8-9` documents it).

| Line | Action | Class | Consumer | Verdict |
|---|---|---|---|---|
| 79 | retry all | LIVE | `retryAllDeadLetters()` | KEEP (conditional) |
| 97 | export held changes | LIVE | `exportDeadLetters()` | KEEP (conditional) |
| — | discard | LIVE | `Trash2` + `ConfirmDialog` — **INFERRED** from imports; I did not read the handler | KEEP (conditional) |

Well built, and the best-designed thing on the screen. It is invisible on a healthy account,
it names each held item in Hebrew a non-developer can read (`describeMutation`, `:28-56` —
`אימון`, `שקילה`, `דיווח התאוששות`), and it is the destination the failure toast points at.
Costs zero density when there is nothing to say.

### 2.14 DangerZoneSection — `src/pages/settings/sections/DangerZoneSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 96 | `מחיקת נתוני האימון` | LIVE | `Settings.tsx:137 handleDeleteAllData` → `deleteAllUserData()`; error surfaces at `Settings.tsx:290` | KEEP |
| 183 | `מחיקת החשבון לצמיתות` | LIVE | `accountService.deleteAccount(email)`, gated on typed-email match (`:38`), server re-verifies against the JWT — **VERIFIED** in this file's own contract note | KEEP |
| 135 | `כתובת הדוא"ל של החשבון` | LIVE | confirmation input for the above | KEEP |

Well built: the file header (`:16-27`) documents *why* there are two different destructive
actions rather than one, and the copy states what each actually does instead of promising
total erasure for both. Guest accounts get an honest explanation that account deletion needs
a cloud account.

### 2.15 LegalLinksSection — `src/pages/settings/sections/LegalLinksSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 36 | `תנאי שימוש` → `/legal/terms` | LIVE | route link | KEEP |
| 37 | `מדיניות פרטיות` → `/legal/privacy` | LIVE | route link | KEEP |
| 38 | `הצהרת נגישות` → `/accessibility` | LIVE | route link — required for IS 5568 | KEEP |
| 63 | `מעקב אנליטיקה ויציבות` | LIVE, **DUPLICATED (benign)** | `main.tsx:78 onTrackingConsentChange` and `services/analytics/funnel.ts:25 hasAnalyticsConsent` — **VERIFIED** | KEEP |

The duplication with `components/consent/CookieConsentBanner.tsx:34-47` is **correct and
should not be "fixed"**: both writers go through the same `trackingConsent` service, so they
cannot diverge, and GDPR requires withdrawal to be as easy as granting. This is the model for
how two entry points to one setting should be built — compare DUP-1 and §4, which are not.

### 2.16 BlockedUsersSection — `src/pages/settings/sections/BlockedUsersSection.tsx`

| Line | Hebrew label | Class | Consumer | Verdict |
|---|---|---|---|---|
| 96/120/154/182 | `משתמשים חסומים` (4 load states) | LIVE | `listBlockedUsers()` | RELOCATE → community/profile settings, else ADVANCED |
| per row | unblock button | LIVE | `unblockUser()`, optimistic, per-row `pendingId` | RELOCATE with the section |

Well built as a component — all four data states are handled, and the header (`:7-11`)
correctly reasons that an empty result must not be shown as an error.

But it occupies permanent vertical space to tell almost every user that they have blocked
nobody. Contrast `UnsyncedChangesSection`, which renders nothing in the same situation.

### 2.17 DataAboutSection — `src/pages/settings/sections/DataAboutSection.tsx`

| Line | Content | Class | Verdict |
|---|---|---|---|
| ~10 | `SPARKOS FITNESS · v1.0.0` | static text, no control | KEEP |

`v1.0.0` is a **hardcoded literal**, not read from `package.json` or a build constant —
**VERIFIED** by reading the file. It will not change when the app ships a new version, so it
is a version string that cannot report the version. Low severity, trivially wrong.

---

## 3. DUPLICATION FINDINGS (besides §4)

### DUP-1 — Two name fields, two stores, same screen · **VERIFIED**

| | Writer A | Writer B |
|---|---|---|
| Control | `ProfileSection.tsx:47` — `שם` | `ProfileEditSection.tsx:329` — `שם תצוגה` |
| Store | `localStorage['user_profile'].name` | Supabase `profiles.display_name` |
| Path | `useSettingsState.ts:54` + `mirrorLocalKey` | `profileService.updateProfile` |
| Read by | `DashboardHeader.tsx:20` — **VERIFIED** | public profile `/u/:userId`, community — **UNVERIFIED** |
| Save model | autosave, debounced 500ms | explicit `שמירת פרופיל` button |

**They can diverge, and nothing reconciles them.** I found no code that copies one to the
other — **VERIFIED absence** by grep. So the greeting on the dashboard and the name other
users see are independent values, set by two adjacent fields under the same `#set-profile`
anchor, with two different save gestures. A user who edits one has no way to know the other
exists.

Which is "right" depends on a product decision I cannot make: is there one name or two?
Reasonable answer — one visible name field, Supabase as the source of truth, with the
dashboard greeting reading the same value.

### DUP-2 — Two weights, different readers · **VERIFIED**

| | Writer A | Writer B |
|---|---|---|
| Control | `ProfileSection.tsx:101` — `משקל` (scalar) | body-weight log — `bodyStatsService.addBodyWeight` |
| Surfaced in | Settings | Progress `WeightSection`, coach `EditBodyWeightSheet.tsx` |
| Read by | TDEE macros — `GoalsEditor.tsx:126-137` — **VERIFIED** | BMI — `Progress.tsx:127` uses `latestWeight` from the log, **not** `user_profile.weight` — **VERIFIED** |

**They can diverge.** Logging a weigh-in does not update the settings field, and editing the
settings field does not create a log entry — **VERIFIED absence** of any syncing writer by
grep. Consequence, **INFERRED** from the two consumer lines: after a user logs weigh-ins for
a month, BMI on Progress reflects the new weight while the nutrition macro calculation is
still using the stale number typed into Settings once at signup.

This one is more consequential than DUP-1, because the divergence silently changes a
calorie target. It is not a layout problem and will survive any regrouping.

### DUP-3 — Rest timer / auto-start / haptics · **VERIFIED, and correctly handled**

Listed for completeness so nobody "fixes" it. `WorkoutPrefsSection` and the in-workout
overlay both reach these, but `useSettingsState.ts:60-67` mirrors writes into
`SettingsContext` and `:80-90` reads back from it, so a single store wins. See §2.8.

---

## 4. THE KNOWN DEFECT, TRACED

**Claim:** the in-workout accessibility toggles and Settings' accessibility toggles can
disagree while a workout is mounted, and each can silently revert the other.
**Status: VERIFIED as a code path.** The user-visible symptoms are **INFERRED** — I read
every line in the chain but did not run the app.

### 4.1 Which controls are affected — exactly three

| Setting | Settings control | In-workout control | Affected? |
|---|---|---|---|
| `reducedAnimations` | `ThemeSection.tsx:66` | `WorkoutSettingsOverlay.tsx:437` | **YES** |
| `largeText` | `ThemeSection.tsx:78` | `WorkoutSettingsOverlay.tsx:443` | **YES** |
| `highContrast` | `ThemeSection.tsx:86` | `WorkoutSettingsOverlay.tsx:449` | **YES** |
| `darkMode` | `ThemeSection.tsx:58` | `WorkoutSettingsOverlay.tsx:218` | **NO — built correctly** |

`darkMode` is the control group that proves the diagnosis. `WorkoutSettingsOverlay.tsx:58`
calls `useSettings()` directly and routes dark mode to `SettingsContext`, deliberately
bypassing `onUpdateSetting`, with the reasoning written at `:54-57`. **The same file gets it
right for one setting and wrong for the three below it.**

### 4.2 The two write paths

**Path A — Settings.** `ThemeSection.tsx:66/78/86` → `updateWorkoutSettings()` →
`SettingsContext.tsx:158-170` → effect at `:194-208` toggles the `<html>` classes → effect at
`:133-140` persists **the entire `AppSettings` object** to `localStorage['appSettings']`
(`:137`).

**Path B — in-workout.** `WorkoutSettingsOverlay.tsx:437/443/449` → `onUpdateSetting` →
`dispatch({type:'UPDATE_SETTINGS'})` → `workoutReducerUiHandlers.ts:166-175` mutates
`draft.appSettings.workoutSettings` → `WorkoutProvider.tsx:349-366` merges that subtree into
**the same `localStorage['appSettings']` key** (`:364`). Separately,
`useWorkoutSettings.ts:387-425` (`useAccessibilitySettings`, mounted at
`ActiveWorkoutNew.tsx:336`) applies the classes to `<html>`.

### 4.3 Which store wins

**Neither, deterministically. The last writer wins, and each writes a stale snapshot.**
That is the actual answer, and it is worse than "one store wins":

- `SettingsContext` reads storage **once**, in a `useState` initializer
  (`SettingsContext.tsx:127 loadStoredSettings()`), and afterwards only resets on the
  `auth:local-data-cleared` event (`:114-121`). It never re-reads. **VERIFIED.**
- `WorkoutProvider` reads storage **once**, via `loadAppSettings()` (`:111-120`), at mount.
  **VERIFIED.**
- Neither subscribes to the other. There is no `storage` event listener and no shared
  observer between them. **VERIFIED absence** by grep.

So each holds an in-memory copy that goes stale the moment the other writes, and each then
persists its own whole stale copy over the top.

### 4.4 What the user sees — INFERRED from the paths above

**Scenario 1 — toggle in the workout, then look at Settings.**
1. Start a workout, open the overlay, turn `ניגודיות גבוהה` **on** (`:449`).
2. `useAccessibilitySettings` adds `html.high-contrast` → the effect is **visibly on**.
3. `WorkoutProvider.tsx:364` writes `highContrast: true` to storage.
4. `SettingsContext`'s memory still says `false`.
5. Open Settings: **`ניגודיות גבוהה` reads OFF while the app is visibly rendering in high
   contrast.** The switch contradicts the screen.

**Scenario 2 — the silent revert. This is the damaging one.**
6. Continuing from above, the user toggles *anything* in Settings — say `מצב כהה`.
7. `SettingsContext.tsx:137` persists its **entire stale object**, including
   `highContrast: false`.
8. The user's high-contrast preference is **destroyed with no error and no indication**, by
   an unrelated tap.

**Scenario 3 — the reverse order.** Turn `highContrast` on in Settings while a workout is
mounted; `WorkoutProvider`'s copy still holds `false`. Its persistence effect is keyed to
`[state.appSettings?.workoutSettings]` (`:366`), so it does not fire immediately — but the
next overlay toggle of any workout setting writes the stale `false` back over storage.

**A related, already-fixed sibling is documented in-code** at `useWorkoutSettings.ts:413-422`:
removing the classes on unmount used to turn high-contrast and reduced-motion off for the rest
of the session while both switches still read ON in Settings. That fix removed the cleanup;
it did **not** address the two-writer problem, which is the finding here.

### 4.5 Extra defect found while tracing: `largeText` has two mechanisms, one dead

- `SettingsContext.tsx:203` toggles `html.large-text` → implemented at
  `styles/tokens.css:250`. **Live.**
- `useWorkoutSettings.ts:398-403` sets the CSS custom property `--font-scale` to `1.2` / `1`.

A repo-wide grep for `font-scale` returns matches in **exactly one file** —
`useWorkoutSettings.ts` itself, at lines 400, 402, 420 and 423 (write, write, comment,
cleanup). **No stylesheet reads `--font-scale`.** **VERIFIED.**

This independently reconfirms the prior finding named in the brief. It means the in-workout
`טקסט גדול` toggle does one thing that works (via the class, if `SettingsContext` happens to
agree) and one thing that is pure ceremony.

### 4.6 What this implies for the redesign

**The fix is not in `Settings.tsx`.** Moving `ThemeSection` into a different group, or behind
`מתקדם`, leaves all three scenarios intact. The correct fix is one store — most cheaply by
making the overlay's three accessibility toggles call `useSettings().updateWorkoutSettings`
directly, exactly as `darkMode` already does at `WorkoutSettingsOverlay.tsx:58`, and deleting
the dead `--font-scale` writes. That is a workout-code change, out of scope for a settings
regroup, and should be tracked as its own item.

---

## 5. VERDICT SUMMARY

| Verdict | Count | Controls |
|---|---|---|
| **DELETE** | 4 | all of `DateTimeSection` (`:164`, `:195`, `:219`, `:246`) |
| **RELOCATE** | 9 | `ProfileEditSection` ×5 → public-profile screen · `CoachSection` ×3 → `/coach` · `BlockedUsersSection` → community settings |
| **ADVANCED** | 7 | CSV export, full backup, restore, `הדרכה`, `העלה לענן`, `הורד מענן`, paywall row |
| **KEEP (top level)** | ~22 | account ×3, personal metrics ×7, display ×4, workout ×3, notifications ×3, weekly report, full sync + status, danger zone ×3, legal ×4, version footer |

Counts exclude pure status text and the conditional `UnsyncedChangesSection`, which earns its
place by being invisible when idle.

---

## 6. PROPOSED GROUPING

Shape only — no code. **Five top-level groups, down from the current 16 sections and 8
jump-nav chips.** Everything named here is a move or a deletion, never a rewrite.

**1 · חשבון** — `AccountSection`. Sign-in state, sign out, delete account (moved up from
`אזור מסוכן`; account destruction is account business). Paywall row stays admin-gated here.

**2 · הפרופיל שלי** — `ProfileSection` (all seven metrics, top level; they drive real
calculations and are the reason the screen exists). Resolve DUP-1 to a **single** name field.
`ProfileEditSection`'s public fields — avatar, display name, bio, visibility — **leave this
screen** for a dedicated public-profile editor, with one row here linking to it.

**3 · תצוגה ונגישות** — `ThemeSection`'s four toggles, unchanged. `DateTimeSection` **deleted
entirely**. `GuidanceSection` demoted into this group's `מתקדם`.

**4 · אימון** — `WorkoutPrefsSection`'s three controls, unchanged. `CoachSection` **leaves**
for `/coach`.

**5 · נתונים ופרטיות** — `סנכרון מלא` + sync status at top level. Directional up/down,
CSV export, full backup and restore behind `מתקדם`. `דוח שבועי` moves out of the backup
cluster — it is a sharing feature, and the natural home is Progress, next to the data it
reports on. Legal links stay top level (`הצהרת נגישות` is an IS 5568 obligation and must not
be buried). Analytics-consent toggle stays top level (GDPR withdrawal parity).
`BlockedUsersSection` leaves for community settings; if it stays, it belongs in `מתקדם` and
should render nothing when the list is empty, matching `UnsyncedChangesSection`.
`מחיקת נתוני האימון` stays as the danger zone. `UnsyncedChangesSection` keeps its
render-only-when-needed behaviour and needs no group.

**Net effect, by count:** 4 controls deleted, 9 relocated off-screen, 7 demoted. Five headings
instead of sixteen. The default screen is roughly a third of its current height —
**INFERRED** from control counts, not measured; nobody has rendered this.

---

## 7. THE JUMP NAV

**Verdict: delete it with the regrouping.** Three reasons, in descending order of strength.

**7.1 One chip is already dead for almost every user. VERIFIED.**
`JUMP_ITEMS` at `Settings.tsx:47-56` includes `{ id: 'set-coach', label: 'מאמן' }`. The
matching anchor at `Settings.tsx:255` wraps `CoachSection`, which returns `null` for
non-coaches (`CoachSection.tsx:108`) and while loading (`:104`). The chip is rendered
unconditionally. **For every trainee — the overwhelming majority — tapping `מאמן` scrolls to
an empty `<div>`.** That is the same dead-end class of bug the paywall row was already fixed
for at `Settings.tsx:98-103`, where the code goes out of its way to avoid offering a row whose
destination bounces the user. The jump nav reintroduces it one section down.

**7.2 The chips miss the 44px touch minimum. VERIFIED.**
`SettingsSectionLabel.tsx:47-49` — `padding: '7px 14px'`, `fontSize: '12px'`, no
`min-height`. 12px text at default line height plus 14px of vertical padding lands near
**31px tall**, against the 44px house rule the rest of the screen honours
(`ProfileSection.tsx:57 minHeight:'44px'`, `SectionCard.tsx` `AdvancedSection`
`minHeight: 44`). Computed arithmetic, not measured in a browser. There is also no
`aria-current` and no explicit focus style on the anchors.

**7.3 It is a symptom, not a feature.** A jump menu exists because the screen is too long to
scroll. Delete 4 controls, relocate 9 and demote 7 and the premise is gone. Keeping a sticky
nav over a five-group screen spends 44px of permanent vertical space, on a 390px phone, to
navigate five headings.

`SectionLabel` in the same file is unrelated and should stay.

---

## 8. NOTES FOR WHOEVER IMPLEMENTS THIS

**Use the existing expander. It fits.** `AdvancedSection` in
`src/pages/progress/components/SectionCard.tsx` is the house disclosure idiom and I checked it
against this use case — **VERIFIED** by reading it:

- Label already defaults to `'מתקדם'`, overridable.
- Children **unmount** while collapsed, so a closed group costs no render work.
- `aria-expanded` + `aria-controls={`${id}-panel`}`, rotating chevron, `minHeight: 44`.
- Props are `{ children, id, label }` only — **no coupling to Progress data**, so it is
  reusable as-is.
- It is `memo`'d and its transition is `transform`-only, which the global
  reduced-motion rule collapses.

One caveat: it lives under `src/pages/progress/`. Importing it from Settings crosses a page
boundary. Either accept that or move it to `src/components/ui/` — but **do not write a second
expander.** Its own header comment says why: *"two different expander patterns on one screen
is the density problem wearing a disguise."*

**Hebrew copy register.** Standard is plural-imperative (`לחצו`, `בחרו`), documented at
`src/components/guidance/guidanceSteps.tsx:6`. Three existing strings violate it and should be
fixed while the files are open — **VERIFIED** by reading each:

| File:line | Current | Problem |
|---|---|---|
| `CoachSection.tsx:145` | `שם העסק שלך...` | 2nd-person **singular** possessive |
| `CoachSection.tsx:198` | `ספר על עצמך...` | masculine singular imperative |
| `BlockedUsersSection.tsx` empty state | `לא חסמת אף אחד` | 2nd-person singular past |

`ProfileEditSection.tsx:352` (`ספרו משהו על עצמכם`) is correct and is the model. Note the two
coach placeholders and the profile placeholder say nearly the same thing in two different
registers, in the same screen.

**Other constraints:** touch targets ≥ 44px (the jump-nav chips currently fail; see 7.2).
RTL logical properties only — the existing sections are good about this (`ps-4`/`pe-4`,
`insetInlineStart`, `marginInline`, `textAlign: 'start'`); `CoachSection.tsx:112-113` even
picks its chevron direction from `document.documentElement.dir`. I found **no** `ml-*`/`mr-*`
/`pl-*`/`pr-*` violations in the settings tree.

**Do not "fix" these — they are correct:** the `trackingConsent` duplication (§2.15), the
`WorkoutPrefs` context mirror (§2.8, and the pattern §4 should copy), `UnsyncedChangesSection`
rendering nothing when idle, and the `cloudConnected` definition at `Settings.tsx:100-105`.

---

## 9. WHAT I COULD NOT DETERMINE

1. **Every runtime symptom.** I ran nothing. All of §4.4, and any statement about what a user
   sees, is **INFERRED** from reading the code path. §4 deserves a runtime confirmation before
   a fix is designed. I was explicitly scoped away from the browser and the build — another
   worker holds both.

2. **Readers of the public-profile fields.** I verified `ProfileEditSection` writes real
   service calls, but did not open `/u/:userId` or the community components to confirm what
   renders `displayName`, `bio` and `avatarUrl`. Tagged **UNVERIFIED**. This does not change
   the RELOCATE verdict, but it does mean I cannot say DUP-1's Writer B has a live consumer.

3. **Whether `ProfileSection.weight` and the body-weight log were *meant* to be one value.**
   The divergence is VERIFIED; the intent is not. Someone who knows the product must decide
   which is authoritative before DUP-2 can be fixed.

4. **`mirrorLocalKey` / cloud-sync round-trip.** I read the call sites in
   `useSettingsState.ts:55,66` and the key list in `localStateMirror.ts:60`, but did not trace
   the full mirror → `user_settings` → pull path. If the cloud mirror re-hydrates
   `user_profile` or `appSettings` on a pull, it could be a **third** writer in the §4
   conflict. **UNVERIFIED, and the single most valuable thing to check next** — it would make
   §4 worse, not better.

5. **The 5 remaining `DEFAULT_WORKOUT_SETTINGS` divergences.** `SettingsContext.tsx:18-79`
   and `useWorkoutSettings.ts:14-110` each declare a `DEFAULT_WORKOUT_SETTINGS`, and I
   spotted differing values (e.g. `longRestTime` 120 vs 180, `extendRestAfterFailure`
   false vs true, `autoAdvanceExercise` true vs false, `timerDisplayMode` `'countup'` vs
   `'countdown'`, `showMuscleGroupBalance` true vs false). Two default sets for one store is
   a real smell and plausibly its own bug class, but **none of those five is exposed as a
   Settings control**, so I did not trace them. Out of scope here; worth its own ticket.

6. **Visual/overflow behaviour at 390px, dark mode, and long-Hebrew-string overflow.** Not
   assessed — requires the browser.

7. **Exact line numbers for a few controls** are given as `~N` where I read the surrounding
   block but did not grep the individual line (`CloudSyncSection` buttons, the
   `ProfileEditSection` visibility switch, the `WorkoutPrefs` rest pills, the
   `CoachSection` leave button, the `BlockedUsers` per-row unblock). Every `~` is an
   approximation of a control I did read; every un-prefixed number is exact.
