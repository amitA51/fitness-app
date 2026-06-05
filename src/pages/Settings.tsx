import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionLabel } from '../components/ui/SettingsSectionLabel';
import { isSupabaseConfigured } from '../lib/supabase';
import { deleteAllUserData } from '../services/settingsService';
import { signOut } from '../services/supabaseAuth';
import { logger } from '../utils/logger';
import { useCloudSync } from './settings/hooks/useCloudSync';
import { useSettingsState } from './settings/hooks/useSettingsState';
import { AccountSection } from './settings/sections/AccountSection';
import { CloudSyncSection } from './settings/sections/CloudSyncSection';
import { DangerZoneSection } from './settings/sections/DangerZoneSection';
import { DataAboutSection } from './settings/sections/DataAboutSection';
import { ExportSection } from './settings/sections/ExportSection';
import { GuidanceSection } from './settings/sections/GuidanceSection';
import { NotificationsSection } from './settings/sections/NotificationsSection';
import { ProfileSection } from './settings/sections/ProfileSection';
import { ThemeSection } from './settings/sections/ThemeSection';
import { WorkoutPrefsSection } from './settings/sections/WorkoutPrefsSection';
import { HEADER_SUBTITLE_STYLE, HEADER_TITLE_STYLE } from './settings/types';

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

export default function Settings() {
  const state = useSettingsState();
  const cloudSync = useCloudSync();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The cloud-sync section reports "connected" only when BOTH the backend is
  // reachable AND the user is actually signed in — a reachable Supabase with no
  // session is NOT a usable cloud connection, so showing "מחובר לענן" there is
  // misleading. authEmail is the real auth signal already loaded in state.
  const cloudConnected = cloudSync.cloudConnected && Boolean(state.authEmail);

  // ── Handlers that bridge state + services ──────────────────────────────────

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      logger.app.warn('handleSignOut: signOut threw', err);
    }
    state.setAuthEmail(null);
    window.location.reload();
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
      {/* Header */}
      <header
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
          paddingBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <p style={HEADER_SUBTITLE_STYLE}>התאמות אישיות וסנכרון</p>
        <h1 style={HEADER_TITLE_STYLE}>הגדרות</h1>
      </header>

      <div className="px-4 pt-5">
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

        <AccountSection authEmail={state.authEmail} onSignOut={handleSignOut} />

        <ProfileSection
          profile={state.profile}
          updateProfile={state.updateProfile}
          commitProfile={state.commitProfile}
          profileSaved={state.profileSaved}
        />

        <ThemeSection />

        <GuidanceSection />

        <WorkoutPrefsSection
          workoutPrefs={state.workoutPrefs}
          commitWorkout={state.commitWorkout}
          workoutSaved={state.workoutSaved}
        />

        <NotificationsSection
          notificationConfig={state.notificationConfig}
          toggleNotification={state.toggleNotification}
          notificationsSaved={state.notificationsSaved}
        />

        {/* 06 · Privacy & data — export, cloud sync and the delete danger-zone */}
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

        <DataAboutSection />

        {/* Accessibility statement link — required by Israeli IS 5568 regulations */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--fs-border)',
            textAlign: 'center',
          }}
        >
          <Link
            to="/accessibility"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--fs-accent)',
              textDecoration: 'underline',
            }}
          >
            הצהרת נגישות
          </Link>
        </div>
      </div>
    </div>
  );
}
