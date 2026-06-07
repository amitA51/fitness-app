import { Bell } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { isPushSupported } from '../../../services/coach/pushService';
import type { NotificationConfig } from '../../../services/notificationService';
import { SavedIndicator } from '../components/SavedIndicator';

interface Props {
  notificationConfig: NotificationConfig;
  toggleNotification: (key: keyof NotificationConfig) => void;
  notificationsSaved: boolean;
  pushEnabled: boolean;
  togglePush: () => Promise<void>;
}

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

  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={notificationsSaved} />}>התראות</SectionLabel>
      <SettingsCard>
        <SettingsRow icon={<Bell size={15} />} label="תזכורת אימון" divider={true}>
          <SettingsToggle
            checked={notificationConfig.workoutReminderEnabled}
            onChange={() => toggleNotification('workoutReminderEnabled')}
            label="תזכורת אימון"
          />
        </SettingsRow>

        <SettingsRow icon={<Bell size={15} />} label="תזכורת תזונה" divider={true}>
          <SettingsToggle
            checked={notificationConfig.nutritionReminderEnabled}
            onChange={() => toggleNotification('nutritionReminderEnabled')}
            label="תזכורת תזונה"
          />
        </SettingsRow>

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
