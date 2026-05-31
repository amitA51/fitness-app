import { ChevronLeft, Scale, Target, User, Users, Zap } from 'lucide-react';
import { ProfileAvatar } from '../../../components/ui/ProfileAvatar';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { NumberInput } from '../../../components/ui/SettingsNumberInput';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SaveButton } from '../../../components/ui/SettingsSaveButton';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import type { ActivityLevel, Gender, UserProfile, WeightGoal } from '../types';
import { DIVIDER_STYLE, GENDER_OPTIONS } from '../types';

interface Props {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  profileSaved: boolean;
  onSave: () => void;
}

export function ProfileSection({ profile, setProfile, profileSaved, onSave }: Props) {
  const genderLabel =
    GENDER_OPTIONS.find((o) => o.value === profile.gender)?.label ?? GENDER_OPTIONS[0]?.label ?? '';

  return (
    <div className="mb-7">
      <SectionLabel num="02" titleEn="PROFILE · BODY">
        פרופיל
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

        {/* Weight (kg) — feeds the TDEE auto-calc in the Nutrition screen */}
        <SettingsRow
          icon={<Scale size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="משקל"
          divider={true}
        >
          <NumberInput
            value={profile.weight}
            onChange={(v) => setProfile({ ...profile, weight: v })}
            min={30}
            max={300}
            placeholder="—"
            unit='ק"ג'
          />
        </SettingsRow>

        {/* Gender — feeds the TDEE BMR formula */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <Users size={15} />
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
              מין
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
                {genderLabel}
              </span>
              <ChevronLeft size={14} style={{ color: 'var(--fs-muted)' }} />
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as Gender })}
                aria-label="מין"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={DIVIDER_STYLE} />
        </div>

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

      <div className="mt-3">
        <SaveButton onClick={onSave} saved={profileSaved} label="שמור פרופיל" />
      </div>
    </div>
  );
}
