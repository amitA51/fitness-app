import { ChevronLeft, User, UserCog, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SaveButton } from '../../../components/ui/SettingsSaveButton';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { DIVIDER_STYLE } from '../types';

interface Props {
  isCoach: boolean;
  coachName: string;
  setCoachName: (v: string) => void;
  coachNameSaved: boolean;
  onSaveCoachName: () => void;
  onEnableCoach: () => void;
}

export function CoachingSection({
  isCoach,
  coachName,
  setCoachName,
  coachNameSaved,
  onSaveCoachName,
  onEnableCoach,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="mb-7">
      <SectionLabel num="01c" titleEn="COACHING · COACH">
        מאמן
      </SectionLabel>
      <SettingsCard>
        {/* Display name */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <User size={15} />
            </div>
            <span
              className="flex-1"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              שם תצוגה
            </span>
            <input
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="שם לתצוגה..."
              aria-label="שם תצוגה"
              style={{
                width: '144px',
                minHeight: '44px',
                padding: '6px 10px',
                fontSize: '14px',
                backgroundColor: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 0,
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-hebrew)',
                outline: 'none',
                textAlign: 'left',
              }}
            />
          </div>
          <div style={DIVIDER_STYLE} />
        </div>

        {/* Coach mode toggle */}
        <SettingsRow icon={<UserCog size={15} />} label="מצב מאמן" divider={true}>
          <SettingsToggle checked={isCoach} onChange={onEnableCoach} label="מצב מאמן" />
        </SettingsRow>

        {/* Navigation to coach + trainee hubs */}
        {(
          [
            { label: 'מרכז המאמן', icon: <UserCog size={15} />, to: '/coach' },
            { label: 'המאמן שלי', icon: <Users size={15} />, to: '/my-coach' },
          ] as const
        ).map((row, i, arr) => (
          <div className="flex flex-col" key={row.to}>
            <button
              type="button"
              onClick={() => navigate(row.to)}
              className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] w-full text-right"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center shrink-0"
                style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
              >
                {row.icon}
              </div>
              <span
                className="flex-1"
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--fs-ink)',
                }}
              >
                {row.label}
              </span>
              <ChevronLeft size={16} style={{ color: 'var(--fs-muted)' }} />
            </button>
            {i < arr.length - 1 && <div style={DIVIDER_STYLE} />}
          </div>
        ))}
      </SettingsCard>

      <div className="mt-3">
        <SaveButton onClick={onSaveCoachName} saved={coachNameSaved} label="שמור שם תצוגה" />
      </div>
    </div>
  );
}
