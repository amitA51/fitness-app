import { Bell } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import type { NotificationConfig } from '../../../services/notificationService';
import { SavedIndicator } from '../components/SavedIndicator';

interface Props {
  notificationConfig: NotificationConfig;
  toggleNotification: (key: keyof NotificationConfig) => void;
  notificationsSaved: boolean;
}

export function NotificationsSection({
  notificationConfig,
  toggleNotification,
  notificationsSaved,
}: Props) {
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

        <SettingsRow icon={<Bell size={15} />} label="התראת שיא אישי (PR)" divider={false}>
          <SettingsToggle
            checked={notificationConfig.prNotificationEnabled}
            onChange={() => toggleNotification('prNotificationEnabled')}
            label="התראת PR"
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
