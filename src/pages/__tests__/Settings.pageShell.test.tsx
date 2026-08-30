// ============================================================================
// Settings → the PAGE CONTAINER. Pins the 480px content cap.
//
// The defect this guards against, twice shipped: Settings had NO width cap at
// all. At a 1280px viewport the content ran ~1238px wide, which put a row's
// label at one end and the control it belongs to ~1100px away at the other, so
// the pair stopped reading as one row. The warmup screen had the identical
// defect and was fixed the same way — by adopting `.page-shell`, the house
// container in components.css, which carries max-width: var(--max-width)
// (480px), margin-inline: auto, padding-inline and the fixed-nav bottom
// clearance.
//
// WHY THIS FILE ASSERTS ON STRUCTURE AND NOT ON PIXELS
// jsdom has no layout engine, and this project runs Vitest with `css: false`
// (vitest.config.ts), so no stylesheet is loaded into the test document at all.
// `getComputedStyle(el).maxWidth` therefore cannot resolve `var(--max-width)`
// and a width measurement here would be fiction. What IS verifiable — and what
// actually regressed — is the CONTRACT: the content column opts into the house
// container, does not hand-roll a competing rule, and the page wash is a
// separate full-bleed layer. The 480px number itself lives in tokens.css and is
// pinned there.
//
// The three failure modes each assertion below catches:
//   1. someone drops `.page-shell` again          → the cap silently vanishes
//   2. someone re-hand-rolls `max-w-*` / `pb-[…]` → two rules fight, drift
//   3. someone caps the WASH instead of the column → the ambient mesh shrinks
//      to a 480px strip down the middle of a wide page
//
// Settings is a thin orchestrator over ~18 section components; they are stubbed
// so the only thing rendered is Settings' own container JSX.
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../../hooks/useIsAppAdmin';

// Admin true so Settings renders its own in-file content (the פרימיום row),
// giving us a node authored in Settings.tsx to prove the cap wraps the CONTENT
// rather than being an empty wrapper somewhere off to the side.
const adminState: AppAdminState = { isAdmin: true, loading: false };

vi.mock('../../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => adminState,
}));

// ── Settings' data hooks. Every field is passed straight into a stubbed
//    section, so only `authEmail` is actually read during render. ────────────
vi.mock('../settings/hooks/useSettingsState', () => ({
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

vi.mock('../settings/hooks/useCloudSync', () => ({
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
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => false }));
vi.mock('../../services/settingsService', () => ({ deleteAllUserData: vi.fn() }));
vi.mock('../../services/supabaseAuth', () => ({ signOut: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Leaf UI + section components, stubbed to keep the render surface to
//    Settings' own JSX. PageHeader is stubbed because it is a sibling of the
//    capped column, not part of it. ─────────────────────────────────────────
vi.mock('../../components/ui/PageHeader', () => ({ default: () => null }));
vi.mock('../../components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('../../components/ui/SettingsSectionLabel', () => ({ SectionLabel: () => null }));

// `vi.mock` is hoisted and needs a literal path, so these are written out one by
// one rather than looped.
vi.mock('../settings/sections/AccountSection', () => ({ AccountSection: () => null }));
vi.mock('../settings/sections/BackupSection', () => ({ BackupSection: () => null }));
vi.mock('../settings/sections/BlockedUsersSection', () => ({ BlockedUsersSection: () => null }));
vi.mock('../settings/sections/CloudSyncDirectional', () => ({ CloudSyncDirectional: () => null }));
vi.mock('../settings/sections/CloudSyncSection', () => ({ CloudSyncSection: () => null }));
vi.mock('../settings/sections/CoachSection', () => ({ CoachSection: () => null }));
vi.mock('../settings/sections/DangerZoneSection', () => ({ DangerZoneSection: () => null }));
vi.mock('../settings/sections/DataAboutSection', () => ({ DataAboutSection: () => null }));
vi.mock('../settings/sections/GuidanceSection', () => ({ GuidanceSection: () => null }));
vi.mock('../settings/sections/LegalLinksSection', () => ({ LegalLinksSection: () => null }));
vi.mock('../settings/sections/NotificationsSection', () => ({ NotificationsSection: () => null }));
vi.mock('../settings/sections/ProfileEditSection', () => ({ ProfileEditSection: () => null }));
vi.mock('../settings/sections/ProfileSection', () => ({ ProfileSection: () => null }));
vi.mock('../settings/sections/ThemeSection', () => ({ ThemeSection: () => null }));
vi.mock('../settings/sections/UnsyncedChangesSection', () => ({
  UnsyncedChangesSection: () => null,
}));
vi.mock('../settings/sections/WeeklyReportSection', () => ({ WeeklyReportSection: () => null }));
vi.mock('../settings/sections/WorkoutPrefsSection', () => ({ WorkoutPrefsSection: () => null }));

import Settings from '../Settings';

/** The פרימיום row's accessible name, as authored in Settings.tsx. */
const ROW_LABEL = 'פרימיום — הצטרפות לרשימת ההמתנה';

/**
 * Renders Settings and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderSettings() {
  const { container } = render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );

  const wash = container.querySelector('.ambient-mesh');
  const column = container.querySelector('.page-shell');
  return { container, wash, column };
}

describe('Settings caps its content column with the house .page-shell container', () => {
  it('puts the content in a .page-shell column, which is where the 480px cap comes from', () => {
    // This is the whole fix. `.page-shell` (components.css) carries
    // max-width: var(--max-width) → 480px (tokens.css). Without this class the
    // page has no cap whatsoever and stretches to the full viewport.
    const { column } = renderSettings();

    expect(column).not.toBeNull();
  });

  it('wraps Settings own content in that capped column, not an empty wrapper', () => {
    // A cap on a container that does not actually hold the rows would fix
    // nothing — the ~1100px label/control split was INSIDE the content.
    const { column } = renderSettings();

    expect(column).toContainElement(screen.getByLabelText(ROW_LABEL));
  });

  it('does NOT re-implement the cap or the bottom padding on the column', () => {
    // Adopt the house container, do not hand-roll beside it. A `max-w-*`
    // utility or a `pb-[max(7rem,…)]` arbitrary value here means two rules are
    // competing and one of them will drift.
    const { column } = renderSettings();
    const cls = column?.className ?? '';

    expect(cls).toContain('page-shell');
    expect(cls).not.toMatch(/max-w-/);
    expect(cls).not.toMatch(/\bpb-\[/);
  });

  it('keeps the page wash full-bleed on a separate ancestor layer', () => {
    // The wash and the content column are different concerns. Capping the
    // element that carries the ambient mesh would shrink the background to a
    // 480px strip down the middle of a wide page — a visible regression in the
    // opposite direction.
    const { wash, column } = renderSettings();

    expect(wash).not.toBeNull();
    expect(wash).not.toBe(column);
    expect(wash).toContainElement(column as HTMLElement);
    expect(wash?.className ?? '').not.toContain('page-shell');
    // …and the wash must not carry the old hand-rolled bottom padding either;
    // `.page-shell` owns that now, so leaving it here would double it up.
    expect(wash?.className ?? '').not.toMatch(/\bpb-\[/);
  });
});
