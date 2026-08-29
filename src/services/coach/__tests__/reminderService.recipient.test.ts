// ============================================================================
// Reminder materialization — RECIPIENT scoping
// ----------------------------------------------------------------------------
// RLS on `reminders` returns the UNION of two policies: `reminders_all_own`
// (rows the viewer AUTHORED — coach_id = auth.uid()) and
// `reminders_select_target` (rows the viewer RECEIVES — client_id = auth.uid()
// or group member). The local materializer runs for every signed-in user, so
// without an explicit recipient check a coach's own device fires the reminders
// they scheduled for their clients.
//
// The discriminator is the RECIPIENT of the row (client_id, else group_id
// membership) — never the role of the viewer: a coach is also a trainee and
// must keep receiving their own reminders.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  COACH: 'coach-1',
  OTHER_COACH: 'coach-2',
  CLIENT: 'client-9',
  GROUP_MINE: 'group-mine',
  GROUP_THEIRS: 'group-theirs',
  reminders: [] as Record<string, unknown>[],
  memberships: [] as { group_id: string }[],
  showNotification: vi.fn(async () => undefined),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'client_group_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: h.memberships, error: null })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(async () => ({ data: h.reminders, error: null })),
        })),
      };
    }),
  },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: h.COACH })),
}));

vi.mock('../../notificationService', () => ({
  showNotification: h.showNotification,
}));

import { materializeDueReminders } from '../reminderService';

/** 2026-01-05 09:30 LOCAL — isReminderDue matches on local hours/minutes. */
const NOW = new Date(2026, 0, 5, 9, 30, 0);

const row = (over: Record<string, unknown>): Record<string, unknown> => ({
  coach_id: h.COACH,
  client_id: null,
  group_id: null,
  title: 'תזכורת',
  body: null,
  schedule: { time: '09:30' },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.reminders = [];
  h.memberships = [];
});

describe('materializeDueReminders — recipient scoping', () => {
  it('does NOT fire a reminder the coach authored for a client (client_id is someone else)', async () => {
    h.reminders = [row({ id: 'r-client', client_id: h.CLIENT, title: 'לשתות מים' })];

    const fired = await materializeDueReminders(NOW);

    expect(fired).toBe(0);
    expect(h.showNotification).not.toHaveBeenCalled();
  });

  it("STILL fires the coach's own reminders (client_id is the viewer)", async () => {
    h.reminders = [
      // Scheduled for the coach by their own coach.
      row({ id: 'r-mine', coach_id: h.OTHER_COACH, client_id: h.COACH, title: 'אימון רגליים' }),
      // A coach is also a trainee of their own program — self-authored, self-addressed.
      row({ id: 'r-self', client_id: h.COACH, title: 'מדידת משקל' }),
    ];

    const fired = await materializeDueReminders(NOW);

    expect(fired).toBe(2);
    expect(h.showNotification).toHaveBeenCalledTimes(2);
    const titles = h.showNotification.mock.calls.map((c) => (c as unknown as string[])[0]);
    expect(titles).toEqual(expect.arrayContaining(['אימון רגליים', 'מדידת משקל']));
  });

  it('does NOT fire a group reminder the coach authored for a group they are not in', async () => {
    h.reminders = [row({ id: 'r-group-theirs', group_id: h.GROUP_THEIRS, title: 'אתגר קבוצתי' })];
    h.memberships = [];

    const fired = await materializeDueReminders(NOW);

    expect(fired).toBe(0);
    expect(h.showNotification).not.toHaveBeenCalled();
  });

  it('fires a group reminder for a group the viewer is a member of', async () => {
    h.reminders = [
      row({
        id: 'r-group-mine',
        coach_id: h.OTHER_COACH,
        group_id: h.GROUP_MINE,
        title: 'אתגר שלי',
      }),
    ];
    h.memberships = [{ group_id: h.GROUP_MINE }];

    const fired = await materializeDueReminders(NOW);

    expect(fired).toBe(1);
    expect(h.showNotification).toHaveBeenCalledTimes(1);
  });

  it('mirrors the server dispatcher: client_id wins over group_id when both are set', async () => {
    // reminders-dispatch resolves `if (client_id) targets=[client_id] else group`.
    h.reminders = [
      row({ id: 'r-both', client_id: h.CLIENT, group_id: h.GROUP_MINE, title: 'לא שלי' }),
    ];
    h.memberships = [{ group_id: h.GROUP_MINE }];

    const fired = await materializeDueReminders(NOW);

    expect(fired).toBe(0);
    expect(h.showNotification).not.toHaveBeenCalled();
  });
});
