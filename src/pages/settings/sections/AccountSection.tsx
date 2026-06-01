import { LogOut, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
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
      <SectionLabel>חשבון</SectionLabel>
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
            <Button
              variant="secondary"
              fullWidth
              shape="sharp"
              icon={<LogOut size={16} aria-hidden="true" />}
              onClick={onSignOut}
            >
              התנתק
            </Button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
