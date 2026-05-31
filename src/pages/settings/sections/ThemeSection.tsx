import { Contrast, Eye, Moon, Type } from 'lucide-react';
import type { ReactNode } from 'react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { useSettings } from '../../../contexts/SettingsContext';

/**
 * Display & accessibility section. Dark mode and the accessibility toggles
 * (reduced animations / large text / high contrast) are all owned by
 * SettingsContext, so audio/haptics/motion keep applying app-wide. This
 * section reads/writes that context directly — no localStorage of its own.
 */
export function ThemeSection() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();
  const { reducedAnimations, largeText, highContrast } = settings.workoutSettings;

  const iconBox = (node: ReactNode) => (
    <div
      className="w-8 h-8 shrink-0 flex items-center justify-center"
      style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
    >
      {node}
    </div>
  );

  return (
    <div className="mb-7">
      <SectionLabel num="03" titleEn="DISPLAY · ACCESSIBILITY">
        תצוגה ונגישות
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
          divider={true}
        >
          <SettingsToggle
            checked={settings.darkMode}
            onChange={() => updateSettings({ darkMode: !settings.darkMode })}
            label="מצב כהה"
          />
        </SettingsRow>

        <SettingsRow icon={iconBox(<Eye size={15} />)} label="הפחתת אנימציות" divider={true}>
          <SettingsToggle
            checked={reducedAnimations}
            onChange={() => updateWorkoutSettings({ reducedAnimations: !reducedAnimations })}
            label="הפחתת אנימציות"
          />
        </SettingsRow>

        <SettingsRow icon={iconBox(<Type size={15} />)} label="טקסט גדול" divider={true}>
          <SettingsToggle
            checked={largeText}
            onChange={() => updateWorkoutSettings({ largeText: !largeText })}
            label="טקסט גדול"
          />
        </SettingsRow>

        <SettingsRow icon={iconBox(<Contrast size={15} />)} label="ניגודיות גבוהה" divider={false}>
          <SettingsToggle
            checked={highContrast}
            onChange={() => updateWorkoutSettings({ highContrast: !highContrast })}
            label="ניגודיות גבוהה"
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
