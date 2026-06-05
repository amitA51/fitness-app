import { HelpCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { useGuidance } from '../../../contexts/GuidanceContext';

/**
 * Guidance section — the re-launch entry for the in-app first-use guidance.
 * Clears the welcome + hint flags and reopens the welcome sheet so users can
 * replay the "how to use the app" walkthrough at any time.
 */
export function GuidanceSection() {
  const { relaunchGuidance } = useGuidance();

  return (
    <div className="mb-7">
      <SectionLabel>הדרכה</SectionLabel>
      <SettingsCard>
        <SettingsRow icon={<HelpCircle size={15} />} label="הצגת ההדרכה מחדש" divider={false}>
          <Button
            variant="secondary"
            shape="sharp"
            onClick={relaunchGuidance}
            aria-label="הצג הדרכה מחדש"
          >
            הצג
          </Button>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

export default GuidanceSection;
