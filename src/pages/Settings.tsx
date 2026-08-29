import { Crown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { SectionLabel } from '../components/ui/SettingsSectionLabel';
import { useIsAppAdmin } from '../hooks/useIsAppAdmin';
import { isSupabaseConfigured } from '../lib/supabase';
import { deleteAllUserData } from '../services/settingsService';
import { signOut } from '../services/supabaseAuth';
import { logger } from '../utils/logger';
import { AdvancedSection } from './progress/components/SectionCard';
import { SettingsGroup } from './settings/components/SettingsGroup';
import { useCloudSync } from './settings/hooks/useCloudSync';
import { useSettingsState } from './settings/hooks/useSettingsState';
import { AccountSection } from './settings/sections/AccountSection';
import { BackupSection } from './settings/sections/BackupSection';
import { BlockedUsersSection } from './settings/sections/BlockedUsersSection';
import { CloudSyncDirectional } from './settings/sections/CloudSyncDirectional';
import { CloudSyncSection } from './settings/sections/CloudSyncSection';
import { CoachSection } from './settings/sections/CoachSection';
import { DangerZoneSection } from './settings/sections/DangerZoneSection';
import { DataAboutSection } from './settings/sections/DataAboutSection';
import { GuidanceSection } from './settings/sections/GuidanceSection';
import { LegalLinksSection } from './settings/sections/LegalLinksSection';
import { NotificationsSection } from './settings/sections/NotificationsSection';
import { ProfileEditSection } from './settings/sections/ProfileEditSection';
import { ProfileSection } from './settings/sections/ProfileSection';
import { ThemeSection } from './settings/sections/ThemeSection';
import { UnsyncedChangesSection } from './settings/sections/UnsyncedChangesSection';
import { WeeklyReportSection } from './settings/sections/WeeklyReportSection';
import { WorkoutPrefsSection } from './settings/sections/WorkoutPrefsSection';

// ============================================================================
// MAIN SETTINGS PAGE (thin orchestrator)
// ============================================================================
// FIVE top-level groups, down from 16 flat sections and an 8-chip sticky jump
// nav:
//
//   1 חשבון            — who you are signed in as, and (coaches only) the
//                         coach business profile: becoming a coach is
//                         account-level, it flips the whole app shell.
//   2 הפרופיל שלי       — the seven metrics that feed TDEE/BMI, top level
//                         because they are why the screen exists.
//                         מתקדם: the public-facing profile editor.
//   3 תצוגה ונגישות     — the four display/accessibility toggles.
//                         מתקדם: replay the first-use guidance.
//   4 אימון והתראות     — rest/timer/haptics defaults + the three notification
//                         toggles: both answer "how does the app behave around
//                         a workout".
//   5 נתונים ופרטיות    — sync, weekly report, legal.
//                         מתקדם: backup/restore, one-way sync, blocked users.
//                         Danger zone last, after a quarantine rule.
//
// Progressive disclosure uses ONE idiom app-wide: `AdvancedSection` (44px
// trigger, children unmounted while collapsed) — the same expander Progress
// uses. A second expander pattern would be the density problem in disguise.
//
// Deleted outright with this rebuild: the whole date/time block (timezone, time
// format, date format, first-day-of-week). The app is Israel-only, and all four
// wrote to a preference NO renderer read — 40 files hardcode he-IL /
// Asia/Jerusalem, including the useCloudSync timestamp shown inside group 5.
// A control that silently claims to restyle every date in the app while
// changing nothing is worse than a dead toggle, so it is gone rather than
// demoted behind מתקדם.
//
// Also deleted: the sticky jump nav. A jump menu is the screen admitting it is
// too long to scroll, which was the complaint and not the fix.
//
// Nutrition goals live in the Nutrition screen (shared "nutrition_goals" key)
// and are not duplicated here.
// ============================================================================

export default function Settings() {
  const state = useSettingsState();
  const cloudSync = useCloudSync();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // /paywall sits behind AdminGuard (no monetization model has been chosen, so
  // the screen exists only for the owner to look at). Offering the row to
  // everyone made a normal user tap it and land silently on the home screen —
  // a dead end with no feedback at all. Same hook as the route guard, so the
  // row and the destination can never disagree.
  //
  // `loading` is honoured the same way the guard honours it: render NOTHING
  // until the app_admins lookup settles. Rendering the row optimistically would
  // pop it in and yank it back out on every cold load for the 99% who are not
  // admins.
  const { isAdmin: isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();

  // The cloud-sync section reports "connected" only when BOTH the backend is
  // reachable AND the user is actually signed in — a reachable Supabase with no
  // session is NOT a usable cloud connection, so showing "מחובר לענן" there is
  // misleading. authEmail is the real auth signal already loaded in state.
  const cloudConnected = cloudSync.cloudConnected && Boolean(state.authEmail);

  // Status card and the one-way pair now live in two components (the latter
  // behind מתקדם), so the "is anything syncing" guard has to be computed here
  // and shared — otherwise opening מתקדם mid-sync could start a second,
  // conflicting sync.
  const syncBusy = cloudSync.isSyncingAll || cloudSync.isSyncingUp || cloudSync.isSyncingDown;

  // ── Handlers that bridge state + services ──────────────────────────────────

  const performSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      logger.app.warn('handleSignOut: signOut threw', err);
    }
    state.setAuthEmail(null);
    window.location.reload();
  };

  const handleSignOut = async () => {
    // Data-loss guard: signOut wipes local stores AND clears both the active
    // queue and the dead-letter store, so anything unsynced is gone afterwards.
    // Flush what we can, then warn if ANYTHING would be destroyed.
    try {
      const { getDeadLetterCount, getQueueDepth, processQueue } = await import(
        '../services/offlineQueue'
      );
      let depth = await getQueueDepth();
      if (depth > 0 && navigator.onLine) {
        await processQueue();
        depth = await getQueueDepth();
      }
      // Held ("dead letter") changes must be counted too. Checking only the
      // ACTIVE queue missed the most likely case: a change that failed with a
      // permanent error is MOVED to the held store, which drops the active depth
      // to zero — so the warning never appeared and sign-out then deleted the
      // very payload the recovery UI was keeping for the user.
      const held = await getDeadLetterCount();
      if (depth + held > 0) {
        setShowSignOutConfirm(true);
        return;
      }
    } catch (err) {
      logger.app.warn('handleSignOut: offline-queue check failed', err);
    }
    await performSignOut();
  };

  const handleDeleteAllData = async () => {
    setDeleteError(null);
    try {
      await deleteAllUserData();
      window.location.reload();
    } catch (err) {
      logger.app.error('handleDeleteAllData: deleteAllUserData threw', err);
      setDeleteError('מחיקת הנתונים נכשלה. ייתכן שחלק מהנתונים לא נמחקו — נסו שוב.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      <PageHeader title="הגדרות" eyebrow="התאמות אישיות וסנכרון" size="large" />

      <div className="px-5 pt-6">
        {/* ── 1 · חשבון ─────────────────────────────────────────────────── */}
        <SettingsGroup title="חשבון">
          <AccountSection authEmail={state.authEmail} onSignOut={handleSignOut} showLabel={false} />

          {/* Admin-only: /paywall is an AdminGuard-ed scaffold. Never offer a
              row whose destination bounces the tapper straight back home. */}
          {!appAdminLoading && isAppAdmin && (
            <Link
              to="/paywall"
              className="active:scale-[0.98]"
              aria-label="פרימיום — הצטרפות לרשימת ההמתנה"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 20,
                padding: '14px 16px',
                minHeight: 44,
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-accent)',
                borderRadius: 'var(--radius-asymmetric)',
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--fs-ink)',
                  }}
                >
                  פרימיום
                </span>
                <span
                  style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--fs-muted)' }}
                >
                  הצטרפו לרשימת ההמתנה
                </span>
              </span>
              <Crown
                size={18}
                aria-hidden="true"
                style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
              />
            </Link>
          )}

          {/* Coach business profile. Renders null for trainees and while the
              role lookup settles, so it costs the majority nothing. Grouped
              under חשבון because becoming a coach is an account-level change —
              it flips the whole app shell, it is not a workout preference. */}
          <CoachSection />
        </SettingsGroup>

        {/* ── 2 · הפרופיל שלי ───────────────────────────────────────────── */}
        <SettingsGroup title="הפרופיל שלי">
          <ProfileSection
            profile={state.profile}
            updateProfile={state.updateProfile}
            commitProfile={state.commitProfile}
            profileSaved={state.profileSaved}
          />

          {/* The public-facing identity (avatar, display name, bio,
              visibility) is a different audience from the metrics above: those
              feed calorie and BMI maths, these are what other users see. It is
              also the only surface in the app that can SET them — /u/:userId is
              read-only — so it stays reachable here rather than being cut. */}
          <AdvancedSection id="settings-public-profile" label="פרופיל ציבורי">
            <ProfileEditSection />
          </AdvancedSection>
        </SettingsGroup>

        {/* ── 3 · תצוגה ונגישות ─────────────────────────────────────────── */}
        <SettingsGroup title="תצוגה ונגישות">
          <ThemeSection showLabel={false} />

          {/* Replaying the first-use walkthrough is a once-or-never action. */}
          <AdvancedSection id="settings-display-advanced">
            <GuidanceSection />
          </AdvancedSection>
        </SettingsGroup>

        {/* ── 4 · אימון והתראות ─────────────────────────────────────────── */}
        <SettingsGroup title="אימון והתראות">
          <WorkoutPrefsSection
            workoutPrefs={state.workoutPrefs}
            commitWorkout={state.commitWorkout}
            workoutSaved={state.workoutSaved}
          />

          <NotificationsSection
            notificationConfig={state.notificationConfig}
            toggleNotification={state.toggleNotification}
            notificationsSaved={state.notificationsSaved}
            pushEnabled={state.pushEnabled}
            togglePush={state.togglePush}
          />
        </SettingsGroup>

        {/* ── 5 · נתונים ופרטיות ────────────────────────────────────────── */}
        <SettingsGroup title="נתונים ופרטיות">
          {isSupabaseConfigured() && (
            <CloudSyncSection
              cloudConnected={cloudConnected}
              busy={syncBusy}
              isSyncingAll={cloudSync.isSyncingAll}
              syncMessage={cloudSync.syncMessage}
              pendingSyncCount={cloudSync.pendingSyncCount}
              lastSyncTime={cloudSync.lastSyncTime}
              onSyncAll={cloudSync.handleSyncAll}
            />
          )}

          {/* Renders only when the offline queue is holding changes it could not
              push, which is what the "retry from Settings" toast points at. */}
          <UnsyncedChangesSection />

          {/* The one row here an ordinary user taps. It used to sit third in a
              four-row card between a CSV export and a JSON restore. */}
          <WeeklyReportSection
            weeklyReport={state.weeklyReport}
            setWeeklyReport={state.setWeeklyReport}
            copiedReport={state.copiedReport}
            setCopiedReport={state.setCopiedReport}
          />

          {/* Top level, deliberately: הצהרת נגישות is an IS 5568 obligation and
              must not be buried, and GDPR requires withdrawing analytics
              consent to be as easy as granting it. */}
          <SectionLabel>משפטי ופרטיות</SectionLabel>
          <LegalLinksSection />

          <AdvancedSection id="settings-data-advanced">
            <BackupSection />

            {isSupabaseConfigured() && (
              <CloudSyncDirectional
                cloudConnected={cloudConnected}
                busy={syncBusy}
                isSyncingUp={cloudSync.isSyncingUp}
                isSyncingDown={cloudSync.isSyncingDown}
                onSyncToCloud={cloudSync.handleSyncToCloud}
                onPullFromCloud={cloudSync.handlePullFromCloud}
              />
            )}

            <BlockedUsersSection />
          </AdvancedSection>

          {/* Quarantine separator — detaches the destructive zone from the
              normal sync/report cards so it doesn't read as just another card.
              Kept ABOVE DangerZoneSection so the deleteError negative-margin
              hug below stays intact. */}
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: 'var(--fs-surface-2)',
              margin: '24px 0',
            }}
          />

          <DangerZoneSection onDeleteAll={handleDeleteAllData} />

          {deleteError && (
            <p
              role="alert"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                color: 'var(--color-error)',
                marginTop: '-12px',
                marginBottom: '20px',
                paddingInline: '4px',
                lineHeight: 1.5,
              }}
            >
              {deleteError}
            </p>
          )}
        </SettingsGroup>

        <DataAboutSection />
      </div>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        variant="warning"
        title="התנתקות מהחשבון"
        description="יש שינויים שטרם סונכרנו לענן — להתנתק בכל זאת? שינויים שלא סונכרנו יימחקו."
        confirmLabel="התנתקות"
        cancelLabel="ביטול"
        onConfirm={() => {
          setShowSignOutConfirm(false);
          void performSignOut();
        }}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  );
}
