import { Bell } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { useWorkoutReminderSchedule } from '../../../hooks/useWorkoutReminderSchedule';
import { isPushSupported } from '../../../services/coach/pushService';
import type { NotificationConfig } from '../../../services/notificationService';
import { isNativePlatform } from '../../../utils/platform';
import { Divider } from '../components/Divider';
import { SavedIndicator } from '../components/SavedIndicator';

interface Props {
  notificationConfig: NotificationConfig;
  toggleNotification: (key: keyof NotificationConfig) => void;
  notificationsSaved: boolean;
  pushEnabled: boolean;
  togglePush: () => Promise<void>;
}

/** Sunday first — the Israeli week. `value` is the NotificationConfig day index. */
const REMINDER_DAYS: ReadonlyArray<{ value: number; short: string; label: string }> = [
  { value: 0, short: 'א', label: 'יום ראשון' },
  { value: 1, short: 'ב', label: 'יום שני' },
  { value: 2, short: 'ג', label: 'יום שלישי' },
  { value: 3, short: 'ד', label: 'יום רביעי' },
  { value: 4, short: 'ה', label: 'יום חמישי' },
  { value: 5, short: 'ו', label: 'יום שישי' },
  { value: 6, short: 'ש', label: 'שבת' },
];

export function NotificationsSection({
  notificationConfig,
  toggleNotification,
  notificationsSaved,
  pushEnabled,
  togglePush,
}: Props) {
  const pushSupported = isPushSupported();
  const pushMeta = pushSupported
    ? 'הודעות ושיוכים מהמאמן גם כשהאפליקציה סגורה'
    : 'הדפדפן לא תומך בהתראות';

  const schedule = useWorkoutReminderSchedule(notificationConfig);
  const remindersOn = notificationConfig.workoutReminderEnabled;
  const native = isNativePlatform();

  // Permission is asked here and only here — the moment the user turns reminders
  // on. If the OS refuses, the toggle is never flipped.
  const onToggleReminders = async () => {
    if (!remindersOn && !(await schedule.requestEnable())) return;
    await toggleNotification('workoutReminderEnabled');
    schedule.resync();
  };

  return (
    <div className="mb-5">
      <SectionLabel trailing={<SavedIndicator saved={notificationsSaved} />}>התראות</SectionLabel>
      <SettingsCard>
        {/* Gates the missed-workout alert (checkMissedWorkouts) AND the on-device
            schedule (services/localRemindersSync). The nutrition-reminder toggle
            was removed — no scheduler exists, so it did nothing. */}
        <SettingsRow icon={<Bell size={15} />} label="תזכורת אימון" divider={true}>
          <SettingsToggle checked={remindersOn} onChange={onToggleReminders} label="תזכורת אימון" />
        </SettingsRow>

        {/* Sits OUTSIDE the enabled-only block on purpose: when the OS refuses,
            the toggle stays off and this is the only thing that explains why. */}
        {schedule.permissionDenied && (
          <div className="px-4 pb-3 pt-1">
            <span
              role="alert"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
                display: 'block',
              }}
            >
              ההתראות חסומות. אפשר לאשר אותן בהגדרות המכשיר, במסך ההתראות של האפליקציה.
            </span>
          </div>
        )}

        {remindersOn && (
          <>
            <div className="px-4 pb-4">
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--fs-muted)',
                  display: 'block',
                  marginBottom: '10px',
                }}
              >
                {native
                  ? 'התזכורת נשלחת מהמכשיר עצמו, גם כשהאפליקציה סגורה.'
                  : 'ההגדרה נשמרת, אך התזכורות עצמן נשלחות רק באפליקציה לאנדרואיד.'}
              </span>

              {/* One row of seven equal columns: at 390px a wrapping flex row left
                  Saturday alone on a second line. */}
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
                role="group"
                aria-label="ימי תזכורת"
              >
                {REMINDER_DAYS.map((day) => {
                  const active = schedule.days.includes(day.value);
                  return (
                    <button
                      type="button"
                      key={day.value}
                      aria-pressed={active}
                      aria-label={day.label}
                      onClick={() => schedule.toggleDay(day.value)}
                      className="focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:outline-none"
                      style={{
                        minHeight: '44px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '15px',
                        fontWeight: 600,
                        borderRadius: 12,
                        cursor: 'pointer',
                        border: '1px solid var(--fs-surface-2)',
                        // The SELECTION pair, identical to the rest-time chips in
                        // WorkoutPrefsSection one card above — a chip is a
                        // selection, not a call to action, so it must not wear the
                        // mint action fill.
                        ...(active
                          ? { background: 'var(--fs-primary)', color: 'var(--fs-accent)' }
                          : { background: 'transparent', color: 'var(--fs-muted)' }),
                      }}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <Divider />

            <SettingsRow icon={<Bell size={15} />} label="שעת התזכורת" divider={true}>
              <input
                type="time"
                dir="ltr"
                value={schedule.time}
                aria-label="שעת התזכורת"
                onChange={(event) => schedule.setTime(event.target.value)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '15px',
                  borderRadius: 12,
                  border: '1px solid var(--fs-surface-2)',
                  background: 'var(--fs-surface-2)',
                  color: 'var(--fs-ink)',
                }}
              />
            </SettingsRow>
          </>
        )}

        <SettingsRow icon={<Bell size={15} />} label="התראת שיא אישי (PR)" divider={true}>
          <SettingsToggle
            checked={notificationConfig.prNotificationEnabled}
            onChange={() => toggleNotification('prNotificationEnabled')}
            label="התראת PR"
          />
        </SettingsRow>

        <div className="flex flex-col">
          <div className="flex items-start gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <Bell size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--fs-ink)',
                  display: 'block',
                }}
              >
                התראות בזמן אמת
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--fs-muted)',
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {pushMeta}
              </span>
            </div>
            <div className="shrink-0 self-center">
              <SettingsToggle
                checked={pushEnabled}
                onChange={togglePush}
                label="התראות בזמן אמת"
                disabled={!pushSupported}
              />
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
