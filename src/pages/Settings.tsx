import { useCoach } from '../contexts/CoachContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { updateMyProfile } from '../services/coach/profileService';
import { deleteAllUserData } from '../services/settingsService';
import { signOut } from '../services/supabaseAuth';
import { logger } from '../utils/logger';
import { useCloudSync } from './settings/hooks/useCloudSync';
import { useSettingsState } from './settings/hooks/useSettingsState';
import { AccountSection } from './settings/sections/AccountSection';
import { CloudSyncSection } from './settings/sections/CloudSyncSection';
import { CoachingSection } from './settings/sections/CoachingSection';
import { DangerZoneSection } from './settings/sections/DangerZoneSection';
import { DataAboutSection } from './settings/sections/DataAboutSection';
import { ExportSection } from './settings/sections/ExportSection';
import { NotificationsSection } from './settings/sections/NotificationsSection';
import { NutritionSection } from './settings/sections/NutritionSection';
import { ProfileSection } from './settings/sections/ProfileSection';
import { ThemeSection } from './settings/sections/ThemeSection';
import { WorkoutPrefsSection } from './settings/sections/WorkoutPrefsSection';
import { HEADER_SUBTITLE_STYLE, HEADER_TITLE_STYLE } from './settings/types';

// ============================================================================
// MAIN SETTINGS PAGE (thin orchestrator)
// ============================================================================

export default function Settings() {
  const { isCoach, enable } = useCoach();
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

  const handleSaveCoachName = async () => {
    await updateMyProfile({ displayName: state.coachName.trim() || null });
    state.setCoachNameSaved(true);
    setTimeout(() => state.setCoachNameSaved(false), 2000);
  };

  const handleEnableCoach = async () => {
    if (isCoach || state.enablingCoach) return;
    state.setEnablingCoach(true);
    try {
      await enable();
    } catch (err) {
      logger.app.warn('enable coach mode failed', err);
    } finally {
      state.setEnablingCoach(false);
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
          התאמות מובייל, אימון, תזונה וסנכרון במקום אחד.
        </p>

        <ProfileSection
          profile={state.profile}
          setProfile={state.setProfile}
          profileSaved={state.profileSaved}
          onSave={state.handleSaveProfile}
        />

        <AccountSection authEmail={state.authEmail} onSignOut={handleSignOut} />

        <CoachingSection
          isCoach={isCoach}
          coachName={state.coachName}
          setCoachName={state.setCoachName}
          coachNameSaved={state.coachNameSaved}
          onSaveCoachName={handleSaveCoachName}
          onEnableCoach={handleEnableCoach}
        />

        <NutritionSection
          profile={state.profile}
          nutrition={state.nutrition}
          setNutrition={state.setNutrition}
          nutritionSaved={state.nutritionSaved}
          onSave={state.handleSaveNutrition}
        />

        <WorkoutPrefsSection
          workoutPrefs={state.workoutPrefs}
          setWorkoutPrefs={state.setWorkoutPrefs}
          workoutSaved={state.workoutSaved}
          onSave={state.handleSaveWorkout}
        />

        <NotificationsSection
          notificationSettings={state.notificationSettings}
          toggleNotification={state.toggleNotification}
        />

        <ThemeSection
          darkMode={state.settings.darkMode}
          onToggle={() => state.updateSettings({ darkMode: !state.settings.darkMode })}
        />

        <DataAboutSection />

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

        <ExportSection
          weeklyReport={state.weeklyReport}
          setWeeklyReport={state.setWeeklyReport}
          copiedReport={state.copiedReport}
          setCopiedReport={state.setCopiedReport}
        />

        <DangerZoneSection
          confirmDelete={state.confirmDelete}
          setConfirmDelete={state.setConfirmDelete}
          onDeleteAll={handleDeleteAllData}
        />
      </div>
    </div>
  );
}
