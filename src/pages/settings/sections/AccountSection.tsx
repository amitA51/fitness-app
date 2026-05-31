import { User } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';

interface Props {
  authEmail: string | null;
  onSignOut: () => void;
}

export function AccountSection({ authEmail, onSignOut }: Props) {
  return (
    <div className="mb-7">
      <SectionLabel num="01" titleEn="ACCOUNT · AUTH">
        חשבון
      </SectionLabel>
      <SettingsCard>
        <SettingsRow
          icon={<User size={15} />}
          label={authEmail ?? 'לא מחובר לחשבון'}
          divider={!!authEmail}
        >
          {authEmail ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.08em',
                color: 'var(--fs-muted)',
              }}
            >
              {authEmail}
            </span>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
              }}
            >
              לא מחובר
            </span>
          )}
        </SettingsRow>
        {authEmail && (
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={onSignOut}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '12px',
                borderRadius: 0,
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                fontWeight: 600,
                border: '1px solid var(--fs-surface-2)',
                cursor: 'pointer',
                color: 'var(--fs-ink)',
                background: 'var(--fs-surface)',
              }}
            >
              התנתק
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
