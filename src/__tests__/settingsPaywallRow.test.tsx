// ============================================================================
// Settings → the "פרימיום" row — the LINK side of the /paywall admin gate.
//
// /paywall itself is guarded by AdminGuard (paywallRouteGuard.test.tsx pins
// that). This file pins the other half: Settings must not OFFER the row to a
// user the guard will bounce. Offering it to everyone is what produced the
// original defect — an ordinary trainee taps "פרימיום", AdminGuard redirects,
// and they land silently back on the home screen with no feedback at all.
//
// Both directions are load-bearing, and so is the third state:
//   • non-admin  → the row must NOT be in the DOM (no dead end), and
//   • app admin  → the row MUST be there (the owner has to reach the scaffold),
//   • still loading → NOT there, or the row pops in and is yanked back out on
//     every cold load for the 99% who are not admins.
//
// Settings is a thin orchestrator over ~18 section components; those are stubbed
// so the only thing under test is Settings' own `!appAdminLoading && isAppAdmin`
// conditional and the Link it wraps.
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../hooks/useIsAppAdmin';

// ── The hook under test — same one AdminGuard reads, so the row and the
//    destination can never disagree. ────────────────────────────────────────
let adminState: AppAdminState = { isAdmin: false, loading: false };

vi.mock('../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => adminState,
}));

// ── Settings' data hooks. Every field below is passed straight into a stubbed
//    section, so only `authEmail` is actually read during render. ────────────
vi.mock('../pages/settings/hooks/useSettingsState', () => ({
  useSettingsState: () => ({
    authEmail: null,
    setAuthEmail: vi.fn(),
    profile: {},
    updateProfile: vi.fn(),
    commitProfile: vi.fn(),
    profileSaved: false,
    workoutPrefs: {},
    commitWorkout: vi.fn(),
    workoutSaved: false,
    notificationConfig: {},
    toggleNotification: vi.fn(),
    notificationsSaved: false,
    pushEnabled: false,
    togglePush: vi.fn(),
    weeklyReport: '',
    setWeeklyReport: vi.fn(),
    copiedReport: false,
    setCopiedReport: vi.fn(),
  }),
}));

vi.mock('../pages/settings/hooks/useCloudSync', () => ({
  useCloudSync: () => ({
    cloudConnected: false,
    isSyncingUp: false,
    isSyncingDown: false,
    isSyncingAll: false,
    syncMessage: null,
    pendingSyncCount: 0,
    lastSyncTime: null,
    handleSyncToCloud: vi.fn(),
    handlePullFromCloud: vi.fn(),
    handleSyncAll: vi.fn(),
  }),
}));

// ── Services Settings imports at module scope (would reach Supabase/IndexedDB).
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: () => false }));
vi.mock('../services/settingsService', () => ({ deleteAllUserData: vi.fn() }));
vi.mock('../services/supabaseAuth', () => ({ signOut: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Leaf UI + the section components. Stubbed to keep the render surface to
//    Settings' own JSX. ─────────────────────────────────────────────────────
vi.mock('../components/ui/PageHeader', () => ({ default: () => null }));
vi.mock('../components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('../components/ui/SettingsSectionLabel', () => ({
  SectionLabel: () => null,
  SettingsJumpNav: () => null,
}));

// Section stubs. `vi.mock` is hoisted and needs a literal path, so these are
// written out one by one rather than looped.
vi.mock('../pages/settings/sections/AccountSection', () => ({ AccountSection: () => null }));
vi.mock('../pages/settings/sections/BlockedUsersSection', () => ({
  BlockedUsersSection: () => null,
}));
vi.mock('../pages/settings/sections/CloudSyncSection', () => ({ CloudSyncSection: () => null }));
vi.mock('../pages/settings/sections/CoachSection', () => ({ CoachSection: () => null }));
vi.mock('../pages/settings/sections/DangerZoneSection', () => ({ DangerZoneSection: () => null }));
vi.mock('../pages/settings/sections/DataAboutSection', () => ({ DataAboutSection: () => null }));
vi.mock('../pages/settings/sections/DateTimeSection', () => ({ DateTimeSection: () => null }));
vi.mock('../pages/settings/sections/ExportSection', () => ({ ExportSection: () => null }));
vi.mock('../pages/settings/sections/GuidanceSection', () => ({ GuidanceSection: () => null }));
vi.mock('../pages/settings/sections/LegalLinksSection', () => ({ LegalLinksSection: () => null }));
vi.mock('../pages/settings/sections/NotificationsSection', () => ({
  NotificationsSection: () => null,
}));
vi.mock('../pages/settings/sections/ProfileEditSection', () => ({
  ProfileEditSection: () => null,
}));
vi.mock('../pages/settings/sections/ProfileSection', () => ({ ProfileSection: () => null }));
vi.mock('../pages/settings/sections/ThemeSection', () => ({ ThemeSection: () => null }));
vi.mock('../pages/settings/sections/UnsyncedChangesSection', () => ({
  UnsyncedChangesSection: () => null,
}));
vi.mock('../pages/settings/sections/WorkoutPrefsSection', () => ({
  WorkoutPrefsSection: () => null,
}));

import Settings from '../pages/Settings';

/** The row's accessible name, as authored in Settings.tsx. */
const ROW_LABEL = 'פרימיום — הצטרפות לרשימת ההמתנה';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

beforeEach(() => {
  adminState = { isAdmin: false, loading: false };
});

describe('the Settings פרימיום row is offered only to an app admin', () => {
  it('does NOT render the row for a non-admin, so there is no dead-end tap', () => {
    // Arrange — the app_admins lookup has settled: an ordinary trainee.
    adminState = { isAdmin: false, loading: false };

    // Act
    renderSettings();

    // Assert — neither the labelled row nor any link to /paywall exists.
    expect(screen.queryByLabelText(ROW_LABEL)).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('link').filter((a) => a.getAttribute('href') === '/paywall')
    ).toHaveLength(0);
  });

  it('renders the row for an app_admins member, linking to /paywall', () => {
    // The owner cannot judge the scaffold he cannot open.
    adminState = { isAdmin: true, loading: false };

    renderSettings();

    const row = screen.getByLabelText(ROW_LABEL);
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute('href', '/paywall');
  });

  it('does NOT render the row while the admin check is still loading', () => {
    // Rendering optimistically here pops the row in and yanks it out again on
    // every cold load for the overwhelming majority who are not admins.
    adminState = { isAdmin: false, loading: true };

    renderSettings();

    expect(screen.queryByLabelText(ROW_LABEL)).not.toBeInTheDocument();
  });

  it('keeps the row a >=44px touch target when it is shown', () => {
    // Phone-in-a-gym floor. Inline style, so assert on the style attribute.
    adminState = { isAdmin: true, loading: false };

    renderSettings();

    expect(screen.getByLabelText(ROW_LABEL).style.minHeight).toBe('44px');
  });
});
