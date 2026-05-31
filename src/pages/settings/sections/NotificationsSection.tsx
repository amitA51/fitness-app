import { Bell } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import type { NotificationSettings } from '../types';

interface Props {
  notificationSettings: NotificationSettings;
  toggleNotification: (key: string) => void;
}

export function NotificationsSection({ notificationSettings, toggleNotification }: Props) {
  return (
    <div className="mb-7">
      <SectionLabel num="04" titleEn="NOTIFICATIONS · ALERTS">
        התראות
      </SectionLabel>
      <SettingsCard>
        <SettingsRow icon={<Bell size={15} />} label="תזכורת אימון" divider={true}>
          <SettingsToggle
            checked={notificationSettings.workoutReminderEnabled}
            onChange={() => toggleNotification('workoutReminderEnabled')}
            label="תזכורת אימון"
          />
        </SettingsRow>

        <SettingsRow icon={<Bell size={15} />} label="תזכורת תזונה" divider={true}>
          <SettingsToggle
            checked={notificationSettings.nutritionReminderEnabled}
            onChange={() => toggleNotification('nutritionReminderEnabled')}
            label="תזכורת תזונה"
          />
        </SettingsRow>

        <SettingsRow icon={<Bell size={15} />} label="התראת שיא אישי (PR)" divider={false}>
          <SettingsToggle
            checked={notificationSettings.prNotificationEnabled}
            onChange={() => toggleNotification('prNotificationEnabled')}
            label="התראת PR"
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
