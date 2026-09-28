// ============================================================================
// NotificationsSection — the 'תזכורת אימון' schedule UI
// ============================================================================
// The toggle used to be cosmetic: nothing scheduled anything, and there was no
// day/time UI at all. These tests pin the three things that make it real:
//   1. the day/time controls appear only when reminders are ON, and every change
//      lands in the SAME NotificationConfig the device scheduler reads;
//   2. permission is requested at the moment of turning reminders on — and a
//      refusal leaves the toggle OFF instead of saving a promise we cannot keep;
//   3. every chip is a 44px target with a Hebrew accessible name.
// ============================================================================

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationConfig } from '../../../../services/notificationService';
import { getNotificationConfig } from '../../../../services/notificationService';
import { NotificationsSection } from '../NotificationsSection';

const requestReminderPermission = vi.fn(
  async (): Promise<'granted' | 'denied' | 'unsupported'> => 'granted'
);
const syncReminders = vi.fn(async () => {});
vi.mock('../../../../services/localRemindersSync', () => ({
  requestReminderPermission: () => requestReminderPermission(),
  syncReminders: () => syncReminders(),
}));

// The real push service reaches for a service worker and a VAPID key.
vi.mock('../../../../services/coach/pushService', () => ({
  isPushSupported: () => false,
}));

const config = (overrides: Partial<NotificationConfig> = {}): NotificationConfig => ({
  workoutReminderEnabled: true,
  workoutReminderTime: '18:00',
  workoutReminderDays: [0, 1],
  missedWorkoutAlertDays: 3,
  lastNudgeScheduledAt: null,
  nutritionReminderEnabled: false,
  nutritionReminderTimes: [],
  prNotificationEnabled: true,
  ...overrides,
});

const renderSection = (overrides: Partial<NotificationConfig> = {}) => {
  const toggleNotification = vi.fn();
  render(
    <NotificationsSection
      notificationConfig={config(overrides)}
      toggleNotification={toggleNotification}
      notificationsSaved={false}
      pushEnabled={false}
      togglePush={async () => {}}
    />
  );
  return { toggleNotification };
};

beforeEach(() => {
  localStorage.clear();
  requestReminderPermission.mockReset();
  requestReminderPermission.mockResolvedValue('granted');
  syncReminders.mockClear();
});

describe('NotificationsSection · reminder schedule', () => {
  it('hides the day and time controls while reminders are off', () => {
    renderSection({ workoutReminderEnabled: false });

    expect(screen.queryByRole('group', { name: 'ימי תזכורת' })).toBeNull();
    expect(screen.queryByLabelText('שעת התזכורת')).toBeNull();
  });

  it('renders seven day chips, Sunday first, 44px tall, on ONE seven-column row', () => {
    renderSection();

    const group = screen.getByRole('group', { name: 'ימי תזכורת' });
    const chips = within(group).getAllByRole('button');
    expect(chips).toHaveLength(7);
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'יום ראשון',
      'יום שני',
      'יום שלישי',
      'יום רביעי',
      'יום חמישי',
      'יום שישי',
      'שבת',
    ]);
    // Seven 44px-wide chips do not fit a 390px card, and a wrapping row left
    // Saturday alone on a second line. One equal-column row is the platform's
    // own weekday pattern (Android Clock): each chip takes 1/7 of the row
    // (~40px, well over the 24px WCAG 2.5.8 floor) at the full 44px height.
    expect(group.style.gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))');
    for (const chip of chips) {
      expect(chip.style.minHeight).toBe('44px');
    }
  });

  it('marks the stored days as pressed and the rest as not', () => {
    renderSection({ workoutReminderDays: [0, 1] });

    expect(screen.getByRole('button', { name: 'יום ראשון' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'יום שלישי' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('persists a day into the shared NotificationConfig and resyncs the device', async () => {
    renderSection({ workoutReminderDays: [0, 1] });

    await userEvent.click(screen.getByRole('button', { name: 'יום שלישי' }));

    expect(getNotificationConfig().workoutReminderDays).toEqual([0, 1, 2]);
    expect(syncReminders).toHaveBeenCalled();
  });

  it('removes a day that was already chosen', async () => {
    renderSection({ workoutReminderDays: [0, 1] });

    await userEvent.click(screen.getByRole('button', { name: 'יום שני' }));

    expect(getNotificationConfig().workoutReminderDays).toEqual([0]);
  });

  it('persists the reminder time', () => {
    renderSection();

    fireEvent.change(screen.getByLabelText('שעת התזכורת'), { target: { value: '19:30' } });

    expect(getNotificationConfig().workoutReminderTime).toBe('19:30');
    expect(syncReminders).toHaveBeenCalled();
  });

  it('does not persist a half-cleared time', () => {
    renderSection();

    fireEvent.change(screen.getByLabelText('שעת התזכורת'), { target: { value: '' } });

    expect(localStorage.getItem('sparkos_notification_config')).toBeNull();
  });
});

describe('NotificationsSection · permission', () => {
  it('asks for permission only when turning reminders ON', async () => {
    const { toggleNotification } = renderSection({ workoutReminderEnabled: false });

    await userEvent.click(screen.getByRole('switch', { name: 'תזכורת אימון' }));

    expect(requestReminderPermission).toHaveBeenCalledTimes(1);
    expect(toggleNotification).toHaveBeenCalledWith('workoutReminderEnabled');
  });

  it('does not ask again when turning reminders OFF', async () => {
    const { toggleNotification } = renderSection({ workoutReminderEnabled: true });

    await userEvent.click(screen.getByRole('switch', { name: 'תזכורת אימון' }));

    expect(requestReminderPermission).not.toHaveBeenCalled();
    expect(toggleNotification).toHaveBeenCalledWith('workoutReminderEnabled');
  });

  it('leaves the toggle OFF and explains itself when the OS refuses', async () => {
    requestReminderPermission.mockResolvedValue('denied');
    const { toggleNotification } = renderSection({ workoutReminderEnabled: false });

    await userEvent.click(screen.getByRole('switch', { name: 'תזכורת אימון' }));

    expect(toggleNotification).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('ההתראות חסומות');
  });
});
