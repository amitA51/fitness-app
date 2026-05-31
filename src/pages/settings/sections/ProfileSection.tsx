import { ChevronLeft, Target, User, Zap } from 'lucide-react';
import { ProfileAvatar } from '../../../components/ui/ProfileAvatar';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { NumberInput } from '../../../components/ui/SettingsNumberInput';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SaveButton } from '../../../components/ui/SettingsSaveButton';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { useSettings } from '../../../contexts/SettingsContext';
import type { ActivityLevel, UserProfile, WeightGoal } from '../types';
import { DIVIDER_STYLE } from '../types';

interface Props {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  profileSaved: boolean;
  onSave: () => void;
}

export function ProfileSection({ profile, setProfile, profileSaved, onSave }: Props) {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="mb-7">
      <SectionLabel num="01" titleEn="GENERAL · PROFILE">
        כללי
      </SectionLabel>

      {/* Avatar card */}
      <div
        className="mb-3"
        style={{
          borderRadius: '22px 16px 22px 16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <ProfileAvatar name={profile.name} />
      </div>

      <SettingsCard>
        {/* Name */}
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
              שם
            </span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="הכנס שם..."
              aria-label="שם"
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

        {/* Age */}
        <SettingsRow
          icon={
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--fs-warn)',
              }}
            >
              גיל
            </span>
          }
          label="גיל"
          divider={true}
        >
          <NumberInput
            value={profile.age}
            onChange={(v) => setProfile({ ...profile, age: v })}
            min={10}
            max={100}
            placeholder="—"
            unit="שנים"
          />
        </SettingsRow>

        {/* Height */}
        <SettingsRow
          icon={
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--fs-accent-2)',
              }}
            >
              גב'
            </span>
          }
          label="גובה"
          divider={true}
        >
          <NumberInput
            value={profile.height}
            onChange={(v) => setProfile({ ...profile, height: v })}
            min={100}
            max={250}
            placeholder="—"
            unit='ס"מ'
          />
        </SettingsRow>

        {/* Weight goal */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <Target size={15} />
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
              מטרת משקל
            </span>
            <div className="relative flex items-center gap-1">
              <span
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  color: 'var(--fs-heading)',
                  fontWeight: 600,
                }}
              >
                {profile.weightGoal}
              </span>
              <ChevronLeft size={14} style={{ color: 'var(--fs-muted)' }} />
              <select
                value={profile.weightGoal}
                onChange={(e) =>
                  setProfile({ ...profile, weightGoal: e.target.value as WeightGoal })
                }
                aria-label="מטרת משקל"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              >
                <option>ירידה במשקל</option>
                <option>שמירה על משקל</option>
                <option>עלייה במסה</option>
              </select>
            </div>
          </div>
          <div style={DIVIDER_STYLE} />
        </div>

        {/* Activity level */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <Zap size={15} />
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
              רמת פעילות
            </span>
            <div className="relative flex items-center gap-1">
              <span
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  color: 'var(--fs-heading)',
                  fontWeight: 600,
                }}
              >
                {profile.activityLevel}
              </span>
              <ChevronLeft size={14} style={{ color: 'var(--fs-muted)' }} />
              <select
                value={profile.activityLevel}
                onChange={(e) =>
                  setProfile({ ...profile, activityLevel: e.target.value as ActivityLevel })
                }
                aria-label="רמת פעילות"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              >
                <option>לא פעיל</option>
                <option>פעיל מעט</option>
                <option>פעיל מתון</option>
                <option>פעיל מאוד</option>
                <option>ספורטאי</option>
              </select>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Unit System Card */}
      <SettingsCard>
        <SettingsRow
          icon={
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--fs-heading)',
              }}
            >
              KG
            </span>
          }
          label="יחידות מידה"
        >
          <div
            style={{
              display: 'flex',
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-primary)',
              borderRadius: 0,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => updateSettings({ unitSystem: 'metric' })}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                background: settings.unitSystem === 'metric' ? 'var(--fs-primary)' : 'transparent',
                color: settings.unitSystem === 'metric' ? 'var(--fs-accent)' : 'var(--fs-muted)',
                border: 'none',
                fontWeight: 600,
                transition: 'all 150ms ease',
              }}
              aria-pressed={settings.unitSystem === 'metric'}
            >
              מטרי
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ unitSystem: 'imperial' })}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                background:
                  settings.unitSystem === 'imperial' ? 'var(--fs-primary)' : 'transparent',
                color: settings.unitSystem === 'imperial' ? 'var(--fs-accent)' : 'var(--fs-muted)',
                border: 'none',
                fontWeight: 600,
                transition: 'all 150ms ease',
              }}
              aria-pressed={settings.unitSystem === 'imperial'}
            >
              אימפריאלי
            </button>
          </div>
        </SettingsRow>
      </SettingsCard>

      <div className="mt-3">
        <SaveButton onClick={onSave} saved={profileSaved} label="שמור פרופיל" />
      </div>
    </div>
  );
}
