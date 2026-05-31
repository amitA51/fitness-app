import { Bell, Dumbbell, Zap } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SaveButton } from '../../../components/ui/SettingsSaveButton';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import type { WorkoutPrefs } from '../types';
import { DIVIDER_STYLE, REST_TIME_OPTIONS } from '../types';

interface Props {
  workoutPrefs: WorkoutPrefs;
  setWorkoutPrefs: (p: WorkoutPrefs) => void;
  workoutSaved: boolean;
  onSave: () => void;
}

export function WorkoutPrefsSection({
  workoutPrefs,
  setWorkoutPrefs,
  workoutSaved,
  onSave,
}: Props) {
  return (
    <div className="mb-7">
      <SectionLabel num="04" titleEn="TRAINING · PREFS">
        אימון
      </SectionLabel>
      <SettingsCard>
        {/* Rest time pills */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
            >
              <Dumbbell size={15} />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              זמן מנוחה ברירת מחדל
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pe-11">
            {REST_TIME_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setWorkoutPrefs({ ...workoutPrefs, defaultRestTime: opt.value })}
                style={{
                  padding: '8px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 0,
                  cursor: 'pointer',
                  border: '1px solid var(--fs-surface-2)',
                  transition: 'all 0.15s ease',
                  ...(workoutPrefs.defaultRestTime === opt.value
                    ? { background: 'var(--fs-primary)', color: 'var(--fs-accent)' }
                    : { background: 'transparent', color: 'var(--fs-muted)' }),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={DIVIDER_STYLE} />

        {/* Auto start rest */}
        <SettingsRow
          icon={<Bell size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="התחלה אוטומטית של טיימר"
          divider={true}
        >
          <SettingsToggle
            checked={workoutPrefs.autoStartRest}
            onChange={() =>
              setWorkoutPrefs({ ...workoutPrefs, autoStartRest: !workoutPrefs.autoStartRest })
            }
            label="התחלה אוטומטית"
          />
        </SettingsRow>

        {/* Haptics */}
        <SettingsRow
          icon={<Zap size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="רטט (Haptic Feedback)"
          divider={false}
        >
          <SettingsToggle
            checked={workoutPrefs.hapticsEnabled}
            onChange={() =>
              setWorkoutPrefs({ ...workoutPrefs, hapticsEnabled: !workoutPrefs.hapticsEnabled })
            }
            label="רטט"
          />
        </SettingsRow>
      </SettingsCard>

      <div className="mt-3">
        <SaveButton onClick={onSave} saved={workoutSaved} label="שמור הגדרות אימון" />
      </div>
    </div>
  );
}
