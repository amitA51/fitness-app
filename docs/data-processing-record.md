# Records of Processing Activities (ROPA) & Sub-processors

> GDPR Art. 30 record + CCPA disclosure for SparkOS Fitness.
> **DRAFT — requires legal review before relied upon.** Keep in sync with the
> user-facing privacy policy (`src/content/legal/legalDocs.ts`).

## Controller

SparkOS Fitness (the app owner). Contact: pgishonim@gmail.com

## Data categories, purposes & lawful bases

| Category | Examples | Purpose | Lawful basis (GDPR) |
|---|---|---|---|
| Account | email, auth id | Authentication, account | Contract (Art. 6(1)(b)) |
| Profile / fitness | name, DOB, gender, height, weight, goals, experience | Personalised plans & tracking | Contract |
| Activity | workouts, nutrition, water, measurements, progress photos, messages | Core service | Contract |
| Age verification | date of birth, verified flag | Minimum-age compliance | Legal obligation (Art. 6(1)(c)) |
| Consent records | legal-doc acceptances, cookie choices | Proof of consent | Legal obligation |
| Diagnostics | error events, web-vitals (Sentry) | Stability/monitoring | **Consent** (Art. 6(1)(a)) — off until opt-in |

Special-category note: health/fitness data is sensitive; collected only to provide the service the user requests.

## Sub-processors

| Sub-processor | Role | Data | Location |
|---|---|---|---|
| Supabase | Database, auth, storage, edge functions | All cloud-stored data | Per project region |
| Sentry | Error monitoring & web-vitals | Diagnostic events (after consent only) | Per Sentry config |
| Apple / Google (when native) | App distribution + IAP billing | Purchase/account identifiers | Stores |
| Google (when Calendar enabled) | Calendar sync (opt-in) | Scheduled-workout events | Google |

We do **not** sell personal information (CCPA "Do Not Sell or Share" honored; Global Privacy Control respected).

## Data-subject rights — how they are fulfilled (already implemented)

- **Access / portability** → `exportFullBackup()` (machine-readable JSON) + `exportWorkoutHistory()` (CSV), in Settings → ייצוא ושיתוף.
- **Erasure ("right to be forgotten")** → `deleteAllUserData()` (Settings → Danger Zone) purges **cloud first** (`deleteAllCloudData`) then IndexedDB + localStorage.
- **Rectification** → profile editing in Settings / onboarding.
- **Withdraw consent** → cookie/tracking toggle in Settings → משפטי ופרטיות; legal re-consent via the consent gate.

## Retention

Data retained while the account is active. On deletion, cloud + local data are purged.

## Follow-ups before production

- Confirm `deleteAllCloudData` covers the new compliance tables (`user_consents`, `user_age_verification`) — OR document an intentional legal-retention exception for consent proof (Art. 17(3)(b)).
- Execute Data Processing Agreements (DPAs) with Supabase and Sentry.
- Finalise retention periods per data category with counsel.
