import { Contrast, Eye, Moon, Type } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { useSettings } from '../../../contexts/SettingsContext';
import { IconBox } from '../components/IconBox';
import { SavedIndicator } from '../components/SavedIndicator';
import { useSavedFlash } from '../hooks/useAutosave';

/**
 * Display & accessibility section. Dark mode and the accessibility toggles
 * (reduced animations / large text / high contrast) are all owned by
 * SettingsContext, so audio/haptics/motion keep applying app-wide. This
 * section reads/writes that context directly — no localStorage of its own.
 *
 * `showLabel` is false when the enclosing SettingsGroup heading already reads
 * "תצוגה ונגישות". In that case the shared "נשמר" flash goes with the label,
 * deliberately: every control here is self-evidencing — dark mode, large text
 * and high contrast repaint the screen you are looking at — so a confirmation
 * chip confirms nothing the user cannot already see.
 */
export function ThemeSection({ showLabel = true }: { showLabel?: boolean }) {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();
  const { reducedAnimations, largeText, highContrast } = settings.workoutSettings;
  const { saved, flash } = useSavedFlash();

  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
    flash();
  };
  const toggleReducedAnimations = () => {
    updateWorkoutSettings({ reducedAnimations: !reducedAnimations });
    flash();
  };
  const toggleLargeText = () => {
    updateWorkoutSettings({ largeText: !largeText });
    flash();
  };
  const toggleHighContrast = () => {
    updateWorkoutSettings({ highContrast: !highContrast });
    flash();
  };

  return (
    <div className="mb-5">
      {showLabel && (
        <SectionLabel trailing={<SavedIndicator saved={saved} />}>תצוגה ונגישות</SectionLabel>
      )}
      <SettingsCard>
        <SettingsRow
          icon={
            <div
              className="w-8 h-8 shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: 'var(--fs-primary)',
                border: '2px solid var(--fs-primary)',
                borderRadius: 12,
              }}
            >
              <Moon size={16} style={{ color: 'var(--fs-accent)' }} strokeWidth={2.5} />
            </div>
          }
          label="מצב כהה"
          divider={true}
        >
          <SettingsToggle checked={settings.darkMode} onChange={toggleDarkMode} label="מצב כהה" />
        </SettingsRow>

        <SettingsRow
          icon={<IconBox>{<Eye size={15} />}</IconBox>}
          label="הפחתת אנימציות"
          divider={true}
        >
          <SettingsToggle
            checked={reducedAnimations}
            onChange={toggleReducedAnimations}
            label="הפחתת אנימציות"
          />
        </SettingsRow>

        <SettingsRow
          icon={<IconBox>{<Type size={15} />}</IconBox>}
          label="טקסט גדול"
          divider={true}
        >
          <SettingsToggle checked={largeText} onChange={toggleLargeText} label="טקסט גדול" />
        </SettingsRow>

        <SettingsRow
          icon={<IconBox>{<Contrast size={15} />}</IconBox>}
          label="ניגודיות גבוהה"
          divider={false}
        >
          <SettingsToggle
            checked={highContrast}
            onChange={toggleHighContrast}
            label="ניגודיות גבוהה"
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
