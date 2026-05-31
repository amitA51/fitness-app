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
    await deleteAllUserData();
    window.location.reload();
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
          setProfile={state.setProfile}
          profileSaved={state.profileSaved}
          onSave={state.handleSaveProfile}
        />

        <ThemeSection />

        <WorkoutPrefsSection
          workoutPrefs={state.workoutPrefs}
          setWorkoutPrefs={state.setWorkoutPrefs}
          workoutSaved={state.workoutSaved}
          onSave={state.handleSaveWorkout}
        />

        <NotificationsSection
          notificationConfig={state.notificationConfig}
          toggleNotification={state.toggleNotification}
        />

        {/* 06 · Privacy & data — export, cloud sync and the delete danger-zone */}
        <SectionLabel num="06" titleEn="PRIVACY · DATA">
          פרטיות ונתונים
        </SectionLabel>

        <ExportSection
          weeklyReport={state.weeklyReport}
          setWeeklyReport={state.setWeeklyReport}
          copiedReport={state.copiedReport}
          setCopiedReport={state.setCopiedReport}
        />

        {isSupabaseConfigured() && (
          <CloudSyncSection
            cloudConnected={cloudSync.cloudConnected}
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

        <DangerZoneSection
          confirmDelete={state.confirmDelete}
          setConfirmDelete={state.setConfirmDelete}
          onDeleteAll={handleDeleteAllData}
        />

        <DataAboutSection />
      </div>
    </div>
  );
}
