import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';

export function DataAboutSection() {
  return (
    <>
      <SectionLabel num="06" titleEn="DATA · STORAGE">
        נתונים
      </SectionLabel>

      <div className="mb-4">
        <SettingsCard>
          <SettingsRow label="גרסה" divider={true}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
              }}
            >
              1.0.0
            </span>
          </SettingsRow>
          <SettingsRow label="SparkOS Fitness" divider={false}>
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
              }}
            >
              אפליקציית כושר
            </span>
          </SettingsRow>
        </SettingsCard>
      </div>
    </>
  );
}
