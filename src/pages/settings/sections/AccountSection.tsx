import { LogIn, LogOut, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  authEmail: string | null;
  onSignOut: () => void;
}

export function AccountSection({ authEmail, onSignOut }: Props) {
  // Guests reach Settings without a Supabase session. Calling clearGuest()
  // drops auth status to "unauthenticated", which renders the Login screen —
  // the only sign-in path out of the guest state.
  const { clearGuest } = useAuth();

  return (
    <div className="mb-7">
      <SectionLabel>חשבון</SectionLabel>
      <SettingsCard>
        <SettingsRow
          icon={<User size={15} />}
          label={authEmail ?? 'לא מחוברים לחשבון'}
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
          ) : null}
        </SettingsRow>
        {authEmail ? (
          <div className="px-4 py-3">
            <Button
              variant="secondary"
              fullWidth
              shape="sharp"
              icon={<LogOut size={16} aria-hidden="true" />}
              onClick={onSignOut}
            >
              התנתקות
            </Button>
          </div>
        ) : (
          <div className="px-4 py-3">
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
                marginBottom: '12px',
                lineHeight: 1.5,
              }}
            >
              התחברו כדי לסנכרן את הנתונים בין מכשירים ולגבות אותם בענן.
            </p>
            <Button
              variant="primary"
              fullWidth
              shape="sharp"
              icon={<LogIn size={16} aria-hidden="true" />}
              onClick={clearGuest}
            >
              התחברות או הרשמה
            </Button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
