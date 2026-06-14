import { Cake, Ruler, Scale, Target, User, Users, Zap } from 'lucide-react';
import { ProfileAvatar } from '../../../components/ui/ProfileAvatar';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { NumberInput } from '../../../components/ui/SettingsNumberInput';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';
import { SavedIndicator } from '../components/SavedIndicator';
import { SettingsSelect } from '../components/SettingsSelect';
import type { ActivityLevel, Gender, UserProfile, WeightGoal } from '../types';
import { ACTIVITY_LEVEL_OPTIONS, GENDER_OPTIONS, WEIGHT_GOAL_OPTIONS } from '../types';

interface Props {
  profile: UserProfile;
  /** Debounced autosave — for free-text / number fields. */
  updateProfile: (p: UserProfile) => void;
  /** Immediate autosave — for discrete choices (selects). */
  commitProfile: (p: UserProfile) => void;
  profileSaved: boolean;
}

export function ProfileSection({ profile, updateProfile, commitProfile, profileSaved }: Props) {
  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={profileSaved} />}>פרופיל</SectionLabel>

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
          <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
            <IconBox>
              <User size={15} />
            </IconBox>
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
              onChange={(e) => updateProfile({ ...profile, name: e.target.value })}
              placeholder="הזינו שם…"
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
                textAlign: 'start',
              }}
            />
          </div>
          <Divider />
        </div>

        {/* Age — Lucide icon like every other row (the old "גיל" text badge
            duplicated the label). */}
        <SettingsRow icon={<Cake size={15} />} label="גיל" divider={true}>
          <NumberInput
            value={profile.age}
            onChange={(v) => updateProfile({ ...profile, age: v })}
            min={10}
            max={100}
            placeholder="—"
            unit="שנים"
          />
        </SettingsRow>

        {/* Height — Lucide icon; the old "גב'" text badge read like "גברת". */}
        <SettingsRow icon={<Ruler size={15} />} label="גובה" divider={true}>
          <NumberInput
            value={profile.height}
            onChange={(v) => updateProfile({ ...profile, height: v })}
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
            onChange={(v) => updateProfile({ ...profile, weight: v })}
            min={30}
            max={300}
            placeholder="—"
            unit='ק"ג'
          />
        </SettingsRow>

        {/* Gender — feeds the TDEE BMR formula */}
        <SettingsSelect<Gender>
          value={profile.gender}
          options={GENDER_OPTIONS}
          onChange={(gender) => commitProfile({ ...profile, gender })}
          label="מין"
          icon={<Users size={15} />}
          divider={true}
        />

        {/* Weight goal */}
        <SettingsSelect<WeightGoal>
          value={profile.weightGoal}
          options={WEIGHT_GOAL_OPTIONS}
          onChange={(weightGoal) => commitProfile({ ...profile, weightGoal })}
          label="מטרת משקל"
          icon={<Target size={15} />}
          divider={true}
        />

        {/* Activity level */}
        <SettingsSelect<ActivityLevel>
          value={profile.activityLevel}
          options={ACTIVITY_LEVEL_OPTIONS}
          onChange={(activityLevel) => commitProfile({ ...profile, activityLevel })}
          label="רמת פעילות"
          icon={<Zap size={15} />}
          divider={false}
        />
      </SettingsCard>
    </div>
  );
}
