import { Moon } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';

interface Props {
  darkMode: boolean;
  onToggle: () => void;
}

export function ThemeSection({ darkMode, onToggle }: Props) {
  return (
    <div className="mb-7">
      <SectionLabel num="05" titleEn="DISPLAY · THEME">
        תצוגה
      </SectionLabel>
      <SettingsCard>
        <SettingsRow
          icon={
            <div
              className="w-8 h-8 shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: 'var(--fs-primary)',
                border: '2px solid var(--fs-primary)',
                borderRadius: 0,
              }}
            >
              <Moon size={16} style={{ color: 'var(--fs-accent)' }} strokeWidth={2.5} />
            </div>
          }
          label="מצב כהה"
        >
          <SettingsToggle checked={darkMode} onChange={onToggle} label="מצב כהה" />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
