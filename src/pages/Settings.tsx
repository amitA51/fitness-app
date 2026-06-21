import { Crown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import {
  SectionLabel,
  type SettingsJumpItem,
  SettingsJumpNav,
} from '../components/ui/SettingsSectionLabel';
import { isSupabaseConfigured } from '../lib/supabase';
import { deleteAllUserData } from '../services/settingsService';
import { signOut } from '../services/supabaseAuth';
import { logger } from '../utils/logger';
import { useCloudSync } from './settings/hooks/useCloudSync';
import { useSettingsState } from './settings/hooks/useSettingsState';
import { AccountSection } from './settings/sections/AccountSection';
import { BlockedUsersSection } from './settings/sections/BlockedUsersSection';
import { CloudSyncSection } from './settings/sections/CloudSyncSection';
import { CoachSection } from './settings/sections/CoachSection';
import { DangerZoneSection } from './settings/sections/DangerZoneSection';
import { DataAboutSection } from './settings/sections/DataAboutSection';
import { DateTimeSection } from './settings/sections/DateTimeSection';
import { ExportSection } from './settings/sections/ExportSection';
import { GuidanceSection } from './settings/sections/GuidanceSection';
import { LegalLinksSection } from './settings/sections/LegalLinksSection';
import { NotificationsSection } from './settings/sections/NotificationsSection';
import { ProfileEditSection } from './settings/sections/ProfileEditSection';
import { ProfileSection } from './settings/sections/ProfileSection';
import { ThemeSection } from './settings/sections/ThemeSection';
import { WorkoutPrefsSection } from './settings/sections/WorkoutPrefsSection';

// ============================================================================
// MAIN SETTINGS PAGE (thin orchestrator)
//
// Section order mirrors the numbered labels rendered below:
//   01 חשבון · 02 פרופיל · 03 תצוגה ונגישות · 04 אימון ·
//   05 התראות · 06 פרטיות ונתונים
// Nutrition-goal editing lives in the Nutrition screen (shares the
// "nutrition_goals" key + "settings-updated" event); coach/role lives in
// onboarding + the coach panel — neither is duplicated here.
// ============================================================================

// Sticky jump-nav config. Each chip anchors to a section group below; the
// matching wrapper gets `scrollMarginTop` so it lands clear of the sticky
// header + chip row instead of underneath them.
const JUMP_ITEMS: readonly SettingsJumpItem[] = [
  { id: 'set-account', label: 'חשבון' },
  { id: 'set-profile', label: 'פרופיל' },
  { id: 'set-display', label: 'תצוגה' },
  { id: 'set-workout', label: 'אימון' },
  { id: 'set-coach', label: 'מאמן' },
  { id: 'set-notifications', label: 'התראות' },
  { id: 'set-data', label: 'נתונים' },
  { id: 'set-legal', label: 'משפטי' },
];

// Sticky header height estimate (subtitle + title + vertical padding). The chip
// nav sticks just below it; section anchors clear both via scroll-margin-top.
const SETTINGS_HEADER_OFFSET = 92;
const SETTINGS_JUMP_NAV_HEIGHT = 44;
const SECTION_SCROLL_MARGIN = SETTINGS_HEADER_OFFSET + SETTINGS_JUMP_NAV_HEIGHT;

export default function Settings() {
  const state = useSettingsState();
  const cloudSync = useCloudSync();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // The cloud-sync section reports "connected" only when BOTH the backend is
  // reachable AND the user is actually signed in — a reachable Supabase with no
  // session is NOT a usable cloud connection, so showing "מחובר לענן" there is
  // misleading. authEmail is the real auth signal already loaded in state.
  const cloudConnected = cloudSync.cloudConnected && Boolean(state.authEmail);

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
    // Data-loss guard: signOut wipes local stores, so unsynced mutations
    // would be lost. Try to flush the offline queue first; if entries remain
    // (flush failed or we're offline), warn before proceeding.
    try {
      const { getQueueDepth, processQueue } = await import('../services/offlineQueue');
      let depth = await getQueueDepth();
      if (depth > 0 && navigator.onLine) {
        await processQueue();
        depth = await getQueueDepth();
      }
      if (depth > 0) {
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
      {/* Header — shared PageHeader SSOT. Renders the same ~92px box (safe-area
          padding + 13/26 eyebrow+title + 2px accent border) the hand-rolled
          header did, so SETTINGS_HEADER_OFFSET/SECTION_SCROLL_MARGIN stay valid. */}
      <PageHeader title="הגדרות" eyebrow="התאמות אישיות וסנכרון" />

      <div className="px-5">
        <SettingsJumpNav items={JUMP_ITEMS} top={SETTINGS_HEADER_OFFSET} />
      </div>

      <div className="px-5 pt-5">
        <p
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            marginBottom: '20px',
          }}
        >
          חשבון, פרופיל, תצוגה, אימון, התראות ונתונים במקום אחד.
        </p>

        <div id="set-account" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <AccountSection authEmail={state.authEmail} onSignOut={handleSignOut} />
        </div>

        <Link
          to="/paywall"
          className="active:scale-[0.98]"
          aria-label="פרימיום — הצטרפות לרשימת ההמתנה"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 28,
            padding: '14px 16px',
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

        <div id="set-profile" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <ProfileSection
            profile={state.profile}
            updateProfile={state.updateProfile}
            commitProfile={state.commitProfile}
            profileSaved={state.profileSaved}
          />

          <ProfileEditSection />
        </div>

        <div id="set-display" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <ThemeSection />

          <DateTimeSection />

          <GuidanceSection />
        </div>

        <div id="set-workout" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <WorkoutPrefsSection
            workoutPrefs={state.workoutPrefs}
            commitWorkout={state.commitWorkout}
            workoutSaved={state.workoutSaved}
          />
        </div>

        {/* Coach / role is account-level (become-a-coach flips the whole app
            shell, or edits the business profile) — its own anchor so it stops
            hiding under the "אימון" prefs chip. */}
        <div id="set-coach" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <CoachSection />
        </div>

        <div id="set-notifications" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <NotificationsSection
            notificationConfig={state.notificationConfig}
            toggleNotification={state.toggleNotification}
            notificationsSaved={state.notificationsSaved}
            pushEnabled={state.pushEnabled}
            togglePush={state.togglePush}
          />
        </div>

        {/* 06 · Privacy & data — export, cloud sync and the delete danger-zone */}
        <div id="set-data" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <SectionLabel>פרטיות ונתונים</SectionLabel>

          <ExportSection
            weeklyReport={state.weeklyReport}
            setWeeklyReport={state.setWeeklyReport}
            copiedReport={state.copiedReport}
            setCopiedReport={state.setCopiedReport}
          />

          {isSupabaseConfigured() && (
            <CloudSyncSection
              cloudConnected={cloudConnected}
              isSyncingUp={cloudSync.isSyncingUp}
              isSyncingDown={cloudSync.isSyncingDown}
              isSyncingAll={cloudSync.isSyncingAll}
              syncMessage={cloudSync.syncMessage}
              pendingSyncCount={cloudSync.pendingSyncCount}
              lastSyncTime={cloudSync.lastSyncTime}
              onSyncToCloud={cloudSync.handleSyncToCloud}
              onPullFromCloud={cloudSync.handlePullFromCloud}
              onSyncAll={cloudSync.handleSyncAll}
            />
          )}

          {/* Quarantine separator — detaches the destructive zone from the
              normal export/sync cards so it doesn't read as just another card.
              Kept ABOVE DangerZoneSection so the deleteError negative-margin
              hug below stays intact. */}
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: 'var(--fs-surface-2)',
              margin: '4px 0 24px',
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
        </div>

        {/* Legal & privacy hub — terms, privacy, accessibility + tracking
            consent + blocked users. Now jump-nav reachable (was scroll-only). */}
        <div id="set-legal" style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
          <SectionLabel>משפטי ופרטיות</SectionLabel>
          <LegalLinksSection />

          <BlockedUsersSection />

          <DataAboutSection />
        </div>
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
