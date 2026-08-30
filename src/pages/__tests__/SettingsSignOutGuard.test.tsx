// ============================================================================
// T-111 — the sign-out guard must count UNSYNCED LOCAL SESSIONS, not just queue
// depth.
// ============================================================================
// THE EXACT HOLE. signOut wipes the local stores and clears both the active queue
// and the dead-letter store. The guard decided whether to warn from queue depth +
// dead-letter count — and a workout written while getCurrentUser() returned null
// (a 401 during token refresh) had entered NEITHER. Both counters read zero, the
// dialog never appeared, and the wipe took the only copy of the workout.
//
// The first test below is that case: EMPTY queue, EMPTY dead-letter store, one
// unsynced local session. It fails on the pre-fix guard, which signs straight out.
// ============================================================================

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../../hooks/useIsAppAdmin';

const adminState: AppAdminState = { isAdmin: false, loading: false };
vi.mock('../../hooks/useIsAppAdmin', () => ({ useIsAppAdmin: () => adminState }));

const getQueueDepth = vi.fn();
const getDeadLetterCount = vi.fn();
const processQueue = vi.fn();
const getUnsyncedRecordCounts = vi.fn();
const flushUnsyncedSessions = vi.fn();
const signOut = vi.fn();

vi.mock('../../services/offlineQueue', () => ({
  getQueueDepth: () => getQueueDepth(),
  getDeadLetterCount: () => getDeadLetterCount(),
  processQueue: () => processQueue(),
}));

vi.mock('../../services/sessionDb', () => ({
  getUnsyncedRecordCounts: () => getUnsyncedRecordCounts(),
  flushUnsyncedSessions: () => flushUnsyncedSessions(),
}));

/** One ledger, two buckets: workouts and everything else (nutrition/water/body). */
const setUnsynced = (sessions: number, others = 0) =>
  getUnsyncedRecordCounts.mockResolvedValue({
    sessions,
    others,
    total: sessions + others,
  });

vi.mock('../../services/supabaseAuth', () => ({ signOut: () => signOut() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: () => true }));
vi.mock('../../services/settingsService', () => ({ deleteAllUserData: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  logger: {
    app: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sync: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

vi.mock('../settings/hooks/useSettingsState', () => ({
  useSettingsState: () => ({
    authEmail: 'lifter@example.com',
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

// AccountSection is reduced to the one control under test: the sign-out trigger
// wired to Settings' own handler.
vi.mock('../settings/sections/AccountSection', () => ({
  AccountSection: ({ onSignOut }: { onSignOut: () => void }) => (
    <button type="button" onClick={onSignOut}>
      התנתקות
    </button>
  ),
}));

// ConfirmDialog is stubbed to a plain node so the assertion is on the DECISION
// and the copy, not on ModalOverlay's focus trap and motion.
vi.mock('../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    description,
  }: {
    isOpen: boolean;
    title: string;
    description: string;
  }) =>
    isOpen ? (
      <div role="alertdialog" aria-label={title}>
        {description}
      </div>
    ) : null,
}));

vi.mock('../../components/ui/PageHeader', () => ({ default: () => null }));
vi.mock('../../components/ui/SettingsSectionLabel', () => ({ SectionLabel: () => null }));
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

const reload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getQueueDepth.mockResolvedValue(0);
  getDeadLetterCount.mockResolvedValue(0);
  processQueue.mockResolvedValue({ success: 0, failed: 0 });
  setUnsynced(0);
  flushUnsyncedSessions.mockResolvedValue({ pushed: 0, queued: 0 });
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  // performSignOut reloads the page; jsdom has no navigation.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

const clickSignOut = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
  await user.click(screen.getByRole('button', { name: 'התנתקות' }));
};

describe('Settings sign-out guard', () => {
  it('warns when an unsynced local workout exists even though the queue is EMPTY', async () => {
    getQueueDepth.mockResolvedValue(0);
    getDeadLetterCount.mockResolvedValue(0);
    setUnsynced(1);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog', { name: 'התנתקות מהחשבון' });
    expect(dialog).toHaveTextContent('במכשיר שמור אימון אחד שטרם הגיע לענן');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('names the number of workouts when several are at risk', async () => {
    setUnsynced(3);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('במכשיר שמורים 3 אימונים שטרם הגיעו לענן');
  });

  it('mentions the queued changes as well when both kinds of loss are pending', async () => {
    getQueueDepth.mockResolvedValue(2);
    setUnsynced(1);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('במכשיר שמור אימון אחד שטרם הגיע לענן');
    expect(dialog).toHaveTextContent('יש גם שינויים נוספים שטרם סונכרנו');
  });

  it('tries to flush the ledger before deciding, so it does not cry wolf', async () => {
    getUnsyncedRecordCounts.mockResolvedValueOnce({ sessions: 0, others: 0, total: 0 });
    flushUnsyncedSessions.mockResolvedValue({ pushed: 1, queued: 0 });

    await clickSignOut();

    await waitFor(() => expect(flushUnsyncedSessions).toHaveBeenCalledOnce());
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the original wording when only queued changes are at risk', async () => {
    getQueueDepth.mockResolvedValue(1);
    setUnsynced(0);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('יש שינויים שטרם סונכרנו לענן');
  });

  it('signs out without a dialog when there is genuinely nothing to lose', async () => {
    await clickSignOut();

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

// ── T-115 · the hole for nutrition / water / body-stat rows ──────────────────
// EXACTLY the shape T-111 closed for workouts, one store over. The ledger only
// ever read its markers against WORKOUT_SESSIONS, so an orphaned meal, glass of
// water or weigh-in was counted by NOTHING — queue depth 0, held 0, workouts 0 —
// and sign-out's Object.values(STORES) wipe then destroyed it. These fail on the
// pre-fix guard, which signs straight out.
describe('Settings sign-out guard for records that are not workouts', () => {
  it('warns when an unsynced non-workout record exists and the queue is EMPTY', async () => {
    getQueueDepth.mockResolvedValue(0);
    getDeadLetterCount.mockResolvedValue(0);
    setUnsynced(0, 1);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog', { name: 'התנתקות מהחשבון' });
    expect(dialog).toHaveTextContent('במכשיר שמורה רשומה אחת שטרם הגיעה לענן');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('names the number of records when several stores have orphans', async () => {
    getQueueDepth.mockResolvedValue(0);
    getDeadLetterCount.mockResolvedValue(0);
    // e.g. one meal, one glass of water, one weigh-in.
    setUnsynced(0, 3);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('במכשיר שמורות 3 רשומות שטרם הגיעו לענן');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('names workouts and other records separately when both are at risk', async () => {
    setUnsynced(1, 2);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('במכשיר שמור אימון אחד שטרם הגיע לענן');
    expect(dialog).toHaveTextContent('שמורות גם 2 רשומות נוספות שטרם הגיעו לענן');
  });

  it('still ends with the actionable instruction rather than only a verdict', async () => {
    setUnsynced(0, 1);

    await clickSignOut();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('בטלו וסנכרנו קודם');
  });
});
